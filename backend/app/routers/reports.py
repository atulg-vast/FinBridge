import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from jose import JWTError, jwt
from app.database import get_db
from app.deps import get_current_user, require_role
from app.config import settings
from app.services.audit_service import log_action
from app.models.user import User, UserRole
from app.models.report import Report
from app.models.company import Company
from app.schemas.report import ReportResponse

router = APIRouter()


def _optional_bearer(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None

ALLOWED_EXTENSIONS = {"pdf", "xlsx", "xls", "csv"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _check_access(company_id: str, current_user: User, db: Session) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if current_user.role == UserRole.platform_admin:
        return company
    if current_user.role in (UserRole.firm_admin, UserRole.accountant):
        if str(current_user.firm_id) != str(company.firm_id):
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in (UserRole.company_admin, UserRole.company_user):
        if str(current_user.company_id) != company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    return company


@router.post("/upload", response_model=ReportResponse, status_code=201)
async def upload_report(
    company_id: str = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([
        UserRole.accountant, UserRole.firm_admin, UserRole.platform_admin
    ])),
):
    _check_access(company_id, current_user, db)

    ext = _ext(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 50 MB.")

    report_dir = os.path.join(settings.UPLOAD_DIR, "reports", company_id)
    os.makedirs(report_dir, exist_ok=True)

    stored_name = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(report_dir, stored_name)
    with open(file_path, "wb") as f:
        f.write(contents)

    report = Report(
        company_id=company_id,
        uploaded_by=current_user.id,
        title=title.strip(),
        file_path=file_path,
        original_filename=file.filename or stored_name,
    )
    db.add(report)
    log_action(db, current_user.id, "report_uploaded", "report",
               company_id=company_id,
               meta={"title": title.strip(), "filename": file.filename})
    db.commit()
    db.refresh(report)
    return report


@router.get("", response_model=List[ReportResponse])
def list_reports(
    company_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Report)

    if current_user.role in (UserRole.company_admin, UserRole.company_user):
        q = q.filter(Report.company_id == current_user.company_id)
    elif current_user.role in (UserRole.accountant, UserRole.firm_admin):
        firm_company_ids = [
            str(c.id) for c in db.query(Company).filter(Company.firm_id == current_user.firm_id).all()
        ]
        q = q.filter(Report.company_id.in_(firm_company_ids))
        if company_id:
            q = q.filter(Report.company_id == company_id)
    elif current_user.role == UserRole.platform_admin:
        if company_id:
            q = q.filter(Report.company_id == company_id)

    return q.order_by(Report.created_at.desc()).all()


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    request_token: Optional[str] = Depends(_optional_bearer),
):
    raw_token = token or request_token
    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(raw_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        current_user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not current_user:
        raise HTTPException(status_code=401, detail="User not found")
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    _check_access(str(report.company_id), current_user, db)

    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=report.file_path,
        filename=report.original_filename,
        media_type="application/octet-stream",
    )


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([
        UserRole.accountant, UserRole.firm_admin, UserRole.platform_admin
    ])),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    _check_access(str(report.company_id), current_user, db)

    log_action(db, current_user.id, "report_deleted", "report",
               entity_id=report.id, company_id=str(report.company_id),
               meta={"title": report.title, "filename": report.original_filename})
    if os.path.exists(report.file_path):
        os.remove(report.file_path)
    db.delete(report)
    db.commit()
