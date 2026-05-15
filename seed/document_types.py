"""
Seed document_types table with AI extraction prompt templates.
Run after: python -m alembic upgrade head
Safe to re-run (idempotent via slug uniqueness check).
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from app.database import SessionLocal
from app.models.document_type import DocumentType

DOCUMENT_TYPES = [
    {
        "slug": "invoice_purchase",
        "name": "Purchase Invoice",
        "description": "Invoice received from a vendor for goods or services purchased",
        "accepted_file_formats": ["pdf", "jpg", "jpeg", "png"],
        "extraction_prompt_template": """You are a financial document extraction specialist working with Indian business invoices.
Extract all structured data from this purchase invoice with high accuracy.

Focus on:
- Vendor/supplier details: name, address, GSTIN
- Invoice number and date
- Line items: description, HSN/SAC code, quantity, unit price, amount
- Tax breakdown: CGST, SGST, IGST percentages and amounts
- Subtotal, total tax, and grand total
- Payment terms and due date if present

If any field is unclear or partially visible, extract your best reading and note low confidence.
Extract every line item separately — do not merge or summarize items.""",
        "expected_fields": {
            "vendor_name": {"type": "string", "required": True},
            "vendor_gstin": {"type": "string", "required": False},
            "vendor_address": {"type": "string", "required": False},
            "invoice_number": {"type": "string", "required": True},
            "invoice_date": {"type": "string", "format": "YYYY-MM-DD", "required": True},
            "due_date": {"type": "string", "format": "YYYY-MM-DD", "required": False},
            "line_items": {
                "type": "array",
                "items": {
                    "description": "string",
                    "hsn_code": "string",
                    "quantity": "number",
                    "unit_price": "number",
                    "amount": "number",
                    "tax_rate": "number"
                }
            },
            "subtotal": {"type": "number", "required": True},
            "cgst": {"type": "number", "required": False},
            "sgst": {"type": "number", "required": False},
            "igst": {"type": "number", "required": False},
            "total_tax": {"type": "number", "required": False},
            "total_amount": {"type": "number", "required": True},
            "currency": {"type": "string", "default": "INR"}
        },
    },
    {
        "slug": "invoice_sales",
        "name": "Sales Invoice",
        "description": "Invoice issued to a customer for goods or services sold",
        "accepted_file_formats": ["pdf", "jpg", "jpeg", "png"],
        "extraction_prompt_template": """You are a financial document extraction specialist working with Indian business invoices.
Extract all structured data from this sales invoice with high accuracy.

Focus on:
- Your company details and GSTIN (the seller)
- Customer/buyer details: name, address, GSTIN
- Invoice number and date
- Line items: description, HSN/SAC code, quantity, unit price, amount
- Tax breakdown: CGST, SGST, IGST
- Subtotal, total tax, and grand total

Extract every line item separately.""",
        "expected_fields": {
            "customer_name": {"type": "string", "required": True},
            "customer_gstin": {"type": "string", "required": False},
            "customer_address": {"type": "string", "required": False},
            "invoice_number": {"type": "string", "required": True},
            "invoice_date": {"type": "string", "format": "YYYY-MM-DD", "required": True},
            "line_items": {
                "type": "array",
                "items": {
                    "description": "string",
                    "hsn_code": "string",
                    "quantity": "number",
                    "unit_price": "number",
                    "amount": "number"
                }
            },
            "subtotal": {"type": "number", "required": True},
            "cgst": {"type": "number", "required": False},
            "sgst": {"type": "number", "required": False},
            "igst": {"type": "number", "required": False},
            "total_amount": {"type": "number", "required": True},
            "currency": {"type": "string", "default": "INR"}
        },
    },
    {
        "slug": "payment_receipt",
        "name": "Payment Receipt",
        "description": "Receipt confirming payment made or received",
        "accepted_file_formats": ["pdf", "jpg", "jpeg", "png"],
        "extraction_prompt_template": """You are a financial document extraction specialist.
Extract all structured data from this payment receipt.

Focus on:
- Payer name and details
- Payee/recipient name and details
- Payment amount and currency
- Payment date
- Payment mode: cash, cheque, NEFT, RTGS, UPI, etc.
- Reference/transaction number
- Purpose or description of payment
- Cheque number if applicable""",
        "expected_fields": {
            "payer_name": {"type": "string", "required": True},
            "payee_name": {"type": "string", "required": True},
            "amount": {"type": "number", "required": True},
            "currency": {"type": "string", "default": "INR"},
            "payment_date": {"type": "string", "format": "YYYY-MM-DD", "required": True},
            "payment_mode": {"type": "string", "required": True},
            "reference_number": {"type": "string", "required": False},
            "cheque_number": {"type": "string", "required": False},
            "description": {"type": "string", "required": False}
        },
    },
    {
        "slug": "salary_register",
        "name": "Salary Register",
        "description": "Monthly salary register listing all employees and their pay components",
        "accepted_file_formats": ["pdf", "jpg", "jpeg", "png"],
        "extraction_prompt_template": """You are a financial document extraction specialist working with Indian payroll documents.
Extract all structured data from this salary register.

For each employee row, extract:
- Employee name and employee ID/code
- Department or designation if shown
- Basic salary
- HRA (House Rent Allowance)
- Other allowances (list each separately if named)
- PF deduction (Provident Fund)
- Professional tax deduction
- TDS deduction
- Other deductions
- Gross salary
- Net pay (take-home)

Extract every employee as a separate record. Do not aggregate or summarize.""",
        "expected_fields": {
            "month_year": {"type": "string", "required": False},
            "employees": {
                "type": "array",
                "items": {
                    "employee_name": "string",
                    "employee_id": "string",
                    "department": "string",
                    "basic": "number",
                    "hra": "number",
                    "other_allowances": "number",
                    "gross_salary": "number",
                    "pf_deduction": "number",
                    "professional_tax": "number",
                    "tds": "number",
                    "other_deductions": "number",
                    "net_pay": "number"
                }
            },
            "total_gross": {"type": "number", "required": False},
            "total_net": {"type": "number", "required": False}
        },
    },
    {
        "slug": "bank_statement",
        "name": "Bank Statement",
        "description": "Bank account statement showing all transactions for a period",
        "accepted_file_formats": ["pdf", "jpg", "jpeg", "png"],
        "extraction_prompt_template": """You are a financial document extraction specialist.
Extract all structured data from this bank statement.

For each transaction row, extract:
- Transaction date
- Value date if different
- Narration or description
- Cheque number if applicable
- Debit amount (if it's a debit transaction)
- Credit amount (if it's a credit transaction)
- Running balance after the transaction

Also extract:
- Account holder name
- Account number (last 4 digits only for security)
- Bank name and branch
- Statement period (from date, to date)
- Opening balance
- Closing balance

Extract every transaction as a separate record.""",
        "expected_fields": {
            "account_holder": {"type": "string", "required": False},
            "account_number_last4": {"type": "string", "required": False},
            "bank_name": {"type": "string", "required": False},
            "statement_from": {"type": "string", "format": "YYYY-MM-DD", "required": False},
            "statement_to": {"type": "string", "format": "YYYY-MM-DD", "required": False},
            "opening_balance": {"type": "number", "required": False},
            "closing_balance": {"type": "number", "required": False},
            "transactions": {
                "type": "array",
                "items": {
                    "date": "string",
                    "narration": "string",
                    "cheque_number": "string",
                    "debit": "number",
                    "credit": "number",
                    "balance": "number"
                }
            }
        },
    },
    {
        "slug": "transaction_ledger",
        "name": "Transaction Ledger",
        "description": "Account ledger showing debits, credits and running balance",
        "accepted_file_formats": ["pdf", "jpg", "jpeg", "png"],
        "extraction_prompt_template": """You are a financial document extraction specialist.
Extract all structured data from this transaction ledger.

For each ledger entry, extract:
- Date of transaction
- Ledger account name
- Narration or description
- Debit amount
- Credit amount
- Running closing balance

Also extract:
- Ledger name / account name at the top
- Period covered
- Opening balance""",
        "expected_fields": {
            "ledger_name": {"type": "string", "required": False},
            "period_from": {"type": "string", "required": False},
            "period_to": {"type": "string", "required": False},
            "opening_balance": {"type": "number", "required": False},
            "entries": {
                "type": "array",
                "items": {
                    "date": "string",
                    "account": "string",
                    "narration": "string",
                    "debit": "number",
                    "credit": "number",
                    "closing_balance": "number"
                }
            },
            "total_debit": {"type": "number", "required": False},
            "total_credit": {"type": "number", "required": False}
        },
    },
]


def seed():
    db = SessionLocal()
    try:
        created = 0
        skipped = 0
        for dt in DOCUMENT_TYPES:
            existing = db.query(DocumentType).filter(DocumentType.slug == dt["slug"]).first()
            if existing:
                skipped += 1
                continue
            doc_type = DocumentType(**dt)
            db.add(doc_type)
            created += 1
        db.commit()
        print(f"Document types seeded: {created} created, {skipped} already existed")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
