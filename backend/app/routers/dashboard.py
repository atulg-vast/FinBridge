from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.document import Document, DocumentStatus
from app.models.transaction import Transaction, TransactionStatus
from app.models.report import Report

router = APIRouter()


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = current_user.role

    if role in (UserRole.company_admin, UserRole.company_user):
        return _company_summary(db, current_user)
    elif role in (UserRole.accountant, UserRole.firm_admin):
        return _accountant_summary(db, current_user)
    else:
        return _platform_summary(db)


def _company_summary(db: Session, user: User):
    cid = user.company_id

    # Document counts
    docs = db.query(Document).filter(Document.company_id == cid).all()
    doc_counts = {
        "total": len(docs),
        "pending": sum(1 for d in docs if d.status in (DocumentStatus.pending, DocumentStatus.processing)),
        "extracted": sum(1 for d in docs if d.status == DocumentStatus.extracted),
        "failed": sum(1 for d in docs if d.status == DocumentStatus.failed),
    }

    # Transaction counts
    txns = db.query(Transaction).filter(Transaction.company_id == cid).all()
    txn_counts = {
        "pending_review": sum(1 for t in txns if t.status == TransactionStatus.pending_review),
        "accepted": sum(1 for t in txns if t.status == TransactionStatus.accepted),
        "rejected": sum(1 for t in txns if t.status == TransactionStatus.rejected),
    }

    # Monthly spend (last 6 months, accepted transactions)
    monthly = _monthly_spend(db, company_ids=[str(cid)], months=6)

    # Top expense heads (accepted, with head assigned)
    head_spend = _head_breakdown(db, company_ids=[str(cid)])

    return {
        "role": "company",
        "doc_counts": doc_counts,
        "txn_counts": txn_counts,
        "monthly_spend": monthly,
        "head_breakdown": head_spend,
    }


def _accountant_summary(db: Session, user: User):
    company_ids = [
        str(c.id) for c in db.query(Company).filter(Company.firm_id == user.firm_id).all()
    ]

    pending_count = db.query(Transaction).filter(
        Transaction.company_id.in_(company_ids),
        Transaction.status == TransactionStatus.pending_review,
    ).count()

    accepted_count = db.query(Transaction).filter(
        Transaction.company_id.in_(company_ids),
        Transaction.reviewed_by == user.id,
        Transaction.status == TransactionStatus.accepted,
    ).count()

    rejected_count = db.query(Transaction).filter(
        Transaction.company_id.in_(company_ids),
        Transaction.reviewed_by == user.id,
        Transaction.status == TransactionStatus.rejected,
    ).count()

    # Docs processed this week
    week_ago = date.today() - timedelta(days=7)
    docs_this_week = db.query(Document).filter(
        Document.company_id.in_(company_ids),
        Document.created_at >= week_ago,
    ).count()

    # Reports uploaded
    reports_count = db.query(Report).filter(
        Report.company_id.in_(company_ids),
    ).count()

    # Per-company breakdown
    company_stats = []
    companies = db.query(Company).filter(Company.firm_id == user.firm_id).all()
    for c in companies:
        pending = db.query(Transaction).filter(
            Transaction.company_id == c.id,
            Transaction.status == TransactionStatus.pending_review,
        ).count()
        accepted = db.query(Transaction).filter(
            Transaction.company_id == c.id,
            Transaction.reviewed_by == user.id,
            Transaction.status == TransactionStatus.accepted,
        ).count()
        rejected = db.query(Transaction).filter(
            Transaction.company_id == c.id,
            Transaction.reviewed_by == user.id,
            Transaction.status == TransactionStatus.rejected,
        ).count()
        total_docs = db.query(Document).filter(Document.company_id == c.id).count()
        company_stats.append({
            "id": str(c.id),
            "name": c.name,
            "business_type": c.business_type.value,
            "pending_review": pending,
            "accepted": accepted,
            "rejected": rejected,
            "total_docs": total_docs,
        })

    monthly = _monthly_spend(db, company_ids=company_ids, months=6)

    # My personal monthly review activity (for accountant role)
    my_monthly_reviews = []
    today = date.today()
    for i in range(5, -1, -1):
        target = date(today.year, today.month, 1) - timedelta(days=i * 30)
        month_start = date(target.year, target.month, 1)
        month_end = (
            date(target.year + 1, 1, 1) if target.month == 12
            else date(target.year, target.month + 1, 1)
        )
        acc = db.query(Transaction).filter(
            Transaction.reviewed_by == user.id,
            Transaction.status == TransactionStatus.accepted,
            Transaction.reviewed_at >= month_start,
            Transaction.reviewed_at < month_end,
        ).count()
        rej = db.query(Transaction).filter(
            Transaction.reviewed_by == user.id,
            Transaction.status == TransactionStatus.rejected,
            Transaction.reviewed_at >= month_start,
            Transaction.reviewed_at < month_end,
        ).count()
        my_monthly_reviews.append({
            "month": month_start.strftime("%b %Y"),
            "accepted": acc,
            "rejected": rej,
        })

    return {
        "role": "accountant",
        "txn_counts": {
            "pending_review": pending_count,
            "accepted": accepted_count,
            "rejected": rejected_count,
        },
        "docs_this_week": docs_this_week,
        "reports_count": reports_count,
        "company_stats": company_stats,
        "monthly_spend": monthly,
        "my_monthly_reviews": my_monthly_reviews,
    }


def _platform_summary(db: Session):
    from app.models.firm import AccountingFirm
    firms = db.query(AccountingFirm).count()
    companies = db.query(Company).count()
    users = db.query(User).filter(User.role != UserRole.platform_admin).count()
    docs = db.query(Document).count()
    txns = db.query(Transaction).count()
    pending = db.query(Transaction).filter(Transaction.status == TransactionStatus.pending_review).count()

    return {
        "role": "platform_admin",
        "firms": firms,
        "companies": companies,
        "users": users,
        "documents": docs,
        "transactions": txns,
        "pending_review": pending,
    }


@router.get("/platform/firm-analytics")
def get_firm_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.firm import AccountingFirm

    if current_user.role != UserRole.platform_admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Platform admin only")

    firms = db.query(AccountingFirm).order_by(AccountingFirm.created_at).all()
    all_company_ids = [str(c.id) for c in db.query(Company).all()]

    firm_stats = []
    for firm in firms:
        companies = db.query(Company).filter(Company.firm_id == firm.id).all()
        company_ids = [str(c.id) for c in companies]

        users_count = db.query(User).filter(
            User.firm_id == firm.id,
            User.role != UserRole.platform_admin,
        ).count()

        pending = db.query(Transaction).filter(
            Transaction.company_id.in_(company_ids),
            Transaction.status == TransactionStatus.pending_review,
        ).count() if company_ids else 0

        accepted = db.query(Transaction).filter(
            Transaction.company_id.in_(company_ids),
            Transaction.status == TransactionStatus.accepted,
        ).count() if company_ids else 0

        rejected = db.query(Transaction).filter(
            Transaction.company_id.in_(company_ids),
            Transaction.status == TransactionStatus.rejected,
        ).count() if company_ids else 0

        docs_count = db.query(Document).filter(
            Document.company_id.in_(company_ids),
        ).count() if company_ids else 0

        firm_stats.append({
            "firm_id": str(firm.id),
            "firm_name": firm.name,
            "companies": len(companies),
            "users": users_count,
            "documents": docs_count,
            "pending_review": pending,
            "accepted": accepted,
            "rejected": rejected,
        })

    # Platform-wide transaction status totals
    txn_status = {
        "pending_review": db.query(Transaction).filter(
            Transaction.status == TransactionStatus.pending_review).count(),
        "accepted": db.query(Transaction).filter(
            Transaction.status == TransactionStatus.accepted).count(),
        "rejected": db.query(Transaction).filter(
            Transaction.status == TransactionStatus.rejected).count(),
    }

    # Monthly document uploads (last 6 months, platform-wide)
    today = date.today()
    monthly_docs = []
    for i in range(5, -1, -1):
        target = date(today.year, today.month, 1) - timedelta(days=i * 30)
        month_start = date(target.year, target.month, 1)
        month_end = (
            date(target.year + 1, 1, 1) if target.month == 12
            else date(target.year, target.month + 1, 1)
        )
        count = db.query(Document).filter(
            Document.created_at >= month_start,
            Document.created_at < month_end,
        ).count()
        monthly_docs.append({"month": month_start.strftime("%b %Y"), "count": count})

    return {
        "firm_stats": firm_stats,
        "txn_status": txn_status,
        "monthly_docs": monthly_docs,
    }


@router.get("/firm/analytics")
def get_firm_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.firm_admin, UserRole.accountant):
        raise HTTPException(status_code=403, detail="Firm members only")

    # All accountants + firm_admins in this firm
    reviewers = db.query(User).filter(
        User.firm_id == current_user.firm_id,
        User.role.in_([UserRole.accountant, UserRole.firm_admin]),
    ).all()

    accountant_stats = []
    for acc in reviewers:
        accepted = db.query(Transaction).filter(
            Transaction.reviewed_by == acc.id,
            Transaction.status == TransactionStatus.accepted,
        ).count()
        rejected = db.query(Transaction).filter(
            Transaction.reviewed_by == acc.id,
            Transaction.status == TransactionStatus.rejected,
        ).count()
        total = accepted + rejected
        accountant_stats.append({
            "accountant_id": str(acc.id),
            "name": acc.full_name or acc.email,
            "role": acc.role.value,
            "accepted": accepted,
            "rejected": rejected,
            "total_reviewed": total,
            "acceptance_rate": round(accepted / total * 100, 1) if total > 0 else None,
        })
    accountant_stats.sort(key=lambda x: -(x["total_reviewed"]))

    # Monthly firm-wide review throughput (last 6 months)
    today = date.today()
    reviewer_ids = [acc.id for acc in reviewers]
    monthly_reviews = []
    for i in range(5, -1, -1):
        target = date(today.year, today.month, 1) - timedelta(days=i * 30)
        month_start = date(target.year, target.month, 1)
        month_end = (
            date(target.year + 1, 1, 1) if target.month == 12
            else date(target.year, target.month + 1, 1)
        )
        acc_count = db.query(Transaction).filter(
            Transaction.reviewed_by.in_(reviewer_ids),
            Transaction.status == TransactionStatus.accepted,
            Transaction.reviewed_at >= month_start,
            Transaction.reviewed_at < month_end,
        ).count() if reviewer_ids else 0
        rej_count = db.query(Transaction).filter(
            Transaction.reviewed_by.in_(reviewer_ids),
            Transaction.status == TransactionStatus.rejected,
            Transaction.reviewed_at >= month_start,
            Transaction.reviewed_at < month_end,
        ).count() if reviewer_ids else 0
        monthly_reviews.append({
            "month": month_start.strftime("%b %Y"),
            "accepted": acc_count,
            "rejected": rej_count,
        })

    return {
        "accountant_stats": accountant_stats,
        "monthly_reviews": monthly_reviews,
    }


def _monthly_spend(db: Session, company_ids: list, months: int = 6):
    """Returns list of {month, amount} for accepted transactions over last N months."""
    if not company_ids:
        return []

    today = date.today()
    results = []
    for i in range(months - 1, -1, -1):
        # First day of target month
        target = date(today.year, today.month, 1) - timedelta(days=i * 30)
        month_start = date(target.year, target.month, 1)
        if target.month == 12:
            month_end = date(target.year + 1, 1, 1)
        else:
            month_end = date(target.year, target.month + 1, 1)

        total = db.query(func.sum(Transaction.amount)).filter(
            Transaction.company_id.in_(company_ids),
            Transaction.status == TransactionStatus.accepted,
            Transaction.transaction_date >= month_start,
            Transaction.transaction_date < month_end,
        ).scalar() or 0

        results.append({
            "month": month_start.strftime("%b %Y"),
            "amount": float(total),
        })
    return results


def _head_breakdown(db: Session, company_ids: list):
    """Top expense heads by total accepted amount."""
    from app.models.payment import PaymentHead

    if not company_ids:
        return []

    rows = (
        db.query(PaymentHead.name, func.sum(Transaction.amount).label("total"))
        .join(Transaction, Transaction.head_id == PaymentHead.id)
        .filter(
            Transaction.company_id.in_(company_ids),
            Transaction.status == TransactionStatus.accepted,
        )
        .group_by(PaymentHead.name)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(5)
        .all()
    )
    return [{"name": r.name, "amount": float(r.total)} for r in rows]
