from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import date, timedelta
import anthropic
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.firm import AccountingFirm
from app.models.transaction import Transaction, TransactionStatus
from app.models.payment import PaymentHead
from app.config import settings

router = APIRouter()

QUERY_CATALOG = [
    {
        "id": "pending_above_1l",
        "label": "Pending > ₹1 Lakh",
        "description": "Transactions pending review above ₹1,00,000 — sorted by amount",
        "icon": "clock",
    },
    {
        "id": "spend_by_head",
        "label": "Spend by Expense Head",
        "description": "Total accepted spend grouped by payment category",
        "icon": "chart-bar",
    },
    {
        "id": "top_vendors",
        "label": "Top Vendors",
        "description": "Top 10 vendors by total accepted spend",
        "icon": "building",
    },
    {
        "id": "low_confidence",
        "label": "Low Confidence Transactions",
        "description": "AI-extracted transactions with confidence below 80% needing attention",
        "icon": "alert",
    },
    {
        "id": "rejected_with_reasons",
        "label": "Rejected Transactions",
        "description": "Rejected transactions with accountant notes",
        "icon": "x-circle",
    },
    {
        "id": "monthly_trend",
        "label": "Monthly Spend Trend",
        "description": "Accepted spend month-by-month for the last 6 months",
        "icon": "trending-up",
    },
    {
        "id": "all_pending",
        "label": "All Pending Review",
        "description": "All transactions awaiting accountant review, largest first",
        "icon": "list",
    },
]


class RunRequest(BaseModel):
    query_id: str


@router.get("/queries")
def get_queries():
    return QUERY_CATALOG


@router.post("/run")
def run_query(
    body: RunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    catalog_entry = next((q for q in QUERY_CATALOG if q["id"] == body.query_id), None)
    if not catalog_entry:
        raise HTTPException(status_code=404, detail="Unknown query")

    if current_user.role in (UserRole.company_admin, UserRole.company_user):
        companies = db.query(Company).filter(Company.id == current_user.company_id).all()
        scope = "single"
    elif current_user.role in (UserRole.accountant, UserRole.firm_admin):
        companies = db.query(Company).filter(Company.firm_id == current_user.firm_id).all()
        scope = "firm"
    else:
        companies = db.query(Company).all()
        scope = "platform"

    company_ids = [c.id for c in companies]

    if not company_ids:
        return {
            "query_label": catalog_entry["label"],
            "answer": "No companies found.",
            "columns": [],
            "rows": [],
        }

    # label_map: company_id (str) → display label
    if scope == "single":
        label_map = {}
    elif scope == "firm":
        label_map = {str(c.id): c.name for c in companies}
    else:
        firms = {str(f.id): f.name for f in db.query(AccountingFirm).all()}
        # For platform admin, company maps to its firm name
        label_map = {str(c.id): firms.get(str(c.firm_id), "Unknown Firm") for c in companies}

    rows, columns = _execute_query(body.query_id, company_ids, db, scope, label_map)
    answer = _explain_with_claude(catalog_entry["label"], columns, rows, scope)

    return {
        "query_label": catalog_entry["label"],
        "answer": answer,
        "columns": columns,
        "rows": rows,
    }


def _group_col(scope: str) -> str | None:
    return "Company" if scope == "firm" else ("Firm" if scope == "platform" else None)


def _label(company_id, label_map: dict) -> str:
    return label_map.get(str(company_id), "Unknown")


def _aggregate_rows(rows: list, group_key: str, amount_keys: list) -> list:
    """Collapse rows that share the same (group_key, other_keys) by summing amount_keys.
    Used for platform scope where multiple companies share the same firm label."""
    seen: dict[tuple, dict] = {}
    for row in rows:
        other_keys = tuple(v for k, v in row.items() if k not in amount_keys)
        if other_keys not in seen:
            seen[other_keys] = dict(row)
        else:
            for ak in amount_keys:
                seen[other_keys][ak] = seen[other_keys].get(ak, 0) + row.get(ak, 0)
    return list(seen.values())


def _execute_query(query_id: str, company_ids: list, db: Session, scope: str, label_map: dict):
    gc = _group_col(scope)

    if query_id == "pending_above_1l":
        results = (
            db.query(
                Transaction.company_id,
                Transaction.party_name,
                Transaction.amount,
                Transaction.transaction_date,
                Transaction.description,
            )
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.pending_review,
                Transaction.amount >= 100000,
            )
            .order_by(Transaction.amount.desc())
            .limit(50)
            .all()
        )
        columns = (([gc] if gc else []) +
                   ["Vendor / Party", "Amount (INR)", "Date", "Description"])
        rows = []
        for r in results:
            row = {}
            if gc:
                row[gc] = _label(r.company_id, label_map)
            row["Vendor / Party"] = r.party_name or "—"
            row["Amount (INR)"] = float(r.amount or 0)
            row["Date"] = str(r.transaction_date or "—")
            row["Description"] = r.description or "—"
            rows.append(row)
        if gc:
            rows.sort(key=lambda r: (r[gc], -r["Amount (INR)"]))
        return rows, columns

    elif query_id == "spend_by_head":
        results = (
            db.query(
                Transaction.company_id,
                PaymentHead.name,
                func.sum(Transaction.amount).label("total"),
            )
            .join(Transaction, Transaction.head_id == PaymentHead.id)
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.accepted,
            )
            .group_by(Transaction.company_id, PaymentHead.name)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        uncategorized = (
            db.query(Transaction.company_id, func.sum(Transaction.amount).label("total"))
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.accepted,
                Transaction.head_id.is_(None),
            )
            .group_by(Transaction.company_id)
            .all()
        )
        columns = (([gc] if gc else []) + ["Expense Head", "Total Spend (INR)"])
        rows = []
        for r in results:
            row = {}
            if gc:
                row[gc] = _label(r.company_id, label_map)
            row["Expense Head"] = r.name
            row["Total Spend (INR)"] = float(r.total or 0)
            rows.append(row)
        for r in uncategorized:
            row = {}
            if gc:
                row[gc] = _label(r.company_id, label_map)
            row["Expense Head"] = "Uncategorized"
            row["Total Spend (INR)"] = float(r.total or 0)
            rows.append(row)
        if gc:
            # For platform scope, aggregate companies of same firm together
            if scope == "platform":
                rows = _aggregate_rows(rows, gc, ["Total Spend (INR)"])
            rows.sort(key=lambda r: (r[gc], -r["Total Spend (INR)"]))
        return rows, columns

    elif query_id == "top_vendors":
        results = (
            db.query(
                Transaction.company_id,
                Transaction.party_name,
                func.sum(Transaction.amount).label("total"),
            )
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.accepted,
                Transaction.party_name.isnot(None),
            )
            .group_by(Transaction.company_id, Transaction.party_name)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(50)
            .all()
        )
        columns = (([gc] if gc else []) + ["Vendor / Party", "Total Paid (INR)"])
        rows = []
        for r in results:
            row = {}
            if gc:
                row[gc] = _label(r.company_id, label_map)
            row["Vendor / Party"] = r.party_name
            row["Total Paid (INR)"] = float(r.total or 0)
            rows.append(row)
        if gc:
            if scope == "platform":
                rows = _aggregate_rows(rows, gc, ["Total Paid (INR)"])
            rows.sort(key=lambda r: (r[gc], -r["Total Paid (INR)"]))
            # Limit to top 10 per group
            from itertools import groupby
            limited = []
            for label, group in groupby(rows, key=lambda r: r[gc]):
                limited.extend(list(group)[:10])
            rows = limited
        else:
            rows = rows[:10]
        return rows, columns

    elif query_id == "low_confidence":
        results = (
            db.query(
                Transaction.company_id,
                Transaction.party_name,
                Transaction.amount,
                Transaction.confidence_score,
                Transaction.transaction_date,
            )
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.pending_review,
                Transaction.confidence_score < 0.8,
            )
            .order_by(Transaction.confidence_score.asc())
            .limit(50)
            .all()
        )
        columns = (([gc] if gc else []) +
                   ["Vendor / Party", "Amount (INR)", "Confidence", "Date"])
        rows = []
        for r in results:
            row = {}
            if gc:
                row[gc] = _label(r.company_id, label_map)
            row["Vendor / Party"] = r.party_name or "—"
            row["Amount (INR)"] = float(r.amount or 0)
            row["Confidence"] = f"{float(r.confidence_score or 0) * 100:.0f}%"
            row["Date"] = str(r.transaction_date or "—")
            rows.append(row)
        if gc:
            rows.sort(key=lambda r: r[gc])
        return rows, columns

    elif query_id == "rejected_with_reasons":
        results = (
            db.query(
                Transaction.company_id,
                Transaction.party_name,
                Transaction.amount,
                Transaction.rejection_note,
                Transaction.reviewed_at,
            )
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.rejected,
            )
            .order_by(Transaction.reviewed_at.desc())
            .limit(50)
            .all()
        )
        columns = (([gc] if gc else []) +
                   ["Vendor / Party", "Amount (INR)", "Rejection Reason", "Reviewed At"])
        rows = []
        for r in results:
            row = {}
            if gc:
                row[gc] = _label(r.company_id, label_map)
            row["Vendor / Party"] = r.party_name or "—"
            row["Amount (INR)"] = float(r.amount or 0)
            row["Rejection Reason"] = r.rejection_note or "—"
            row["Reviewed At"] = str(r.reviewed_at)[:10] if r.reviewed_at else "—"
            rows.append(row)
        if gc:
            rows.sort(key=lambda r: r[gc])
        return rows, columns

    elif query_id == "monthly_trend":
        today = date.today()
        months = []
        for i in range(5, -1, -1):
            target = date(today.year, today.month, 1) - timedelta(days=i * 30)
            month_start = date(target.year, target.month, 1)
            month_end = (
                date(target.year + 1, 1, 1)
                if target.month == 12
                else date(target.year, target.month + 1, 1)
            )
            months.append((month_start.strftime("%b %Y"), month_start, month_end))

        if scope == "single":
            rows = []
            for label, start, end in months:
                total = (
                    db.query(func.sum(Transaction.amount))
                    .filter(
                        Transaction.company_id.in_(company_ids),
                        Transaction.status == TransactionStatus.accepted,
                        Transaction.transaction_date >= start,
                        Transaction.transaction_date < end,
                    )
                    .scalar() or 0
                )
                rows.append({"Month": label, "Accepted Spend (INR)": float(total)})
            columns = ["Month", "Accepted Spend (INR)"]
        else:
            rows = []
            for month_label, start, end in months:
                per_company = (
                    db.query(
                        Transaction.company_id,
                        func.sum(Transaction.amount).label("total"),
                    )
                    .filter(
                        Transaction.company_id.in_(company_ids),
                        Transaction.status == TransactionStatus.accepted,
                        Transaction.transaction_date >= start,
                        Transaction.transaction_date < end,
                    )
                    .group_by(Transaction.company_id)
                    .all()
                )
                # For platform scope, aggregate by firm
                if scope == "platform":
                    firm_totals: dict[str, float] = {}
                    for r in per_company:
                        firm_name = _label(r.company_id, label_map)
                        firm_totals[firm_name] = firm_totals.get(firm_name, 0) + float(r.total or 0)
                    for firm_name, total in firm_totals.items():
                        rows.append({"Firm": firm_name, "Month": month_label, "Accepted Spend (INR)": total})
                else:
                    for r in per_company:
                        rows.append({
                            "Company": _label(r.company_id, label_map),
                            "Month": month_label,
                            "Accepted Spend (INR)": float(r.total or 0),
                        })
            rows.sort(key=lambda r: (r.get(gc, ""), r["Month"]))
            columns = [gc, "Month", "Accepted Spend (INR)"]
        return rows, columns

    elif query_id == "all_pending":
        results = (
            db.query(
                Transaction.company_id,
                Transaction.party_name,
                Transaction.amount,
                Transaction.transaction_date,
                Transaction.description,
            )
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.pending_review,
            )
            .order_by(Transaction.amount.desc())
            .limit(100)
            .all()
        )
        columns = (([gc] if gc else []) +
                   ["Vendor / Party", "Amount (INR)", "Date", "Description"])
        rows = []
        for r in results:
            row = {}
            if gc:
                row[gc] = _label(r.company_id, label_map)
            row["Vendor / Party"] = r.party_name or "—"
            row["Amount (INR)"] = float(r.amount or 0)
            row["Date"] = str(r.transaction_date or "—")
            row["Description"] = r.description or "—"
            rows.append(row)
        if gc:
            rows.sort(key=lambda r: (r[gc], -r["Amount (INR)"]))
        return rows, columns

    return [], []


def _explain_with_claude(query_label: str, columns: list, rows: list, scope: str) -> str:
    if not rows:
        return f"No data found for '{query_label}'. There are no matching transactions yet."

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    scope_context = (
        "across all companies in the firm"
        if scope == "firm"
        else "across all firms on the platform"
        if scope == "platform"
        else "for the company"
    )

    rows_text = "\n".join(
        ", ".join(f"{k}: {v}" for k, v in row.items()) for row in rows[:20]
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": (
                    f"You are a financial analyst assistant. Summarize the following query results "
                    f"for '{query_label}' ({scope_context}) in 2-3 plain English sentences. "
                    f"Be specific with numbers. Use Indian Rupee format with INR prefix. "
                    f"Highlight any notable differences between companies or firms if visible. "
                    f"Do not use markdown or bullet points.\n\n"
                    f"Results ({len(rows)} rows shown):\n{rows_text}"
                ),
            }
        ],
    )
    return message.content[0].text
