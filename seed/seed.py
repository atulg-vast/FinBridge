"""
Demo seed script — creates a full working demo dataset.
Safe to re-run (idempotent by email/name checks).

Creates:
  - 1 accounting firm: "Apex Accounting LLP"
  - 1 firm_admin:      firm@apexaccounting.com / Firm@1234
  - 2 accountants:     accountant1@apex.com / Acc@1234
                       accountant2@apex.com / Acc@1234
  - 2 companies:
      TechCorp Solutions (IT Services)       → admin: admin@techcorp.com / Tech@1234
      ManuFab Industries (Manufacturing)     → admin: admin@manufab.com / Manu@1234
  - Payment heads for each company
  - 10 realistic transactions in mixed states
  - 2 sample MIS reports (placeholder files)
"""
import sys
import os
import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from passlib.context import CryptContext
from app.database import SessionLocal
from app.models.firm import AccountingFirm
from app.models.user import User, UserRole
from app.models.company import Company, BusinessType
from app.models.payment import PaymentHead, PaymentSubHead
from app.models.document import Document, DocumentStatus
from app.models.document_type import DocumentType
from app.models.transaction import Transaction, TransactionStatus
from app.models.report import Report
from app.config import settings

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def h(password: str) -> str:
    return pwd.hash(password)


def get_or_create_firm(db, name: str, slug: str) -> AccountingFirm:
    firm = db.query(AccountingFirm).filter(AccountingFirm.name == name).first()
    if firm:
        print(f"  [skip] Firm '{name}' already exists")
        return firm
    firm = AccountingFirm(name=name, slug=slug)
    db.add(firm)
    db.flush()
    print(f"  [+] Firm: {name}")
    return firm


def get_or_create_user(db, email: str, **kwargs) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        print(f"  [skip] User '{email}' already exists")
        return user
    user = User(email=email, **kwargs)
    db.add(user)
    db.flush()
    print(f"  [+] User: {email}")
    return user


def get_or_create_company(db, name: str, **kwargs) -> Company:
    company = db.query(Company).filter(Company.name == name).first()
    if company:
        print(f"  [skip] Company '{name}' already exists")
        return company
    company = Company(name=name, **kwargs)
    db.add(company)
    db.flush()
    print(f"  [+] Company: {name}")
    return company


def seed_payment_heads(db, company: Company, heads: list[dict]):
    for head_def in heads:
        existing = db.query(PaymentHead).filter(
            PaymentHead.company_id == company.id,
            PaymentHead.name == head_def["name"],
        ).first()
        if existing:
            head = existing
        else:
            head = PaymentHead(company_id=company.id, name=head_def["name"])
            db.add(head)
            db.flush()
            print(f"    [+] Head: {head_def['name']}")

        for sub_name in head_def.get("subs", []):
            existing_sub = db.query(PaymentSubHead).filter(
                PaymentSubHead.head_id == head.id,
                PaymentSubHead.name == sub_name,
            ).first()
            if not existing_sub:
                db.add(PaymentSubHead(head_id=head.id, company_id=company.id, name=sub_name))
                print(f"      [+] Sub: {sub_name}")

    return {h.name: h for h in db.query(PaymentHead).filter(PaymentHead.company_id == company.id).all()}


def seed_transactions(db, company: Company, doc_type: DocumentType, heads: dict, transactions: list[dict]):
    # Create a dummy document to attach transactions to
    doc = Document(
        company_id=company.id,
        uploaded_by=db.query(User).filter(User.company_id == company.id).first().id,
        document_type_id=doc_type.id,
        file_path=f"/uploads/seed/demo_{company.id}.pdf",
        original_filename=f"demo_{doc_type.slug}.pdf",
        status=DocumentStatus.extracted,
    )
    db.add(doc)
    db.flush()

    for txn_def in transactions:
        head = heads.get(txn_def.get("head", ""))
        t = Transaction(
            document_id=doc.id,
            company_id=company.id,
            head_id=head.id if head else None,
            party_name=txn_def["party_name"],
            amount=Decimal(str(txn_def["amount"])),
            transaction_date=txn_def["date"],
            description=txn_def["description"],
            extracted_data=txn_def.get("extracted_data", {}),
            raw_ai_output={},
            confidence_score=Decimal("0.95"),
            low_confidence_fields=[],
            status=txn_def["status"],
            rejection_note=txn_def.get("rejection_note"),
        )
        if txn_def["status"] in (TransactionStatus.accepted, TransactionStatus.rejected):
            reviewer = db.query(User).filter(
                User.firm_id == company.firm_id,
                User.role == UserRole.accountant,
            ).first()
            if reviewer:
                t.reviewed_by = reviewer.id
                t.reviewed_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.add(t)
        print(f"    [+] Transaction: {txn_def['party_name']} - {txn_def['amount']}")


def seed_report(db, company: Company, uploader: User, title: str, filename: str):
    existing = db.query(Report).filter(
        Report.company_id == company.id,
        Report.title == title,
    ).first()
    if existing:
        print(f"  [skip] Report '{title}' already exists")
        return

    # Create a placeholder file
    report_dir = os.path.join(settings.UPLOAD_DIR, "reports", str(company.id))
    os.makedirs(report_dir, exist_ok=True)
    file_path = os.path.join(report_dir, filename)
    if not os.path.exists(file_path):
        with open(file_path, "w") as f:
            f.write(f"Demo MIS Report: {title}\nCompany: {company.name}\nGenerated for demo purposes.\n")

    report = Report(
        company_id=company.id,
        uploaded_by=uploader.id,
        title=title,
        file_path=file_path,
        original_filename=filename,
    )
    db.add(report)
    print(f"  [+] Report: {title}")


def main():
    db = SessionLocal()
    try:
        print("\n=== FinBridge Demo Seed ===\n")

        # ── Firm ──────────────────────────────────────────────
        print("[1] Creating firm...")
        firm = get_or_create_firm(db, "Apex Accounting LLP", "apex-accounting")

        # ── Firm Admin ────────────────────────────────────────
        print("[2] Creating firm admin...")
        firm_admin = get_or_create_user(db,
            email="firm@apexaccounting.com",
            full_name="Rajesh Sharma",
            password_hash=h("Firm@1234"),
            role=UserRole.firm_admin,
            firm_id=firm.id,
            is_active=True,
        )

        # ── Accountants ───────────────────────────────────────
        print("[3] Creating accountants...")
        acc1 = get_or_create_user(db,
            email="accountant1@apex.com",
            full_name="Priya Mehta",
            password_hash=h("Acc@1234"),
            role=UserRole.accountant,
            firm_id=firm.id,
            is_active=True,
        )
        acc2 = get_or_create_user(db,
            email="accountant2@apex.com",
            full_name="Vikram Nair",
            password_hash=h("Acc@1234"),
            role=UserRole.accountant,
            firm_id=firm.id,
            is_active=True,
        )

        # ── Companies ─────────────────────────────────────────
        print("[4] Creating companies...")
        techcorp = get_or_create_company(db,
            name="TechCorp Solutions",
            firm_id=firm.id,
            business_type=BusinessType.it,
        )
        manufab = get_or_create_company(db,
            name="ManuFab Industries",
            firm_id=firm.id,
            business_type=BusinessType.manufacturing,
        )

        # ── Company users ─────────────────────────────────────
        print("[5] Creating company users...")
        tc_admin = get_or_create_user(db,
            email="admin@techcorp.com",
            full_name="Ananya Iyer",
            password_hash=h("Tech@1234"),
            role=UserRole.company_admin,
            firm_id=firm.id,
            company_id=techcorp.id,
            is_active=True,
        )
        tc_user = get_or_create_user(db,
            email="user@techcorp.com",
            full_name="Sameer Kulkarni",
            password_hash=h("Tech@1234"),
            role=UserRole.company_user,
            firm_id=firm.id,
            company_id=techcorp.id,
            is_active=True,
        )
        mf_admin = get_or_create_user(db,
            email="admin@manufab.com",
            full_name="Deepak Joshi",
            password_hash=h("Manu@1234"),
            role=UserRole.company_admin,
            firm_id=firm.id,
            company_id=manufab.id,
            is_active=True,
        )

        # ── Payment Heads ─────────────────────────────────────
        print("[6] Seeding payment heads for TechCorp...")
        tc_heads = seed_payment_heads(db, techcorp, [
            {"name": "Operating Expenses", "subs": ["Software Subscriptions", "Cloud Hosting", "Office Supplies"]},
            {"name": "Payroll", "subs": ["Salaries", "Contractor Payments", "Bonuses"]},
            {"name": "Marketing", "subs": ["Digital Ads", "Events", "Content"]},
            {"name": "Travel", "subs": ["Domestic", "International"]},
        ])

        print("[7] Seeding payment heads for ManuFab...")
        mf_heads = seed_payment_heads(db, manufab, [
            {"name": "Raw Materials", "subs": ["Steel", "Plastics", "Components"]},
            {"name": "Utilities", "subs": ["Electricity", "Water", "Gas"]},
            {"name": "Payroll", "subs": ["Factory Workers", "Management"]},
            {"name": "Logistics", "subs": ["Inbound Freight", "Outbound Freight"]},
        ])

        # ── Document type for seeded transactions ─────────────
        invoice_type = db.query(DocumentType).filter(DocumentType.slug == "invoice_purchase").first()
        salary_type = db.query(DocumentType).filter(DocumentType.slug == "salary_register").first()

        if not invoice_type:
            print("  [!] Document types not seeded yet — run seed/document_types.py first")
            db.rollback()
            return

        # ── Transactions for TechCorp ─────────────────────────
        print("[8] Seeding transactions for TechCorp...")
        seed_transactions(db, techcorp, invoice_type, tc_heads, [
            {
                "party_name": "AWS India Pvt Ltd",
                "amount": 142500.00,
                "date": date(2025, 4, 5),
                "description": "Invoice INV-2025-0041 - Cloud infrastructure",
                "head": "Operating Expenses",
                "status": TransactionStatus.accepted,
                "extracted_data": {"invoice_number": "INV-2025-0041", "gstin": "07AABCA1234B1Z5"},
            },
            {
                "party_name": "Zoom Video Communications",
                "amount": 18200.00,
                "date": date(2025, 4, 12),
                "description": "Invoice ZM-98231 - Annual subscription",
                "head": "Operating Expenses",
                "status": TransactionStatus.accepted,
                "extracted_data": {"invoice_number": "ZM-98231"},
            },
            {
                "party_name": "Facebook Ads",
                "amount": 55000.00,
                "date": date(2025, 3, 28),
                "description": "Invoice FB-Q1-2025 - Digital campaign",
                "head": "Marketing",
                "status": TransactionStatus.rejected,
                "rejection_note": "Duplicate invoice — already processed in Feb batch.",
                "extracted_data": {"invoice_number": "FB-Q1-2025"},
            },
            {
                "party_name": "IndiGo Airlines",
                "amount": 28750.00,
                "date": date(2025, 4, 18),
                "description": "Travel - Bangalore to Mumbai (4 tickets)",
                "head": "Travel",
                "status": TransactionStatus.pending_review,
                "extracted_data": {},
            },
            {
                "party_name": "Dell Technologies India",
                "amount": 312000.00,
                "date": date(2025, 4, 20),
                "description": "Invoice DL-2025-7821 - Laptops x6",
                "head": "Operating Expenses",
                "status": TransactionStatus.pending_review,
                "extracted_data": {"invoice_number": "DL-2025-7821", "items": 6},
            },
            {
                "party_name": "March 2025 Payroll",
                "amount": 1850000.00,
                "date": date(2025, 3, 31),
                "description": "Salary register - 18 employees",
                "head": "Payroll",
                "status": TransactionStatus.accepted,
                "extracted_data": {"employee_count": 18, "month": "March 2025"},
            },
        ])

        # ── Transactions for ManuFab ──────────────────────────
        print("[9] Seeding transactions for ManuFab...")
        seed_transactions(db, manufab, invoice_type, mf_heads, [
            {
                "party_name": "Tata Steel Ltd",
                "amount": 875000.00,
                "date": date(2025, 4, 3),
                "description": "Invoice TS-2025-1123 - HR Steel Coils 12MT",
                "head": "Raw Materials",
                "status": TransactionStatus.accepted,
                "extracted_data": {"invoice_number": "TS-2025-1123", "quantity": "12MT"},
            },
            {
                "party_name": "MSEDCL",
                "amount": 98400.00,
                "date": date(2025, 4, 15),
                "description": "Electricity bill - March 2025",
                "head": "Utilities",
                "status": TransactionStatus.accepted,
                "extracted_data": {"bill_period": "March 2025", "units": 24600},
            },
            {
                "party_name": "Blue Dart Express",
                "amount": 43200.00,
                "date": date(2025, 4, 10),
                "description": "Outbound freight - Q1 dispatch",
                "head": "Logistics",
                "status": TransactionStatus.pending_review,
                "extracted_data": {"consignments": 14},
            },
            {
                "party_name": "April 2025 Factory Payroll",
                "amount": 2240000.00,
                "date": date(2025, 4, 30),
                "description": "Salary register - 42 factory workers",
                "head": "Payroll",
                "status": TransactionStatus.pending_review,
                "extracted_data": {"employee_count": 42, "month": "April 2025"},
            },
        ])

        # ── Reports ───────────────────────────────────────────
        print("[10] Seeding reports...")
        seed_report(db, techcorp, acc1, "Q1 2025 MIS Report - TechCorp", "techcorp_q1_2025_mis.txt")
        seed_report(db, manufab, acc1, "March 2025 Production Cost Report", "manufab_march_2025.txt")

        db.commit()

        print("\n=== Seed complete! ===\n")
        print("Demo credentials:")
        print("  Platform Admin:  admin@finbridge.com     / Admin@123")
        print("  Firm Admin:      firm@apexaccounting.com / Firm@1234")
        print("  Accountant 1:    accountant1@apex.com    / Acc@1234")
        print("  Accountant 2:    accountant2@apex.com    / Acc@1234")
        print("  TechCorp Admin:  admin@techcorp.com      / Tech@1234")
        print("  TechCorp User:   user@techcorp.com       / Tech@1234")
        print("  ManuFab Admin:   admin@manufab.com       / Manu@1234")
        print("")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
