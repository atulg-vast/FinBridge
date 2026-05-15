"""
Bootstrap script — creates the platform_admin superuser.
Run once after: alembic upgrade head
Safe to re-run (idempotent).
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.config import settings
from app.database import SessionLocal
from app.models.user import User, UserRole
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_superuser():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.SUPERUSER_EMAIL).first()
        if existing:
            print(f"Superuser already exists: {settings.SUPERUSER_EMAIL}")
            return

        superuser = User(
            email=settings.SUPERUSER_EMAIL,
            full_name="Platform Admin",
            password_hash=pwd_context.hash(settings.SUPERUSER_PASSWORD),
            role=UserRole.platform_admin,
            is_active=True,
            firm_id=None,
            company_id=None,
        )
        db.add(superuser)
        db.commit()
        print(f"Superuser created successfully!")
        print(f"  Email:    {settings.SUPERUSER_EMAIL}")
        print(f"  Password: {settings.SUPERUSER_PASSWORD}")
        print(f"  Role:     platform_admin")
    finally:
        db.close()


if __name__ == "__main__":
    create_superuser()
