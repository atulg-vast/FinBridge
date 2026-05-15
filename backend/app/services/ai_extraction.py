"""
AI extraction service — Claude vision + tool_use.
Loads prompt template and expected_fields from document_types table,
builds tool schema dynamically, calls Claude, persists transactions.
"""
import uuid
import base64
import json
import os
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

import anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.document import Document, DocumentStatus
from app.models.document_type import DocumentType
from app.models.transaction import Transaction, TransactionLineItem, TransactionStatus
from app.services.notification_service import notify_firm_accountants, notify_company_users

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


# ── Schema builder ─────────────────────────────────────────

def _fields_to_tool_schema(expected_fields: dict) -> dict:
    """Convert expected_fields JSONB → Claude tool_use input_schema."""
    properties = {}
    required = []

    for field_name, field_def in expected_fields.items():
        if not isinstance(field_def, dict):
            continue

        ftype = field_def.get("type", "string")

        if ftype == "array":
            items_def = field_def.get("items", {})
            item_props = {}
            for k, v in items_def.items():
                item_props[k] = {"type": _map_type(v if isinstance(v, str) else "string")}
            properties[field_name] = {
                "type": "array",
                "items": {"type": "object", "properties": item_props},
                "description": field_def.get("description", f"List of {field_name}"),
            }
        else:
            prop: dict[str, Any] = {"type": _map_type(ftype)}
            if "format" in field_def:
                prop["description"] = f"Format: {field_def['format']}"
            if "default" in field_def:
                prop["description"] = prop.get("description", "") + f" Default: {field_def['default']}"
            properties[field_name] = prop

        if field_def.get("required", False):
            required.append(field_name)

    # Always ask for confidence score
    properties["confidence_score"] = {
        "type": "number",
        "description": "Overall confidence 0.0-1.0. Use <0.8 if any field was unclear.",
    }
    properties["low_confidence_fields"] = {
        "type": "array",
        "items": {"type": "string"},
        "description": "Field names where Claude was uncertain",
    }

    return {
        "type": "object",
        "properties": properties,
        "required": required,
    }


def _map_type(t: str) -> str:
    return {"string": "string", "number": "number", "boolean": "boolean", "array": "array"}.get(t, "string")


# ── File encoding ───────────────────────────────────────────

def _encode_file(file_path: str) -> tuple[str, str]:
    """Returns (media_type, base64_data) for image files."""
    ext = file_path.rsplit(".", 1)[-1].lower()
    media_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
    media_type = media_map.get(ext, "image/jpeg")
    with open(file_path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return media_type, data


def _is_pdf(file_path: str) -> bool:
    return file_path.lower().endswith(".pdf")


def _build_content_blocks(file_path: str, prompt: str) -> list:
    """Build the content array for Claude: file block + text prompt."""
    if _is_pdf(file_path):
        with open(file_path, "rb") as f:
            pdf_data = base64.standard_b64encode(f.read()).decode("utf-8")
        return [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": pdf_data,
                },
            },
            {"type": "text", "text": prompt},
        ]
    else:
        media_type, img_data = _encode_file(file_path)
        return [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": img_data,
                },
            },
            {"type": "text", "text": prompt},
        ]


# ── Claude call ─────────────────────────────────────────────

def _call_claude(file_path: str, system_prompt: str, tool_schema: dict, doc_type_name: str) -> dict:
    """Call Claude with vision + tool_use. Returns the tool_use result dict."""
    client = _get_client()

    user_prompt = (
        f"Please extract all structured data from this {doc_type_name} document. "
        "Use the extract_data tool to return the structured result. "
        "Be thorough — extract every field you can read. "
        "If a field is partially visible or unclear, still include your best reading and add that field to low_confidence_fields."
    )

    content_blocks = _build_content_blocks(file_path, user_prompt)

    response = client.beta.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=system_prompt,
        tools=[
            {
                "name": "extract_data",
                "description": f"Extract structured data from a {doc_type_name} document",
                "input_schema": tool_schema,
            }
        ],
        tool_choice={"type": "tool", "name": "extract_data"},
        messages=[{"role": "user", "content": content_blocks}],
        betas=["pdfs-2024-09-25"],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "extract_data":
            return block.input

    raise ValueError("Claude did not return a tool_use block")


# ── Transaction mapping ─────────────────────────────────────

def _safe_decimal(val: Any) -> Decimal | None:
    if val is None:
        return None
    try:
        # Strip commas from Indian number format
        return Decimal(str(val).replace(",", ""))
    except InvalidOperation:
        return None


def _safe_date(val: Any) -> date | None:
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        from datetime import datetime
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d %b %Y", "%d %B %Y"):
            try:
                return datetime.strptime(str(val).strip(), fmt).date()
            except ValueError:
                continue
    except Exception:
        pass
    return None


def _map_to_transactions(
    extracted: dict,
    doc_type_slug: str,
    document_id: uuid.UUID,
    company_id: uuid.UUID,
    raw_output: dict,
) -> list[Transaction]:
    """Map Claude's extracted dict to Transaction ORM objects."""
    confidence = _safe_decimal(extracted.get("confidence_score")) or Decimal("0.9")
    low_conf = extracted.get("low_confidence_fields", [])

    base_kwargs = dict(
        document_id=document_id,
        company_id=company_id,
        raw_ai_output=raw_output,
        confidence_score=confidence,
        low_confidence_fields=low_conf,
        status=TransactionStatus.pending_review,
    )

    transactions = []

    if doc_type_slug in ("invoice_purchase", "invoice_sales"):
        party_key = "vendor_name" if doc_type_slug == "invoice_purchase" else "customer_name"
        t = Transaction(
            **base_kwargs,
            party_name=extracted.get(party_key, ""),
            amount=_safe_decimal(extracted.get("total_amount")),
            transaction_date=_safe_date(extracted.get("invoice_date")),
            description=f"Invoice {extracted.get('invoice_number', '')}",
            extracted_data={k: v for k, v in extracted.items() if k not in ("low_confidence_fields",)},
        )
        # Line items
        for item in extracted.get("line_items", []):
            t.line_items.append(TransactionLineItem(
                description=item.get("description", ""),
                hsn_code=item.get("hsn_code"),
                quantity=_safe_decimal(item.get("quantity")),
                unit_price=_safe_decimal(item.get("unit_price")),
                amount=_safe_decimal(item.get("amount")),
                tax_amount=_safe_decimal(item.get("tax_amount")),
            ))
        transactions.append(t)

    elif doc_type_slug == "payment_receipt":
        t = Transaction(
            **base_kwargs,
            party_name=extracted.get("payer_name", ""),
            amount=_safe_decimal(extracted.get("amount")),
            transaction_date=_safe_date(extracted.get("payment_date")),
            description=extracted.get("description") or f"Payment via {extracted.get('payment_mode', '')}",
            extracted_data=extracted,
        )
        transactions.append(t)

    elif doc_type_slug == "salary_register":
        for emp in extracted.get("employees", []):
            t = Transaction(
                **base_kwargs,
                party_name=emp.get("employee_name", ""),
                amount=_safe_decimal(emp.get("net_pay")),
                transaction_date=_safe_date(extracted.get("month_year")),
                description=f"Salary - {emp.get('department', '')} - {extracted.get('month_year', '')}",
                extracted_data=emp,
            )
            transactions.append(t)

    elif doc_type_slug == "bank_statement":
        for txn in extracted.get("transactions", []):
            debit = _safe_decimal(txn.get("debit"))
            credit = _safe_decimal(txn.get("credit"))
            amount = debit or credit
            t = Transaction(
                **base_kwargs,
                party_name=txn.get("narration", "")[:255],
                amount=amount,
                transaction_date=_safe_date(txn.get("date")),
                description=f"{'DR' if debit else 'CR'} - {txn.get('narration', '')}",
                extracted_data={**txn, "type": "debit" if debit else "credit"},
            )
            transactions.append(t)

    elif doc_type_slug == "transaction_ledger":
        for entry in extracted.get("entries", []):
            debit = _safe_decimal(entry.get("debit"))
            credit = _safe_decimal(entry.get("credit"))
            t = Transaction(
                **base_kwargs,
                party_name=entry.get("account", extracted.get("ledger_name", ""))[:255],
                amount=debit or credit,
                transaction_date=_safe_date(entry.get("date")),
                description=entry.get("narration", ""),
                extracted_data={**entry, "type": "debit" if debit else "credit"},
            )
            transactions.append(t)

    else:
        # Generic fallback for unknown document types
        t = Transaction(
            **base_kwargs,
            party_name=str(extracted.get("party_name", extracted.get("vendor_name", extracted.get("payer_name", ""))))[:255],
            amount=_safe_decimal(extracted.get("total_amount", extracted.get("amount"))),
            transaction_date=_safe_date(extracted.get("date", extracted.get("invoice_date"))),
            description=f"Extracted from {doc_type_slug}",
            extracted_data=extracted,
        )
        transactions.append(t)

    return transactions


# ── Main entry point ────────────────────────────────────────

async def extract_document(document_id: uuid.UUID):
    """Background task called after upload. Runs Claude extraction and persists transactions."""
    db: Session = SessionLocal()
    doc = None
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        doc.status = DocumentStatus.processing
        db.commit()

        # Load document type config from DB
        doc_type: DocumentType = db.query(DocumentType).filter(
            DocumentType.id == doc.document_type_id
        ).first()
        if not doc_type:
            raise ValueError("Document type not found in database")

        if not os.path.exists(doc.file_path):
            raise FileNotFoundError(f"File not found: {doc.file_path}")

        # Build tool schema dynamically from expected_fields
        tool_schema = _fields_to_tool_schema(doc_type.expected_fields)

        # Call Claude
        extracted = _call_claude(
            file_path=doc.file_path,
            system_prompt=doc_type.extraction_prompt_template,
            tool_schema=tool_schema,
            doc_type_name=doc_type.name,
        )

        # Map to Transaction rows
        transactions = _map_to_transactions(
            extracted=extracted,
            doc_type_slug=doc_type.slug,
            document_id=doc.id,
            company_id=doc.company_id,
            raw_output=extracted,
        )

        if not transactions:
            raise ValueError("Claude returned no extractable records from this document")

        for t in transactions:
            db.add(t)

        doc.status = DocumentStatus.extracted

        # Notify accountants in the firm that a new document is ready for review
        from app.models.company import Company
        company = db.query(Company).filter(Company.id == doc.company_id).first()
        if company:
            notify_firm_accountants(
                db, company.firm_id,
                f"Document '{doc.original_filename}' from {company.name} is ready for review ({len(transactions)} transaction(s) extracted).",
                type="document_extracted",
                entity_id=doc.id,
                entity_type="document",
            )

        db.commit()

    except Exception as e:
        db.rollback()
        if doc is None:
            doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = DocumentStatus.failed
            doc.error_reason = str(e)[:500]
            db.commit()
    finally:
        db.close()
