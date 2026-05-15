# FinBridge — Full Build Plan

## Context
FinBridge is a multi-tenant SaaS platform that replaces email/WhatsApp-based financial data exchange between businesses and their accounting firms. The core value is AI-powered (Claude vision) invoice scanning that auto-extracts structured transaction records, eliminating manual data entry. Judging weights: working demo (30%), AI capability (25%), architecture (20%), UX (15%), stretch goals (10%).

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React + Vite + TypeScript | Fast dev, PWA-ready, great ecosystem |
| Styling | Tailwind CSS + shadcn/ui | Polished UI quickly |
| State / Data | React Query + Zustand | Server state + client state |
| Backend | Python 3.11 + FastAPI | Async, Claude SDK fits naturally, clean Pydantic models |
| ORM | SQLAlchemy 2.0 + Alembic | Multi-tenant schema, migrations |
| Database | PostgreSQL 16 | Row-level multi-tenancy, audit trail, JSONB for flexible data |
| File Storage | Local `/uploads` (dev), abstracted for S3 swap | Simple for hackathon |
| AI | Anthropic Claude claude-sonnet-4-6 (vision) | Bill/invoice scan, structured extraction |
| Auth | JWT (python-jose) + bcrypt | Stateless, easy role embedding |
| Notifications | Server-Sent Events (SSE) via FastAPI | Real-time, no extra infra |
| PWA | Vite PWA plugin + service worker | Mobile stretch goal |

---

## Database Schema (PostgreSQL)

### Core Tables
```
accounting_firms        id, name, slug, created_at
users                   id, firm_id, company_id, email, password_hash, role, is_active, created_at
                        role ENUM: platform_admin | firm_admin | accountant | company_admin | company_user
companies               id, firm_id, name, business_type (Manufacturing/IT/Services), created_at
payment_heads           id, company_id, name, created_at
payment_sub_heads       id, head_id, company_id, name, created_at

document_types          id, name, slug, description, extraction_prompt_template (TEXT),
                        expected_fields (JSONB), accepted_file_formats (JSONB), is_active, created_at
                        -- DB-driven, NOT a hardcoded ENUM. New types = new row, zero code change.
                        -- Seeded with: invoice_purchase, invoice_sales, payment_receipt,
                        --              salary_register, bank_statement, transaction_ledger

documents               id, company_id, uploaded_by, document_type_id (FK → document_types),
                        file_path, original_filename, status (pending/processing/extracted/failed),
                        error_reason, created_at

transactions            id, document_id, company_id, head_id, sub_head_id,
                        party_name,          -- vendor / employee name / bank narration (common across all types)
                        amount,              -- total / net pay / debit+credit (common across all types)
                        transaction_date,
                        description,
                        extracted_data (JSONB),       -- ALL type-specific fields Claude extracted
                                                      -- invoice:  {invoice_no, subtotal, tax, currency, ...}
                                                      -- salary:   {employee_id, basic, hra, deductions, ...}
                                                      -- bank:     {reference_no, balance, debit, credit, ...}
                        raw_ai_output (JSONB),        -- full unprocessed Claude response for audit
                        confidence_score,
                        low_confidence_fields (JSONB),
                        status (pending_review/accepted/rejected), reviewed_by, reviewed_at, created_at
                        -- NOTE: 1 document → many transactions
                        --   Invoice       = 1 transaction + N line_items
                        --   Bank stmt     = N transactions (one per row), 0 line_items
                        --   Salary reg    = N transactions (one per employee), 0 line_items
                        --   Payment rcpt  = 1 transaction, 0 line_items

transaction_line_items  id, transaction_id,
                        description, quantity, unit_price, amount, tax_amount, created_at
                        -- Only used for invoice line items (products/services listed on invoice)

reports                 id, company_id, uploaded_by, title, file_path, created_at
notifications           id, user_id, message, type, is_read, created_at
audit_logs              id, user_id, company_id, action, entity_type, entity_id, meta (JSONB), created_at
```

**Adding a new document type in the future = 1 DB insert, 0 code changes:**
```sql
INSERT INTO document_types (name, slug, extraction_prompt_template, expected_fields, accepted_file_formats)
VALUES (
  'Purchase Order', 'purchase_order',
  'Extract all fields from this purchase order document...',
  '{"po_number": "str", "vendor": "str", "items": "array", "total": "float"}',
  '["pdf", "jpg", "png"]'
);
```

---

## Project Structure

```
finbridge/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app entry
│   │   ├── config.py             # Settings (env vars)
│   │   ├── database.py           # SQLAlchemy engine + session
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic request/response models
│   │   ├── routers/              # Route handlers per domain
│   │   │   ├── auth.py
│   │   │   ├── firms.py
│   │   │   ├── companies.py
│   │   │   ├── users.py
│   │   │   ├── documents.py
│   │   │   ├── transactions.py
│   │   │   ├── reports.py
│   │   │   ├── dashboard.py
│   │   │   └── notifications.py
│   │   ├── services/
│   │   │   ├── ai_extraction.py  # Claude vision bill scanning
│   │   │   ├── auth_service.py
│   │   │   └── audit_service.py
│   │   └── deps.py               # FastAPI dependency injection (current_user, db)
│   ├── alembic/                  # DB migrations
│   ├── uploads/                  # File storage
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/                # Route-level page components
│   │   │   ├── auth/
│   │   │   ├── platform-admin/
│   │   │   ├── firm-admin/
│   │   │   ├── company/
│   │   │   └── accountant/
│   │   ├── hooks/                # React Query hooks per domain
│   │   ├── stores/               # Zustand stores (auth, notifications)
│   │   ├── api/                  # Axios client + typed API calls
│   │   └── lib/                  # Utilities
│   ├── public/
│   │   └── manifest.json         # PWA manifest
│   ├── vite.config.ts
│   └── index.html
├── seed/
│   ├── document_types.py         # Infrastructure seed — prompt templates
│   └── seed.py                   # Demo data seeder
├── PLAN.md                       # This file
└── README.md
```

---

## Build Phases (Step-by-Step Tasks)

> **Note:** Every phase delivers BOTH backend (FastAPI endpoints, DB logic) AND frontend (React pages, components, API hooks). Nothing is backend-only or frontend-only unless explicitly stated.

---

### Phase 1 — Project Scaffolding & Setup
**Backend:**
- FastAPI app with CORS, health-check route, static file serving for `/uploads`
- SQLAlchemy 2.0 engine + session factory, Alembic configured
- `.env` with DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET, SUPERUSER_EMAIL, SUPERUSER_PASSWORD
- Initial Alembic migration creating all tables
- `seed/create_superuser.py` — bootstrap script that creates the platform_admin account from `.env` values:
  - Checks if superuser already exists (idempotent — safe to re-run)
  - Creates user with role=`platform_admin`, no firm_id, no company_id
  - Must run AFTER `alembic upgrade head`, BEFORE anything else
  - Prints confirmation: `Superuser created: admin@finbridge.com`

**Frontend:**
- React + Vite + TypeScript project
- Tailwind CSS + shadcn/ui installed and configured
- React Query + Zustand + React Router v6 wired up
- Axios client (`src/api/client.ts`) with base URL + auth token interceptor
- App shell: root layout, router skeleton with placeholder routes for all role portals

**Setup order (locked):**
```
1. alembic upgrade head              ← create all tables
2. python seed/create_superuser.py   ← bootstrap platform_admin (from .env)
3. python seed/document_types.py     ← seed AI prompt templates  (Phase 6b)
4. python seed/seed.py               ← seed demo data            (Phase 14)
5. uvicorn app.main:app --reload     ← start backend
6. npm run dev                       ← start frontend
```

**Deliverable:** `uvicorn` and `npm run dev` both start cleanly; DB schema applied; platform_admin can log in immediately

---

### Phase 2 — Auth & Multi-Tenant RBAC
**Backend:**
- `POST /auth/login` → returns JWT with `user_id`, `role`, `firm_id`, `company_id`
- `POST /auth/logout` (client-side token drop, endpoint for future token blacklist)
- `deps.py`: `get_current_user`, `require_role([...])` FastAPI dependencies
- Tenant scoping enforced: every DB query filters by `firm_id`/`company_id` from JWT

**Frontend:**
- Login page (`/login`) with email + password form using shadcn/ui
- Zustand auth store: persist token in localStorage, decode role from JWT
- `ProtectedRoute` wrapper: redirects unauthenticated users to `/login`
- Role-based redirect after login (platform_admin → `/admin`, firm_admin → `/firm`, etc.)

**Deliverable:** Login works; wrong role cannot access another role's routes

---

### Phase 3 — Platform Admin: Firm Onboarding
**Backend:**
- `GET/POST /firms` — list and create accounting firms
- Auto-create firm_admin user on firm creation, return temp password
- `GET /firms/{id}` — firm detail

**Frontend:**
- `/admin` dashboard: stats cards + firms table with pagination
- "Add Firm" modal form (firm name, admin email, admin name)
- Displays created firm admin credentials after creation
- Sidebar navigation for platform admin role

**Deliverable:** Platform admin can onboard a new accounting firm end-to-end

---

### Phase 4 — Firm Admin: Company & User Management
**Backend:**
- `GET/POST /firms/{id}/companies` — list and create companies (with business_type)
- `GET/POST /firms/{id}/accountants` — list and create accountant users
- Auto-create company_admin user on company creation

**Frontend:**
- `/firm` dashboard: companies list + accountants list tabs
- "Add Company" modal: name, business_type dropdown (Manufacturing / IT / Services)
- "Add Accountant" modal: name, email
- Company cards with status, business type badge

**Deliverable:** Firm admin can onboard companies and manage accountants

---

### Phase 5 — Payment Heads Configuration
**Backend:**
- `GET/POST /companies/{id}/payment-heads`
- `GET/POST /companies/{id}/payment-heads/{head_id}/sub-heads`
- `DELETE` endpoints for both
- Preset seed templates by business_type available as a helper endpoint

**Frontend:**
- Payment heads config page accessible from company detail (firm admin view)
- Two-column layout: heads list on left, sub-heads for selected head on right
- Inline add/delete for both heads and sub-heads
- "Apply preset template" button based on business_type

**Deliverable:** Firm admin can fully configure payment taxonomy per company

---

### Phase 6 — Financial Document Upload (Company Side)
**Backend:**
- `POST /documents/upload` — multipart form: file + document_type_id
- Accept: image (jpg/png), PDF, XLSX
- Save with UUID filename under `/uploads/{company_id}/`
- Create `documents` record with status=`pending`
- `GET /documents` — filtered by company (company users) or firm (accountants)

**Frontend:**
- `/company/upload` page with drag-and-drop zone (react-dropzone)
- Document type selector loaded from `GET /document-types` (dynamic, DB-driven)
- Upload progress indicator
- Recent uploads list with status badges (pending / processing / extracted / failed)

**Deliverable:** Company user can upload financial documents and see their status

---

### Phase 6b — Document Type Registry & Prompt Templates ⭐ AI Foundation
> Must complete before Phase 7. These are infrastructure seeds, not demo data — required for any extraction to run.

**`seed/document_types.py`** seeds the `document_types` table with one row per supported type. Each row contains:
- `slug` — machine identifier (e.g. `invoice_purchase`)
- `name` — display name (e.g. "Purchase Invoice")
- `accepted_file_formats` — `["pdf", "jpg", "jpeg", "png"]`
- `extraction_prompt_template` — the Claude system prompt for this type
- `expected_fields` — JSONB schema that drives the Claude `tool_use` definition dynamically

**Prompt templates per document type:**

| Type | Prompt focus |
|------|-------------|
| `invoice_purchase` | Vendor, GSTIN, invoice #, line items (HSN/SAC), CGST/SGST/IGST, total |
| `invoice_sales` | Same as purchase but buyer details instead of vendor |
| `payment_receipt` | Payer, payee, amount, payment mode, reference #, date |
| `salary_register` | Each employee row: name, ID, basic, HRA, allowances, deductions, net pay |
| `bank_statement` | Each row: date, narration, cheque #, debit, credit, running balance |
| `transaction_ledger` | Date, ledger account, debit/credit, narration, closing balance |

**Example — `invoice_purchase` prompt template:**
```
You are a financial document extraction specialist working with Indian business invoices.
Extract all structured data from this invoice image with high accuracy.
Pay close attention to:
- GST number, GSTIN of vendor
- HSN/SAC codes on line items
- CGST / SGST / IGST breakdown
- Invoice number and date
If any field is unclear or partially visible, still extract your best reading
and set confidence_score below 0.8 for that field.
Extract every line item separately — do not merge or summarize.
```

**Example — `invoice_purchase` expected_fields JSONB:**
```json
{
  "vendor_name": {"type": "string", "required": true},
  "vendor_gstin": {"type": "string", "required": false},
  "invoice_number": {"type": "string", "required": true},
  "invoice_date": {"type": "string", "format": "YYYY-MM-DD", "required": true},
  "line_items": {
    "type": "array",
    "items": {"description": "string", "hsn_code": "string", "quantity": "number",
              "unit_price": "number", "amount": "number"}
  },
  "subtotal": {"type": "number", "required": true},
  "cgst": {"type": "number", "required": false},
  "sgst": {"type": "number", "required": false},
  "igst": {"type": "number", "required": false},
  "total_amount": {"type": "number", "required": true},
  "currency": {"type": "string", "default": "INR"}
}
```

**How `ai_extraction.py` uses this:**
1. Load `document_type` row from DB by `document_type_id`
2. Build Claude `tool_use` schema dynamically from `expected_fields` JSONB
3. Use `extraction_prompt_template` as the system prompt
4. Result: adding a new document type = insert a row, zero code change in extraction engine

**Deliverable:** All 6 document types seeded with tested prompt templates; extraction engine works generically

---

### Phase 7 — AI Bill/Invoice Scanning (Claude Vision) ⭐ Core AI Feature

**Full flow:**
```
Upload → BackgroundTask → ai_extraction.py → Claude claude-sonnet-4-6 vision + tool_use
       → transactions rows created → document status updated → accountant notified
```

**Backend (`services/ai_extraction.py`) — Generic extraction engine:**
- Load `extraction_prompt_template` + `expected_fields` from DB by document_type_id
- Dynamically build Claude `tool_use` schema from `expected_fields` JSONB — no hardcoded per-type logic
- PDF → convert pages to images via `pdf2image`; images → base64 encode directly
- Call Claude claude-sonnet-4-6 with vision input + tool_use (deterministic typed JSON, no parsing ambiguity)
- Map extracted fields → `transactions` rows:
  - Invoice = 1 transaction + N `transaction_line_items`
  - Bank statement / Salary register = N transactions (one per row/employee)
- Auto-suggest `payment_head` by keyword match against company's configured heads
- Flag low-confidence fields (score < 0.8) in `low_confidence_fields` JSONB
- Store full raw Claude response in `raw_ai_output` JSONB for audit
- Document status: `pending` → `processing` → `extracted` / `failed`
- On failure: store `error_reason`, notify uploader

**Per document type — what Claude extracts:**

| Type | Extracted fields |
|------|-----------------|
| Invoice (Purchase/Sales) | Vendor, GSTIN, date, invoice #, line items, GST breakdown, total |
| Payment Receipt | Payer, payee, amount, mode, reference #, date |
| Salary Register | Per employee: name, ID, basic, HRA, allowances, deductions, net pay |
| Bank Statement | Per row: date, narration, cheque #, debit, credit, running balance |

**Frontend:**
- Document detail page: original file preview (image / PDF iframe) side-by-side with extracted transaction cards
- Polling document status every 3s while `processing` → auto-refreshes on `extracted`
- Amber warning indicator on each field where confidence < 0.8
- "Re-scan" button on failed documents

**Deliverable:** Uploading any supported document auto-creates structured, reviewable transaction records

---

### Phase 8 — Accountant Review Workflow

**Approval rules:**
- Accountants own all refinement — they correct AI-extracted fields themselves, then accept
- Company users are upload-only — they never edit transactions
- Rejection is terminal with mandatory note — company re-uploads fresh document if needed

**Transaction state machine:**
```
pending_review → (accountant edits + accepts) → accepted  [terminal]
pending_review → (accountant rejects + note)  → rejected  [terminal]
```

**Backend:**
- `GET /transactions` — filtered to firm's companies; supports filter by status, company, date range
- `PUT /transactions/{id}` — accountant edits: party_name, amount, transaction_date, description, head_id, sub_head_id, extracted_data JSONB fields
- `POST /transactions/{id}/accept` — status=accepted, reviewed_by + reviewed_at, fires notification + audit log
- `POST /transactions/{id}/reject` — status=rejected, mandatory rejection_note, fires notification + audit log
- Company users: read-only on own transactions (no PUT / accept / reject)

**Frontend:**
- `/accountant/review`: table of pending_review transactions across assigned companies
- Transaction detail drawer/modal:
  - Left panel: original document preview
  - Right panel: editable fields pre-filled with AI-extracted values; amber highlight on low-confidence fields; payment head/sub-head dropdowns
  - Accept (green) / Reject (red, requires note) action buttons
- Company view: read-only list with status badges; rejected ones show accountant's rejection note

**Deliverable:** Accountant can refine and accept/reject; company sees outcome with reason

---

### Phase 9 — Reports Section
**Backend:**
- `POST /reports` — accountant uploads MIS report (PDF/XLSX) tagged to company_id
- `GET /reports` — company admin sees own company reports; accountant sees all
- `GET /reports/{id}/download` — serve file

**Frontend:**
- Accountant: `/accountant/reports` — upload form (file + title + company selector) + uploaded list
- Company admin: `/company/reports` — read-only list with download buttons
- File type icons, upload date, uploader name shown

**Deliverable:** Accountant uploads MIS report → company admin can download it

---

### Phase 10 — Dashboard with Insights *(Stretch)*
**Backend:**
- `GET /dashboard/summary` — role-aware aggregations:
  - Company: total spend by month, top 5 expense heads, pending/accepted/rejected counts
  - Accountant: pending review count, docs processed this week, companies overview
  - Firm admin: all companies summary

**Frontend:**
- Company: Recharts AreaChart (monthly spend) + PieChart (expense heads) + stat cards
- Accountant: pending queue count + recent activity feed
- Default landing page after login for each role

**Deliverable:** Meaningful visual insights on landing page per role

---

### Phase 11 — Real-Time Notifications *(Stretch)*
**Backend:**
- `GET /notifications/stream` — SSE endpoint (EventSourceResponse)
- `GET /notifications` — list with is_read filter
- `POST /notifications/{id}/read` — mark read
- Triggers: document extracted, transaction accepted/rejected, report published

**Frontend:**
- Bell icon in navbar with unread badge
- Dropdown with recent notifications + timestamps
- Auto-connects to SSE on login via Zustand notification store
- Click notification → navigate to relevant resource

**Deliverable:** Real-time in-app notifications across all roles

---

### Phase 12 — Audit Trail *(Stretch)*
**Backend:**
- `audit_service.py`: `log_action(user, action, entity_type, entity_id, meta)` called on every mutation
- `GET /audit-logs` — firm admin only, filterable by company/user/action/date

**Frontend:**
- `/firm/audit`: sortable table with filters (company, user, action, date range)
- Columns: timestamp, user, action, entity, company, expandable detail

**Deliverable:** Full traceability of all platform actions visible to firm admin

---

### Phase 13 — PWA / Mobile *(Stretch)*
> Backend: no changes needed.

**Frontend:**
- `vite-plugin-pwa` + Workbox service worker + `manifest.json` with app icons
- All pages use Tailwind responsive/mobile-first classes
- Upload page: `<input accept="image/*" capture="environment">` enables camera on mobile
- Offline fallback page

**Deliverable:** App installable on Android/iOS; camera-triggered bill upload works on mobile

---

### Phase 14 — Seed Data & Demo Prep
**`seed/seed.py`:**
- platform_admin user
- 1 accounting firm ("ABC Accounting") + firm_admin
- 2 companies: TechCorp (IT) + ManuFab (Manufacturing) + company_admin for each
- 2 accountants, 3 company users
- Payment heads seeded from business_type templates
- 10 transactions in mixed states (pending/accepted/rejected) with realistic Indian business data
- 2 sample MIS reports

**README.md:**
- Prerequisites (Python 3.11, Node 18+, PostgreSQL 16)
- Environment setup (.env variables)
- Commands: `alembic upgrade head`, `python seed/document_types.py`, `python seed/seed.py`
- Start commands for backend + frontend
- Demo walkthrough script for judges

**Deliverable:** Clone → setup → seed → full working demo in under 5 minutes

---

## API Endpoints Summary

```
POST   /auth/login
POST   /auth/logout

GET/POST            /firms                                        (platform_admin)
GET/POST            /firms/{id}/companies                         (firm_admin)
GET/POST            /firms/{id}/accountants                       (firm_admin)
GET/PUT/DELETE      /companies/{id}
GET/POST            /companies/{id}/payment-heads
GET/POST            /companies/{id}/payment-heads/{head_id}/sub-heads
DELETE              /companies/{id}/payment-heads/{head_id}
DELETE              /companies/{id}/payment-heads/{head_id}/sub-heads/{sub_id}

GET                 /document-types                               (all roles)
POST                /documents/upload
GET                 /documents                                    (filtered by role)
GET                 /documents/{id}

GET                 /transactions                                 (filtered by role)
GET/PUT             /transactions/{id}
POST                /transactions/{id}/accept
POST                /transactions/{id}/reject

GET/POST            /reports                                      (filtered by role)
GET                 /reports/{id}/download

GET                 /dashboard/summary                            (role-aware)
GET                 /notifications
GET                 /notifications/stream                         (SSE)
POST                /notifications/{id}/read

GET                 /audit-logs                                   (firm_admin)
```

---

## Key Implementation Notes

- **Tenant isolation:** every DB query filters on `firm_id`/`company_id` from JWT — never from client payload
- **AI extraction engine:** generic — reads prompt template + field schema from DB, works for any document type
- **tool_use over plain text:** forces deterministic typed JSON from Claude, eliminates parsing errors
- **1 document → many transactions:** bank statements and salary registers produce N transaction rows
- **extracted_data JSONB:** all type-specific Claude output stored here — nothing is lost regardless of document type
- **File security:** UUID filenames on disk, original name stored separately, prevents path traversal
- **Prompt templates in DB:** tuned for Indian business documents (GST, GSTIN, HSN/SAC, CGST/SGST/IGST)

---

## Verification / Testing Checklist

1. `cd backend && uvicorn app.main:app --reload` starts, `/health` returns 200
2. `cd frontend && npm run dev` renders login page
3. `alembic upgrade head` applies cleanly with no errors
4. `python seed/document_types.py` seeds 6 document types
5. `python seed/seed.py` populates full demo dataset
6. Login as platform_admin → onboard a firm → login as firm_admin → onboard company
7. Login as company_user → upload invoice image → AI extraction runs → transaction record created
8. Login as accountant → see pending transaction → edit a field → accept → notification fires
9. Login as company_admin → see accepted transaction → download report
10. Check audit log in firm_admin view shows all actions
11. On mobile browser: install PWA, use camera to upload a bill image
