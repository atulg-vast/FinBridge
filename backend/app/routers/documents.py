import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User, UserRole
from app.models.document import Document, DocumentStatus
from app.models.document_type import DocumentType
from app.schemas.document import DocumentResponse, DocumentTypeResponse
from app.config import settings
from app.services.audit_service import log_action

router = APIRouter()

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "pdf"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _get_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _check_company_access(company_id: str, current_user: User):
    if current_user.role == UserRole.platform_admin:
        return
    if current_user.role in (UserRole.firm_admin, UserRole.accountant):
        return  # further filtered at query level by firm
    if current_user.role in (UserRole.company_admin, UserRole.company_user):
        if str(current_user.company_id) != company_id:
            raise HTTPException(status_code=403, detail="Access denied")


@router.get("/types", response_model=List[DocumentTypeResponse])
def list_document_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(DocumentType).filter(DocumentType.is_active == True).order_by(DocumentType.name).all()


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    company_id: str = Form(...),
    document_type_slug: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_company_access(company_id, current_user)

    ext = _get_extension(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")

    doc_type = db.query(DocumentType).filter(DocumentType.slug == document_type_slug).first()
    if not doc_type:
        raise HTTPException(status_code=400, detail=f"Unknown document type: {document_type_slug}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 20 MB.")

    company_dir = os.path.join(settings.UPLOAD_DIR, company_id)
    os.makedirs(company_dir, exist_ok=True)

    stored_name = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(company_dir, stored_name)
    with open(file_path, "wb") as f:
        f.write(contents)

    doc = Document(
        company_id=company_id,
        uploaded_by=current_user.id,
        document_type_id=doc_type.id,
        file_path=file_path,
        original_filename=file.filename or stored_name,
        status=DocumentStatus.pending,
    )
    db.add(doc)
    log_action(db, current_user.id, "document_uploaded", "document",
               company_id=company_id,
               meta={"filename": file.filename, "document_type": document_type_slug})
    db.commit()
    db.refresh(doc)

    # Trigger AI extraction in background
    from app.services.ai_extraction import extract_document
    background_tasks.add_task(extract_document, doc.id)

    return doc


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    company_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Document)

    if current_user.role in (UserRole.company_admin, UserRole.company_user):
        q = q.filter(Document.company_id == current_user.company_id)
    elif current_user.role == UserRole.accountant:
        # accountant sees documents from companies in their firm
        from app.models.company import Company
        firm_company_ids = [
            str(c.id) for c in db.query(Company).filter(Company.firm_id == current_user.firm_id).all()
        ]
        q = q.filter(Document.company_id.in_(firm_company_ids))
        if company_id:
            q = q.filter(Document.company_id == company_id)
    elif current_user.role == UserRole.firm_admin:
        from app.models.company import Company
        firm_company_ids = [
            str(c.id) for c in db.query(Company).filter(Company.firm_id == current_user.firm_id).all()
        ]
        q = q.filter(Document.company_id.in_(firm_company_ids))
        if company_id:
            q = q.filter(Document.company_id == company_id)
    elif current_user.role == UserRole.platform_admin:
        if company_id:
            q = q.filter(Document.company_id == company_id)

    return q.order_by(Document.created_at.desc()).all()


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _check_company_access(str(doc.company_id), current_user)
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _check_company_access(str(doc.company_id), current_user)

    from app.models.transaction import Transaction, TransactionStatus
    reviewed = db.query(Transaction).filter(
        Transaction.document_id == doc.id,
        Transaction.status.in_([TransactionStatus.accepted, TransactionStatus.rejected]),
    ).first()
    if reviewed:
        raise HTTPException(status_code=400, detail="Cannot delete a document that has been reviewed by an accountant")

    # Delete file from disk
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    db.delete(doc)
    db.commit()


@router.post("/{doc_id}/retry", response_model=DocumentResponse)
async def retry_extraction(
    doc_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _check_company_access(str(doc.company_id), current_user)

    # Delete existing transactions so we start fresh
    from app.models.transaction import Transaction
    db.query(Transaction).filter(Transaction.document_id == doc.id).delete()

    doc.status = DocumentStatus.pending
    doc.error_reason = None
    db.commit()
    db.refresh(doc)

    from app.services.ai_extraction import extract_document
    background_tasks.add_task(extract_document, doc.id)

    return doc
