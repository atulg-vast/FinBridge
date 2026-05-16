#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FinBridge Demo Seed Script - Jan 2026 to May 15, 2026
Run from backend/: python seed_demo.py
Credentials: all users -> Demo@1234  |  platform admin -> admin@finbridge.com
"""
import sys, uuid, random, warnings
warnings.filterwarnings("ignore")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from datetime import date, datetime, timezone
from decimal import Decimal

sys.path.insert(0, ".")
random.seed(42)

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.firm import AccountingFirm
from app.models.company import Company, BusinessType
from app.models.document import Document, DocumentStatus
from app.models.document_type import DocumentType
from app.models.transaction import Transaction, TransactionStatus
from app.models.payment import PaymentHead, PaymentSubHead
from app.models.audit import AuditLog
from app.models.report import Report
from app.services.auth_service import hash_password

db = SessionLocal()
PASSWORD = hash_password("Demo@1234")

def uid():
    return uuid.uuid4()

def ts(yr, mo, dy, hr=10, mn=0):
    return datetime(yr, mo, dy, hr, mn, 0, tzinfo=timezone.utc)

def on(d: date, hr=10, mn=0):
    return datetime(d.year, d.month, d.day, hr, mn, 0, tzinfo=timezone.utc)

def log(user_id, action, entity_type, entity_id=None, company_id=None, meta=None, at=None):
    db.add(AuditLog(
        id=uid(),
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        company_id=company_id,
        meta=meta or {},
        created_at=at or datetime.now(timezone.utc),
    ))

print("\n🌱  FinBridge Demo Seed — Jan–May 2026\n")

# ─────────────────────────────────────────────────────────────────────────────
# GUARD: skip if already seeded
# ─────────────────────────────────────────────────────────────────────────────
if db.query(AccountingFirm).filter(AccountingFirm.slug == "apex-advisors").first():
    print("⚠  Seed data already present (Apex Advisors found). Aborting to avoid duplicates.")
    print("   To reseed: truncate the relevant tables first.\n")
    sys.exit(0)

# ─────────────────────────────────────────────────────────────────────────────
# PLATFORM ADMIN
# ─────────────────────────────────────────────────────────────────────────────
plat = db.query(User).filter(User.email == "admin@finbridge.com").first()
if not plat:
    plat = User(id=uid(), email="admin@finbridge.com", full_name="Platform Admin",
                password_hash=PASSWORD, role=UserRole.platform_admin,
                created_at=ts(2026, 1, 1))
    db.add(plat)
    db.flush()
    print("  ✓ Platform admin  admin@finbridge.com")

# ─────────────────────────────────────────────────────────────────────────────
# FIRM 1 — APEX ADVISORS
# ─────────────────────────────────────────────────────────────────────────────
apex = AccountingFirm(id=uid(), name="Apex Advisors", slug="apex-advisors",
                      created_at=ts(2026, 1, 2))
db.add(apex)
db.flush()
log(plat.id, "firm_created", "firm", apex.id, meta={"firm_name": "Apex Advisors",
    "admin_email": "admin@apex.com"}, at=ts(2026, 1, 2))

apex_admin = User(id=uid(), email="admin@apex.com", full_name="Vikram Mehta",
                  password_hash=PASSWORD, role=UserRole.firm_admin, firm_id=apex.id,
                  created_at=ts(2026, 1, 2))
db.add(apex_admin); db.flush()

raj = User(id=uid(), email="raj.kumar@apex.com", full_name="Raj Kumar",
           password_hash=PASSWORD, role=UserRole.accountant, firm_id=apex.id,
           created_at=ts(2026, 1, 3))
db.add(raj); db.flush()
log(apex_admin.id, "accountant_added", "user", raj.id,
    meta={"email": "raj.kumar@apex.com", "full_name": "Raj Kumar"}, at=ts(2026, 1, 3))

priya = User(id=uid(), email="priya.sharma@apex.com", full_name="Priya Sharma",
             password_hash=PASSWORD, role=UserRole.accountant, firm_id=apex.id,
             created_at=ts(2026, 1, 5))
db.add(priya); db.flush()
log(apex_admin.id, "accountant_added", "user", priya.id,
    meta={"email": "priya.sharma@apex.com", "full_name": "Priya Sharma"}, at=ts(2026, 1, 5))

print("  ✓ Firm: Apex Advisors  (admin@apex.com, raj.kumar@apex.com, priya.sharma@apex.com)")

# ─────────────────────────────────────────────────────────────────────────────
# FIRM 2 — BLUESTAR CONSULTING
# ─────────────────────────────────────────────────────────────────────────────
bstar = AccountingFirm(id=uid(), name="BlueStar Consulting", slug="bluestar-consulting",
                       created_at=ts(2026, 1, 10))
db.add(bstar)
db.flush()
log(plat.id, "firm_created", "firm", bstar.id, meta={"firm_name": "BlueStar Consulting",
    "admin_email": "admin@bluestar.com"}, at=ts(2026, 1, 10))

bs_admin = User(id=uid(), email="admin@bluestar.com", full_name="Kavitha Reddy",
                password_hash=PASSWORD, role=UserRole.firm_admin, firm_id=bstar.id,
                created_at=ts(2026, 1, 10))
db.add(bs_admin); db.flush()

amit = User(id=uid(), email="amit.patel@bluestar.com", full_name="Amit Patel",
            password_hash=PASSWORD, role=UserRole.accountant, firm_id=bstar.id,
            created_at=ts(2026, 1, 11))
db.add(amit); db.flush()
log(bs_admin.id, "accountant_added", "user", amit.id,
    meta={"email": "amit.patel@bluestar.com", "full_name": "Amit Patel"}, at=ts(2026, 1, 11))

print("  ✓ Firm: BlueStar Consulting  (admin@bluestar.com, amit.patel@bluestar.com)")
db.flush()

# ─────────────────────────────────────────────────────────────────────────────
# COMPANIES
# ─────────────────────────────────────────────────────────────────────────────
def make_company(firm, firm_admin, name, btype, admin_email, admin_name, user_email,
                 user_name, created_on):
    co = Company(id=uid(), firm_id=firm.id, name=name, business_type=btype,
                 created_at=on(created_on))
    db.add(co); db.flush()
    log(firm_admin.id, "company_created", "company", co.id, co.id,
        {"company_name": name, "business_type": btype.value, "admin_email": admin_email},
        at=on(created_on))

    co_admin = User(id=uid(), email=admin_email, full_name=admin_name, password_hash=PASSWORD,
                    role=UserRole.company_admin, firm_id=firm.id, company_id=co.id,
                    created_at=on(created_on))
    db.add(co_admin); db.flush()

    co_user = User(id=uid(), email=user_email, full_name=user_name, password_hash=PASSWORD,
                   role=UserRole.company_user, firm_id=firm.id, company_id=co.id,
                   created_at=on(created_on))
    db.add(co_user); db.flush()
    log(co_admin.id, "company_user_added", "user", co_user.id, co.id,
        {"email": user_email, "full_name": user_name}, at=on(created_on))
    return co, co_admin, co_user

technova, tn_admin, tn_user = make_company(
    apex, apex_admin, "TechNova Solutions", BusinessType.it,
    "admin@technova.com", "Ananya Singh",
    "finance@technova.com", "Ravi Patel", date(2026, 1, 4))

greenleaf, gl_admin, gl_user = make_company(
    apex, apex_admin, "GreenLeaf Organics", BusinessType.manufacturing,
    "admin@greenleaf.com", "Suresh Nair",
    "accounts@greenleaf.com", "Meena Rao", date(2026, 1, 6))

buildright, br_admin, br_user = make_company(
    apex, apex_admin, "BuildRight Infra", BusinessType.services,
    "admin@buildright.com", "Deepak Joshi",
    "finance@buildright.com", "Kavya Iyer", date(2026, 1, 8))

stylehub, sh_admin, sh_user = make_company(
    bstar, bs_admin, "StyleHub Retail", BusinessType.trading,
    "admin@stylehub.com", "Neha Kapoor",
    "accounts@stylehub.com", "Sanjay Das", date(2026, 1, 12))

medcore, mc_admin, mc_user = make_company(
    bstar, bs_admin, "MedCore Pharma", BusinessType.manufacturing,
    "admin@medcore.com", "Dr. Arjun Verma",
    "finance@medcore.com", "Preethi Nambiar", date(2026, 1, 15))

print("  ✓ Companies: TechNova, GreenLeaf, BuildRight, StyleHub, MedCore")
db.flush()

# ─────────────────────────────────────────────────────────────────────────────
# PAYMENT HEADS
# ─────────────────────────────────────────────────────────────────────────────
HEAD_DEFS = {
    technova.id: [
        ("Software & Licenses",    ["SaaS Subscriptions", "Enterprise Licenses"]),
        ("Cloud & Infrastructure", ["AWS", "Azure", "Google Cloud"]),
        ("Salaries & Benefits",    ["Employee Salaries", "Contractor Payments"]),
        ("Office & Admin",         ["Office Rent", "Utilities", "Office Supplies"]),
        ("Travel & Conferences",   ["Domestic Travel", "Conference Fees"]),
    ],
    greenleaf.id: [
        ("Raw Materials",          ["Agricultural Inputs", "Packaging Materials"]),
        ("Manufacturing",          ["Machinery Maintenance", "Factory Utilities"]),
        ("Salaries & Benefits",    ["Employee Salaries", "Contract Labour"]),
        ("Logistics",              ["Inbound Freight", "Outbound Freight"]),
        ("Marketing & Sales",      ["Digital Marketing", "Trade Shows"]),
    ],
    buildright.id: [
        ("Project Materials",      ["Construction Materials", "Safety Equipment"]),
        ("Labour & Contracts",     ["Site Labour", "Subcontractors"]),
        ("Salaries & Benefits",    ["Employee Salaries", "Site Supervisor Pay"]),
        ("Equipment Hire",         ["Crane Hire", "Vehicle Hire"]),
        ("Site Overhead",          ["Site Utilities", "Permits & Fees"]),
    ],
    stylehub.id: [
        ("Inventory & Merchandise", ["Fashion Apparel", "Accessories", "Footwear"]),
        ("Store Operations",        ["Store Rent", "Visual Merchandising"]),
        ("Salaries & Benefits",     ["Employee Salaries", "Sales Staff"]),
        ("Marketing",               ["Social Media Ads", "Influencer Campaigns"]),
        ("Logistics",               ["Last Mile Delivery", "Warehouse"]),
    ],
    medcore.id: [
        ("Raw Materials & APIs",     ["Active Pharmaceutical Ingredients", "Excipients"]),
        ("Manufacturing & QC",       ["Production Utilities", "Quality Control"]),
        ("Salaries & Benefits",      ["Employee Salaries", "R&D Staff"]),
        ("Regulatory & Compliance",  ["CDSCO Fees", "Certification Costs"]),
        ("Distribution",             ["Cold Chain Logistics", "Distributor Margins"]),
    ],
}

head_map = {}  # company_id -> {head_name -> PaymentHead}
admin_map = {
    technova.id: tn_admin, greenleaf.id: gl_admin, buildright.id: br_admin,
    stylehub.id: sh_admin, medcore.id: mc_admin,
}
created_on_map = {
    technova.id: ts(2026, 1, 10), greenleaf.id: ts(2026, 1, 12),
    buildright.id: ts(2026, 1, 14), stylehub.id: ts(2026, 1, 16),
    medcore.id: ts(2026, 1, 18),
}

for co_id, defs in HEAD_DEFS.items():
    head_map[co_id] = {}
    co_admin = admin_map[co_id]
    at = created_on_map[co_id]
    for head_name, sub_names in defs:
        h = PaymentHead(id=uid(), company_id=co_id, name=head_name, created_at=at)
        db.add(h); db.flush()
        log(co_admin.id, "payment_head_created", "payment_head", h.id, co_id,
            {"name": head_name}, at=at)
        head_map[co_id][head_name] = h
        for sn in sub_names:
            s = PaymentSubHead(id=uid(), head_id=h.id, company_id=co_id, name=sn, created_at=at)
            db.add(s); db.flush()
            log(co_admin.id, "payment_sub_head_created", "payment_head", s.id, co_id,
                {"name": sn, "head_name": head_name}, at=at)

db.commit()
print("  ✓ Payment heads & sub-heads created")

# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT TYPES — use existing, fallback minimal
# ─────────────────────────────────────────────────────────────────────────────
doc_types = {dt.slug: dt for dt in db.query(DocumentType).all()}

if not doc_types:
    MINIMAL_TYPES = [
        ("Purchase Invoice", "invoice_purchase",
         "Extract structured data from this purchase invoice.",
         {"vendor_name": {"type": "string"}, "invoice_number": {"type": "string"},
          "invoice_date": {"type": "string"}, "total_amount": {"type": "number"},
          "gst_amount": {"type": "number"}}),
        ("Bank Statement", "bank_statement",
         "Extract each transaction row from this bank statement.",
         {"transaction_date": {"type": "string"}, "narration": {"type": "string"},
          "debit": {"type": "number"}, "credit": {"type": "number"}, "balance": {"type": "number"}}),
        ("Salary Register", "salary_register",
         "Extract per-employee salary data from this salary register.",
         {"employee_name": {"type": "string"}, "employee_id": {"type": "string"},
          "basic_pay": {"type": "number"}, "net_pay": {"type": "number"}}),
        ("Payment Receipt", "payment_receipt",
         "Extract payment details from this receipt.",
         {"payer": {"type": "string"}, "payee": {"type": "string"},
          "amount": {"type": "number"}, "payment_date": {"type": "string"}}),
    ]
    for name, slug, prompt, fields in MINIMAL_TYPES:
        dt_obj = DocumentType(id=uid(), name=name, slug=slug,
                              extraction_prompt_template=prompt, expected_fields=fields,
                              accepted_file_formats=["pdf", "jpg", "jpeg", "png"])
        db.add(dt_obj)
    db.commit()
    doc_types = {dt.slug: dt for dt in db.query(DocumentType).all()}
    print("  ✓ Document types created (minimal)")
else:
    print(f"  ✓ Using {len(doc_types)} existing document types")

inv_type  = doc_types.get("invoice_purchase") or next(iter(doc_types.values()))
bank_type = doc_types.get("bank_statement", inv_type)
sal_type  = doc_types.get("salary_register", inv_type)

# ─────────────────────────────────────────────────────────────────────────────
# HELPER: create document + transactions
# ─────────────────────────────────────────────────────────────────────────────
def make_txn(company, uploader, doc, txn_date, party, amount, head_name,
             reviewer, status, rejection_note=None, review_offset_days=7):
    h = head_map.get(company.id, {}).get(head_name)
    reviewed_at = None
    if status in (TransactionStatus.accepted, TransactionStatus.rejected):
        rd = txn_date.replace(day=min(txn_date.day + review_offset_days, 28))
        reviewed_at = datetime(rd.year, rd.month, rd.day, 11, random.randint(0, 59),
                               0, tzinfo=timezone.utc)
    confidence = round(random.uniform(0.78, 0.99), 2)
    low_conf = ["amount"] if confidence < 0.85 else []

    t = Transaction(
        id=uid(), document_id=doc.id, company_id=company.id,
        head_id=h.id if h else None,
        party_name=party, amount=Decimal(str(amount)),
        transaction_date=txn_date,
        description=f"Payment to {party}",
        confidence_score=Decimal(str(confidence)),
        low_confidence_fields=low_conf,
        status=status,
        reviewed_by=reviewer.id if reviewer else None,
        reviewed_at=reviewed_at,
        created_at=on(txn_date, 14),
    )
    db.add(t); db.flush()

    if status == TransactionStatus.accepted:
        log(reviewer.id, "transaction_accepted", "transaction", t.id, company.id,
            {"party_name": party, "amount": str(amount)}, at=reviewed_at)
    elif status == TransactionStatus.rejected:
        t.rejection_note = rejection_note or "Duplicate or incorrect details provided."
        log(reviewer.id, "transaction_rejected", "transaction", t.id, company.id,
            {"party_name": party, "rejection_note": t.rejection_note}, at=reviewed_at)
    return t

def make_doc(company, uploader, doc_type, filename, upload_date):
    f_id = uid()
    d = Document(
        id=f_id, company_id=company.id, uploaded_by=uploader.id,
        document_type_id=doc_type.id,
        file_path=f"uploads/{company.id}/{f_id}.pdf",
        original_filename=filename,
        status=DocumentStatus.extracted,
        created_at=on(upload_date, 9),
    )
    db.add(d); db.flush()
    log(uploader.id, "document_uploaded", "document", d.id, company.id,
        {"filename": filename, "document_type": doc_type.name}, at=on(upload_date, 9))
    log(uploader.id, "document_extracted", "document", d.id, company.id,
        {"filename": filename, "transactions_created": 0}, at=on(upload_date, 10))
    return d

# ─────────────────────────────────────────────────────────────────────────────
# TECHNOVA SOLUTIONS — IT company, high volume
# ─────────────────────────────────────────────────────────────────────────────
print("\n  → TechNova Solutions")
A, P, R = TransactionStatus.accepted, TransactionStatus.pending_review, TransactionStatus.rejected

tn_txns = [
    # (upload_date, txn_date, filename, doctype, party, amount, head, reviewer, status, rej_note)
    (date(2026, 1, 7),  date(2026, 1, 5),  "aws-jan-invoice.pdf",       inv_type, "Amazon Web Services India", 284000, "Cloud & Infrastructure", raj,   A, None),
    (date(2026, 1, 10), date(2026, 1, 8),  "microsoft-365-jan.pdf",     inv_type, "Microsoft India Pvt Ltd",  125000, "Software & Licenses",    raj,   A, None),
    (date(2026, 1, 18), date(2026, 1, 15), "infosys-consulting-jan.pdf",inv_type, "Infosys BPO Ltd",          520000, "Software & Licenses",    raj,   R, "Invoice number missing; vendor to resubmit."),
    (date(2026, 1, 22), date(2026, 1, 20), "office-rent-jan.pdf",       inv_type, "WeWork India Mgmt Pvt Ltd",195000, "Office & Admin",         priya, A, None),
    (date(2026, 2, 5),  date(2026, 2, 3),  "aws-feb-invoice.pdf",       inv_type, "Amazon Web Services India",310000, "Cloud & Infrastructure", raj,   A, None),
    (date(2026, 2, 10), date(2026, 2, 8),  "github-enterprise-feb.pdf", inv_type, "GitHub Inc",               78000,  "Software & Licenses",    priya, A, None),
    (date(2026, 2, 18), date(2026, 2, 15), "freshworks-feb.pdf",        inv_type, "Freshworks Technologies",  145000, "Software & Licenses",    priya, R, "GST number on invoice doesn't match vendor PAN."),
    (date(2026, 2, 25), date(2026, 2, 22), "travel-bangalore-feb.pdf",  inv_type, "MakeMyTrip Corporate",     62000,  "Travel & Conferences",   raj,   A, None),
    (date(2026, 3, 6),  date(2026, 3, 4),  "aws-mar-invoice.pdf",       inv_type, "Amazon Web Services India",298000, "Cloud & Infrastructure", priya, A, None),
    (date(2026, 3, 15), date(2026, 3, 12), "atlassian-mar.pdf",         inv_type, "Atlassian Pty Ltd",        89000,  "Software & Licenses",    priya, A, None),
    (date(2026, 3, 20), date(2026, 3, 18), "office-supplies-mar.pdf",   inv_type, "Staples India",            18500,  "Office & Admin",         None,  P, None),
    (date(2026, 4, 5),  date(2026, 4, 3),  "aws-apr-invoice.pdf",       inv_type, "Amazon Web Services India",322000, "Cloud & Infrastructure", raj,   A, None),
    (date(2026, 4, 12), date(2026, 4, 10), "zoho-suite-apr.pdf",        inv_type, "Zoho Corporation Pvt Ltd", 95000,  "Software & Licenses",    raj,   R, "Amount mismatch between PO and invoice."),
    (date(2026, 4, 20), date(2026, 4, 18), "aws-support-apr.pdf",       inv_type, "Amazon Web Services India",45000,  "Cloud & Infrastructure", None,  P, None),
    (date(2026, 5, 5),  date(2026, 5, 3),  "microsoft-may.pdf",         inv_type, "Microsoft India Pvt Ltd",  130000, "Software & Licenses",    None,  P, None),
    (date(2026, 5, 10), date(2026, 5, 8),  "postman-may.pdf",           inv_type, "Postman Technologies",     42000,  "Software & Licenses",    None,  P, None),
    (date(2026, 5, 13), date(2026, 5, 12), "conference-google-may.pdf", inv_type, "Google India Pvt Ltd",     180000, "Travel & Conferences",   None,  P, None),
]
for udate, tdate, fname, dtype, party, amount, head, reviewer, status, rej in tn_txns:
    doc = make_doc(technova, tn_admin if random.random() > 0.4 else tn_user, dtype, fname, udate)
    make_txn(technova, tn_admin, doc, tdate, party, amount, head, reviewer, status, rej)

# ─────────────────────────────────────────────────────────────────────────────
# GREENLEAF ORGANICS — Manufacturing
# ─────────────────────────────────────────────────────────────────────────────
print("  → GreenLeaf Organics")
gl_txns = [
    (date(2026, 1, 8),  date(2026, 1, 6),  "adani-agri-jan.pdf",       inv_type, "Adani Agri Logistics",      580000, "Raw Materials",       raj,   A, None),
    (date(2026, 1, 18), date(2026, 1, 15), "jain-irrigation-jan.pdf",  inv_type, "Jain Irrigation Systems",   240000, "Manufacturing",       priya, R, "Delivery challan date doesn't match invoice."),
    (date(2026, 2, 7),  date(2026, 2, 5),  "iffco-feb.pdf",            inv_type, "IFFCO Tokio General",       370000, "Raw Materials",       raj,   A, None),
    (date(2026, 2, 18), date(2026, 2, 15), "packaging-feb.pdf",        inv_type, "Uflex Packaging Ltd",       125000, "Raw Materials",       priya, A, None),
    (date(2026, 2, 25), date(2026, 2, 22), "logistics-delhivery-feb.pdf",inv_type,"Delhivery Ltd",            88000,  "Logistics",           None,  P, None),
    (date(2026, 3, 10), date(2026, 3, 8),  "machinery-maint-mar.pdf",  inv_type, "Grauer & Weil India",       210000, "Manufacturing",       raj,   A, None),
    (date(2026, 3, 20), date(2026, 3, 18), "amul-raw-mar.pdf",         inv_type, "Amul (GCMMF)",              430000, "Raw Materials",       priya, R, "Invoice raised in previous FY. Needs fresh invoice."),
    (date(2026, 4, 8),  date(2026, 4, 6),  "factory-utility-apr.pdf",  inv_type, "MSEDCL (Electricity Board)",95000,  "Manufacturing",       priya, A, None),
    (date(2026, 4, 18), date(2026, 4, 15), "bluedart-logistic-apr.pdf",inv_type, "Blue Dart Express Ltd",     72000,  "Logistics",           None,  P, None),
    (date(2026, 5, 6),  date(2026, 5, 4),  "packaging-may.pdf",        inv_type, "Uflex Packaging Ltd",       138000, "Raw Materials",       None,  P, None),
    (date(2026, 5, 12), date(2026, 5, 10), "trade-show-may.pdf",       inv_type, "India Food Show Pvt Ltd",   95000,  "Marketing & Sales",   None,  P, None),
]
for udate, tdate, fname, dtype, party, amount, head, reviewer, status, rej in gl_txns:
    doc = make_doc(greenleaf, gl_admin if random.random() > 0.4 else gl_user, dtype, fname, udate)
    make_txn(greenleaf, gl_admin, doc, tdate, party, amount, head, reviewer, status, rej)

# ─────────────────────────────────────────────────────────────────────────────
# BUILDRIGHT INFRA — Services/Construction
# ─────────────────────────────────────────────────────────────────────────────
print("  → BuildRight Infra")
br_txns = [
    (date(2026, 1, 12), date(2026, 1, 10), "ultratech-cement-jan.pdf", inv_type, "UltraTech Cement Ltd",     920000, "Project Materials",  priya, A, None),
    (date(2026, 1, 22), date(2026, 1, 20), "labour-contract-jan.pdf",  inv_type, "Suresh Labour Contractors", 380000, "Labour & Contracts", None,  P, None),
    (date(2026, 2, 8),  date(2026, 2, 6),  "jsw-steel-feb.pdf",        inv_type, "JSW Steel Ltd",             1250000,"Project Materials",  priya, A, None),
    (date(2026, 2, 18), date(2026, 2, 15), "crane-hire-feb.pdf",       inv_type, "Sanghvi Movers Ltd",        185000, "Equipment Hire",     priya, R, "PO number not referenced in invoice."),
    (date(2026, 3, 5),  date(2026, 3, 3),  "acc-cement-mar.pdf",       inv_type, "ACC Ltd",                   745000, "Project Materials",  priya, A, None),
    (date(2026, 3, 18), date(2026, 3, 15), "site-utilities-mar.pdf",   inv_type, "BSES Rajdhani Power Ltd",   48000,  "Site Overhead",      None,  P, None),
    (date(2026, 4, 7),  date(2026, 4, 5),  "tata-steel-apr.pdf",       inv_type, "Tata Steel Ltd",            890000, "Project Materials",  priya, A, None),
    (date(2026, 4, 15), date(2026, 4, 12), "vehicle-hire-apr.pdf",     inv_type, "Myles Automotive Pvt Ltd",  125000, "Equipment Hire",     priya, R, "Vehicle registration not matching hire agreement."),
    (date(2026, 4, 22), date(2026, 4, 20), "subcontract-apr.pdf",      inv_type, "Larsen & Toubro Ltd",       620000, "Labour & Contracts", None,  P, None),
    (date(2026, 5, 8),  date(2026, 5, 6),  "safety-gear-may.pdf",      inv_type, "3M India Ltd",              67000,  "Project Materials",  None,  P, None),
]
for udate, tdate, fname, dtype, party, amount, head, reviewer, status, rej in br_txns:
    doc = make_doc(buildright, br_admin if random.random() > 0.4 else br_user, dtype, fname, udate)
    make_txn(buildright, br_admin, doc, tdate, party, amount, head, reviewer, status, rej)

# ─────────────────────────────────────────────────────────────────────────────
# STYLEHUB RETAIL — Trading
# ─────────────────────────────────────────────────────────────────────────────
print("  → StyleHub Retail")
sh_txns = [
    (date(2026, 1, 14), date(2026, 1, 12), "raymond-inv-jan.pdf",      inv_type, "Raymond Ltd",               780000, "Inventory & Merchandise", amit, A, None),
    (date(2026, 1, 24), date(2026, 1, 22), "store-rent-jan.pdf",       inv_type, "Phoenix Marketcity Mall",   420000, "Store Operations",        amit, A, None),
    (date(2026, 2, 10), date(2026, 2, 8),  "fabindia-feb.pdf",         inv_type, "Fabindia Overseas Pvt Ltd", 520000, "Inventory & Merchandise", amit, A, None),
    (date(2026, 2, 20), date(2026, 2, 18), "influencer-feb.pdf",       inv_type, "Social Beat Digital Agency",185000, "Marketing",               amit, R, "Work completion certificate not attached."),
    (date(2026, 3, 8),  date(2026, 3, 6),  "arvind-fashion-mar.pdf",   inv_type, "Arvind Fashions Ltd",       960000, "Inventory & Merchandise", amit, A, None),
    (date(2026, 3, 18), date(2026, 3, 15), "delhivery-sh-mar.pdf",     inv_type, "Delhivery Ltd",             145000, "Logistics",               amit, A, None),
    (date(2026, 3, 28), date(2026, 3, 25), "visual-merch-mar.pdf",     inv_type, "InVogue Display Solutions", 78000,  "Store Operations",        None, P, None),
    (date(2026, 4, 10), date(2026, 4, 8),  "bombay-dyeing-apr.pdf",    inv_type, "Bombay Dyeing & Mfg",       620000, "Inventory & Merchandise", amit, A, None),
    (date(2026, 4, 22), date(2026, 4, 20), "instagram-ads-apr.pdf",    inv_type, "Meta Platforms Inc",         92000,  "Marketing",               amit, R, "Invoice currency is USD, needs INR equivalent certificate."),
    (date(2026, 5, 5),  date(2026, 5, 3),  "store-rent-may.pdf",       inv_type, "Phoenix Marketcity Mall",   420000, "Store Operations",        amit, A, None),
    (date(2026, 5, 12), date(2026, 5, 10), "accessory-may.pdf",        inv_type, "Titan Company Ltd",         310000, "Inventory & Merchandise", None, P, None),
    (date(2026, 5, 14), date(2026, 5, 13), "logistics-may.pdf",        inv_type, "Blue Dart Express Ltd",     88000,  "Logistics",               None, P, None),
]
for udate, tdate, fname, dtype, party, amount, head, reviewer, status, rej in sh_txns:
    doc = make_doc(stylehub, sh_admin if random.random() > 0.4 else sh_user, dtype, fname, udate)
    make_txn(stylehub, sh_admin, doc, tdate, party, amount, head, reviewer, status, rej)

# ─────────────────────────────────────────────────────────────────────────────
# MEDCORE PHARMA — Manufacturing/Pharma
# ─────────────────────────────────────────────────────────────────────────────
print("  → MedCore Pharma")
mc_txns = [
    (date(2026, 1, 18), date(2026, 1, 16), "sun-pharma-api-jan.pdf",   inv_type, "Sun Pharmaceutical Industries", 1850000,"Raw Materials & APIs",    amit, A, None),
    (date(2026, 2, 6),  date(2026, 2, 4),  "divi-labs-feb.pdf",        inv_type, "Divi's Laboratories Ltd",       2200000,"Raw Materials & APIs",    amit, A, None),
    (date(2026, 2, 20), date(2026, 2, 18), "cdsco-fees-feb.pdf",       inv_type, "CDSCO (Govt of India)",         85000,  "Regulatory & Compliance", amit, R, "Fee challan reference number missing from invoice."),
    (date(2026, 3, 10), date(2026, 3, 8),  "cipla-api-mar.pdf",        inv_type, "Cipla Ltd",                     1650000,"Raw Materials & APIs",    amit, A, None),
    (date(2026, 3, 22), date(2026, 3, 20), "quality-lab-mar.pdf",      inv_type, "SRL Diagnostics Ltd",           320000, "Manufacturing & QC",      amit, A, None),
    (date(2026, 4, 8),  date(2026, 4, 6),  "cold-chain-apr.pdf",       inv_type, "Snowman Logistics Ltd",         480000, "Distribution",            None, P, None),
    (date(2026, 4, 18), date(2026, 4, 16), "lupin-api-apr.pdf",        inv_type, "Lupin Ltd",                     1420000,"Raw Materials & APIs",    None, P, None),
    (date(2026, 5, 8),  date(2026, 5, 6),  "rd-staff-may.pdf",         inv_type, "Randstad India Pvt Ltd",        560000, "Salaries & Benefits",     None, P, None),
    (date(2026, 5, 13), date(2026, 5, 12), "certification-may.pdf",    inv_type, "Bureau Veritas India",          145000, "Regulatory & Compliance", None, P, None),
]
for udate, tdate, fname, dtype, party, amount, head, reviewer, status, rej in mc_txns:
    doc = make_doc(medcore, mc_admin if random.random() > 0.4 else mc_user, dtype, fname, udate)
    make_txn(medcore, mc_admin, doc, tdate, party, amount, head, reviewer, status, rej)

db.commit()
print("\n  ✓ Documents and transactions created")

# ─────────────────────────────────────────────────────────────────────────────
# REPORTS — uploaded by accountants for each company
# ─────────────────────────────────────────────────────────────────────────────
REPORTS = [
    (technova, raj,   "TechNova Q1 2026 MIS Report",         "technova-q1-2026-mis.pdf",    date(2026, 4, 5)),
    (greenleaf, priya,"GreenLeaf Q1 2026 Expense Summary",   "greenleaf-q1-2026-expense.pdf",date(2026, 4, 8)),
    (buildright,priya,"BuildRight Project Cost Report Mar 26","buildright-mar-2026-costs.pdf",date(2026, 4, 10)),
    (stylehub,  amit, "StyleHub Q1 2026 Sales & Expense MIS","stylehub-q1-2026-mis.pdf",    date(2026, 4, 12)),
    (medcore,   amit, "MedCore Pharma Q1 2026 Financial MIS","medcore-q1-2026-mis.pdf",     date(2026, 4, 15)),
    (technova, raj,   "TechNova April 2026 Cloud Cost Review","technova-apr-2026-cloud.pdf", date(2026, 5, 3)),
    (stylehub,  amit, "StyleHub Summer Collection Cost Report","stylehub-summer-2026.pdf",   date(2026, 5, 8)),
]
for co, uploader, title, fname, udate in REPORTS:
    r_id = uid()
    r = Report(id=r_id, company_id=co.id, uploaded_by=uploader.id, title=title,
               file_path=f"reports/{co.id}/{r_id}.pdf", original_filename=fname,
               created_at=on(udate, 15))
    db.add(r); db.flush()
    log(uploader.id, "report_uploaded", "report", r.id, co.id,
        {"title": title, "filename": fname}, at=on(udate, 15))

db.commit()
print("  ✓ Reports uploaded")

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
from app.models.transaction import Transaction as T
txn_total = db.query(T).count()
acc_count = db.query(T).filter(T.status == TransactionStatus.accepted).count()
rej_count = db.query(T).filter(T.status == TransactionStatus.rejected).count()
pend_count = db.query(T).filter(T.status == TransactionStatus.pending_review).count()

print(f"""
╔══════════════════════════════════════════════════════╗
║           SEED COMPLETE — Demo Credentials           ║
╠══════════════════════════════════════════════════════╣
║  Platform Admin   admin@finbridge.com / Demo@1234    ║
╠══════════════════════════════════════════════════════╣
║  APEX ADVISORS                                       ║
║  Firm Admin       admin@apex.com / Demo@1234         ║
║  Accountant       raj.kumar@apex.com / Demo@1234     ║
║  Accountant       priya.sharma@apex.com / Demo@1234  ║
║  Company Admin    admin@technova.com / Demo@1234     ║
║  Company Admin    admin@greenleaf.com / Demo@1234    ║
║  Company Admin    admin@buildright.com / Demo@1234   ║
╠══════════════════════════════════════════════════════╣
║  BLUESTAR CONSULTING                                 ║
║  Firm Admin       admin@bluestar.com / Demo@1234     ║
║  Accountant       amit.patel@bluestar.com / Demo@1234║
║  Company Admin    admin@stylehub.com / Demo@1234     ║
║  Company Admin    admin@medcore.com / Demo@1234      ║
╠══════════════════════════════════════════════════════╣
║  Transactions: {txn_total:<5} Accepted: {acc_count:<4} Rejected: {rej_count:<4} Pending: {pend_count:<4} ║
║  Date range: Jan 5, 2026 → May 14, 2026              ║
╚══════════════════════════════════════════════════════╝
""")
db.close()
