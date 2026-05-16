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
        company_ids = [current_user.company_id]
    elif current_user.role in (UserRole.accountant, UserRole.firm_admin):
        company_ids = [
            c.id for c in db.query(Company).filter(Company.firm_id == current_user.firm_id).all()
        ]
    else:
        company_ids = [c.id for c in db.query(Company).all()]

    if not company_ids:
        return {"query_label": catalog_entry["label"], "answer": "No companies found.", "columns": [], "rows": []}

    rows, columns = _execute_query(body.query_id, company_ids, db)
    answer = _explain_with_claude(catalog_entry["label"], columns, rows)

    return {
        "query_label": catalog_entry["label"],
        "answer": answer,
        "columns": columns,
        "rows": rows,
    }


def _execute_query(query_id: str, company_ids: list, db: Session):
    if query_id == "pending_above_1l":
        results = (
            db.query(
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
        columns = ["Vendor / Party", "Amount (INR)", "Date", "Description"]
        rows = [
            {
                "Vendor / Party": r.party_name,
                "Amount (INR)": float(r.amount),
                "Date": str(r.transaction_date),
                "Description": r.description or "",
            }
            for r in results
        ]
        return rows, columns

    elif query_id == "spend_by_head":
        results = (
            db.query(PaymentHead.name, func.sum(Transaction.amount).label("total"))
            .join(Transaction, Transaction.head_id == PaymentHead.id)
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.accepted,
            )
            .group_by(PaymentHead.name)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        uncategorized = (
            db.query(func.sum(Transaction.amount))
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.accepted,
                Transaction.head_id.is_(None),
            )
            .scalar() or 0
        )
        columns = ["Expense Head", "Total Spend (INR)"]
        rows = [{"Expense Head": r.name, "Total Spend (INR)": float(r.total)} for r in results]
        if float(uncategorized) > 0:
            rows.append({"Expense Head": "Uncategorized", "Total Spend (INR)": float(uncategorized)})
        return rows, columns

    elif query_id == "top_vendors":
        results = (
            db.query(Transaction.party_name, func.sum(Transaction.amount).label("total"))
            .filter(
                Transaction.company_id.in_(company_ids),
                Transaction.status == TransactionStatus.accepted,
            )
            .group_by(Transaction.party_name)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(10)
            .all()
        )
        columns = ["Vendor / Party", "Total Paid (INR)"]
        rows = [{"Vendor / Party": r.party_name, "Total Paid (INR)": float(r.total)} for r in results]
        return rows, columns

    elif query_id == "low_confidence":
        results = (
            db.query(
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
        columns = ["Vendor / Party", "Amount (INR)", "Confidence", "Date"]
        rows = [
            {
                "Vendor / Party": r.party_name,
                "Amount (INR)": float(r.amount),
                "Confidence": f"{float(r.confidence_score or 0) * 100:.0f}%",
                "Date": str(r.transaction_date),
            }
            for r in results
        ]
        return rows, columns

    elif query_id == "rejected_with_reasons":
        results = (
            db.query(
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
        columns = ["Vendor / Party", "Amount (INR)", "Rejection Reason", "Reviewed At"]
        rows = [
            {
                "Vendor / Party": r.party_name,
                "Amount (INR)": float(r.amount),
                "Rejection Reason": r.rejection_note or "",
                "Reviewed At": str(r.reviewed_at)[:10] if r.reviewed_at else "",
            }
            for r in results
        ]
        return rows, columns

    elif query_id == "monthly_trend":
        today = date.today()
        rows = []
        for i in range(5, -1, -1):
            target = date(today.year, today.month, 1) - timedelta(days=i * 30)
            month_start = date(target.year, target.month, 1)
            if target.month == 12:
                month_end = date(target.year + 1, 1, 1)
            else:
                month_end = date(target.year, target.month + 1, 1)
            total = (
                db.query(func.sum(Transaction.amount))
                .filter(
                    Transaction.company_id.in_(company_ids),
                    Transaction.status == TransactionStatus.accepted,
                    Transaction.transaction_date >= month_start,
                    Transaction.transaction_date < month_end,
                )
                .scalar() or 0
            )
            rows.append({
                "Month": month_start.strftime("%b %Y"),
                "Accepted Spend (INR)": float(total),
            })
        columns = ["Month", "Accepted Spend (INR)"]
        return rows, columns

    elif query_id == "all_pending":
        results = (
            db.query(
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
        columns = ["Vendor / Party", "Amount (INR)", "Date", "Description"]
        rows = [
            {
                "Vendor / Party": r.party_name,
                "Amount (INR)": float(r.amount),
                "Date": str(r.transaction_date),
                "Description": r.description or "",
            }
            for r in results
        ]
        return rows, columns

    return [], []


def _explain_with_claude(query_label: str, columns: list, rows: list) -> str:
    if not rows:
        return f"No data found for '{query_label}'. This could mean there are no matching transactions yet."

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

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
                    f"for '{query_label}' in 2-3 plain English sentences. Be specific with numbers. "
                    f"Use Indian Rupee format with INR prefix. Do not use markdown or bullet points.\n\n"
                    f"Results ({len(rows)} rows shown):\n{rows_text}"
                ),
            }
        ],
    )
    return message.content[0].text
