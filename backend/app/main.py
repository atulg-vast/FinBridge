import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings

app = FastAPI(title="FinBridge API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173",
        "http://localhost:4174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

from app.routers import auth, firms, companies, payment_heads, users, documents, transactions, reports, dashboard, notifications

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(firms.router, prefix="/firms", tags=["firms"])
app.include_router(companies.router, prefix="/firms", tags=["companies"])
app.include_router(payment_heads.router, prefix="/companies", tags=["payment-heads"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "FinBridge API"}
