# FinBridge

AI-powered financial document management platform for accounting firms. Replaces email/WhatsApp-based document exchange with Claude vision-based invoice scanning, structured transaction extraction, and real-time review workflows.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| State | React Query + Zustand |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 + Alembic |
| AI | Anthropic Claude claude-sonnet-4-6 (vision + tool_use) |
| Auth | JWT (python-jose) + bcrypt |
| Real-time | Server-Sent Events (SSE) |
| PWA | vite-plugin-pwa + Workbox |

---

## Prerequisites

- Python 3.12
- Node.js 18+
- PostgreSQL 16 running locally
- Anthropic API key

---

## Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd FinBridge
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/finbridge
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
ANTHROPIC_API_KEY=sk-ant-...
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:5173
SUPERUSER_EMAIL=admin@finbridge.com
SUPERUSER_PASSWORD=Admin@123
```

### 2. Backend setup

```bash
cd backend
pip install -r requirements.txt

# Create DB and run migrations
alembic upgrade head

# Bootstrap platform admin
python ../seed/create_superuser.py

# Seed AI document type prompt templates
python ../seed/document_types.py

# Seed full demo dataset
python "../seed/seed.py"
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open http://localhost:5173

---

## Demo Flow

1. **Login as `admin@techcorp.com`** → Upload a PDF invoice or bank statement
2. Watch status change from `pending` → `processing` → `extracted` in real time
3. **Login as `accountant1@apex.com`** → Go to Review Queue → see AI-extracted fields
4. Edit any field, assign a payment head, click Accept
5. **Switch back to TechCorp Admin** → Bell notification appears, transaction shows as Accepted
6. **Login as `firm@apexaccounting.com`** → Audit Trail shows every action with metadata
7. **Accountant** → Upload an MIS report → Company admin can download it

---

## Key Features

- **AI Document Extraction** — Claude claude-sonnet-4-6 vision extracts structured data from invoices, bank statements, salary registers, payment receipts, and transaction ledgers via `tool_use` for deterministic JSON output
- **Multi-tenant RBAC** — Platform Admin → Firm → Companies, with JWT-enforced tenant isolation
- **DB-driven document types** — Add a new document type with a single SQL insert, zero code changes
- **Real-time notifications** — SSE streams push notifications instantly when documents are extracted or transactions reviewed
- **Audit trail** — Every action logged with user, company, metadata; filterable by firm admin
- **PWA** — Installable on Android/iOS, camera capture for mobile invoice upload, offline fallback

---

## API

Backend runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.
