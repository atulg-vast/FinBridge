# FinBridge — Technical Briefing for Presentation

> Study this document end-to-end before presenting. It covers every feature, every design decision, and every question a judge might ask.

---

## 1. What Problem FinBridge Solves

### The Reality Today
Small and mid-size businesses (SMBs) in India manage their accounting through third-party accounting firms. The daily workflow looks like this:

- A company accountant photographs an invoice and sends it via **WhatsApp or email** to their accounting firm
- The firm's accountant **manually re-types** every field (vendor name, invoice number, amount, GST breakdown) into their accounting software
- The company has **no visibility** into whether the invoice was received, processed, or rejected
- If the accountant has a question, it's another WhatsApp message — no structured thread
- There is **zero audit trail** — no record of who processed what, when, or what changes were made

### What Goes Wrong
- Invoices get lost in WhatsApp threads
- Manual data entry introduces errors (wrong amounts, wrong dates)
- Duplicate invoices get processed twice
- Salary registers with 50 employees = 50 rows manually entered
- No accountability — anyone can change anything with no record

### What FinBridge Does
FinBridge is a multi-tenant SaaS platform that replaces this entire workflow:

1. **Company uploads** the document (PDF/image) through a structured portal
2. **Claude AI automatically extracts** all structured data — vendor, amount, GST, line items, dates
3. **Accountant reviews** the AI-extracted data, corrects any errors, assigns payment categories
4. **Company sees real-time status** — extracted, under review, accepted, or rejected with reason
5. **Every action is logged** in an immutable audit trail
6. **AI Insights Panel** lets anyone ask financial questions and get answers from live data

---

## 2. The Five Roles — Who Uses What

| Role | Portal | Key Actions |
|---|---|---|
| **Platform Admin** | `/admin` | Onboards accounting firms, global platform oversight |
| **Firm Admin** | `/firm` | Manages companies & accountants under their firm, views full audit trail |
| **Accountant** | `/accountant` | Reviews AI-extracted transactions, accepts/rejects, uploads MIS reports |
| **Company Admin** | `/company` | Uploads financial documents, views transaction status, downloads reports, **manages team** |
| **Company User** | `/company` | Uploads documents, views transaction status, downloads reports |

**Who creates whom:**
- Platform Admin creates Firm Admin (via `/admin`)
- Firm Admin creates Companies + Accountants (via `/firm`)
- **Company Admin creates Company Users (via `/company/team`)** — self-service team management
- Company Users cannot create anyone

**Critical rule:** Accountants see data for ALL companies under their firm. Company users see ONLY their own company's data. This isolation is enforced server-side — the client cannot override it.

---

## 3. Feature-by-Feature Technical Walkthrough

### A. Authentication & Multi-Tenant RBAC

**How login works:**
1. User submits email + password to `POST /auth/login`
2. Backend fetches user from DB, verifies password with `bcrypt`
3. On success, issues a **JWT** containing: `{ sub: user_id, role, firm_id, company_id, exp }`
4. Frontend stores JWT in `localStorage` via Zustand (`auth-storage` key)
5. Every API request includes `Authorization: Bearer <token>` via Axios interceptor

**How tenant isolation works:**
- `backend/app/deps.py` — `get_current_user()` decodes the JWT on every single API request
- `company_id` and `firm_id` come from the JWT — **the client never sends these**
- Every DB query enforces: `filter(Transaction.company_id == current_user.company_id)`
- Accountants: `filter(Transaction.company_id.in_(firm_company_ids))` — all companies in their firm
- If a company user somehow sends another company's ID → backend ignores it, uses JWT value

**Role enforcement:**
- `require_role([UserRole.accountant, UserRole.firm_admin])` FastAPI dependency
- Applied per-endpoint — wrong role gets 403 immediately

---

### B. Document Upload & AI Extraction ⭐ Core Feature

#### Upload Flow
1. Company user goes to `/company/upload`
2. Selects document type from dropdown (Purchase Invoice, Salary Register, Bank Statement, etc.)
3. Drags file or uses camera capture (mobile PWA)
4. `POST /documents/upload` (multipart form):
   - File saved as UUID filename: `/uploads/{company_id}/{uuid}.pdf`
   - UUID prevents path traversal attacks; original filename stored separately in DB
   - `Document` record created with `status = pending`
5. FastAPI fires a `BackgroundTask` — response returns immediately (document ID)
6. Background task runs `extract_document(document_id)` in `ai_extraction.py`

#### AI Extraction Flow — Step by Step

**Step 1: Load document type config from DB**
```python
doc_type = db.query(DocumentType).filter(DocumentType.id == doc.document_type_id).first()
# Gets: extraction_prompt_template (system prompt) + expected_fields (JSON schema)
```

**Step 2: Build Claude tool_use schema dynamically**
```python
tool_schema = _fields_to_tool_schema(doc_type.expected_fields)
# Converts JSONB like {"vendor_name": {"type": "string", "required": true}, ...}
# Into Claude tool input_schema format
```
This is the key architectural decision: **zero hardcoded extraction logic**. The schema is read from the database at runtime.

**Step 3: Call Claude with vision + tool_use**
```python
response = client.beta.messages.create(
    model="claude-sonnet-4-6",
    system=doc_type.extraction_prompt_template,  # from DB
    tools=[{"name": "extract_data", "input_schema": tool_schema}],
    tool_choice={"type": "tool", "name": "extract_data"},  # forces structured output
    messages=[{"role": "user", "content": [image_block, text_block]}],
    betas=["pdfs-2024-09-25"],  # native PDF support
)
```

**Why `tool_use` and not plain text?**
- `tool_choice: {"type": "tool"}` forces Claude to ONLY call the tool — no prose
- The tool schema is strict JSON — amounts come back as numbers, dates as strings
- No regex parsing needed. No hallucinated field names. Zero ambiguity.

**Step 4: Map extracted data → Transaction rows**
- Invoice → 1 Transaction + N `TransactionLineItems` (one per product/service)
- Bank Statement → N Transactions (one per row in the statement)
- Salary Register → N Transactions (one per employee)
- `confidence_score` stored on each transaction (0.0–1.0)
- `low_confidence_fields` array: field names Claude wasn't sure about
- Full `raw_ai_output` stored as JSONB for audit/debug

**Step 5: Update status + notify**
- `Document.status` → `extracted`
- SSE notification pushed to all accountants of the firm: "Document ready for review"

**Document Types (DB-driven, not hardcoded):**
| Slug | Name | Claude Extracts |
|---|---|---|
| `invoice_purchase` | Purchase Invoice | Vendor, invoice #, date, line items, GST breakdown |
| `invoice_sales` | Sales Invoice | Customer, invoice #, date, line items |
| `payment_receipt` | Payment Receipt | Payer, payee, amount, payment mode, reference # |
| `salary_register` | Salary Register | Per-employee: name, basic pay, HRA, deductions, net pay |
| `bank_statement` | Bank Statement | Per-row: date, narration, debit/credit, balance |
| `transaction_ledger` | Transaction Ledger | Date, account, debit/credit, narration |

**Adding a new document type = 1 SQL INSERT, zero code changes.** The `_map_to_transactions()` function has a generic fallback for unknown slugs.

---

### C. Accountant Review Workflow

**State machine (two terminal states):**
```
pending_review → accepted   (accountant corrects + accepts)
pending_review → rejected   (accountant rejects with mandatory note)
```
Accepted and rejected are permanent — no "send back for correction" loop.

**Review page flow:**
1. Accountant opens `/accountant/review` — table of all `pending_review` transactions across their firm
2. Low-confidence transactions are visible via the amber confidence badge
3. Click any row → `TransactionDrawer` opens (full-screen overlay)
4. Left side: editable fields pre-filled with AI-extracted values
5. Amber highlighting on low-confidence fields (driven by `low_confidence_fields` array)
6. Payment Head + Sub-Head dropdowns (company-specific taxonomy)
7. **Accept**: `PUT /transactions/{id}` (saves edits) then `POST /transactions/{id}/accept`
   - Sets `status = accepted`, `reviewed_by = accountant.id`, `reviewed_at = now()`
   - SSE notification → company user: "Your transaction was accepted"
   - Audit log written
8. **Reject**: `POST /transactions/{id}/reject` with mandatory `rejection_note`
   - Sets `status = rejected`, stores rejection note
   - SSE notification → company user with the rejection reason
   - Audit log written

---

### D. Real-Time Notifications (SSE)

**Why SSE instead of WebSocket?**
- Financial document status is unidirectional: server → client only
- SSE is browser-native (`EventSource` API), no extra library
- No extra infrastructure — one FastAPI endpoint
- WebSocket would add bidirectional complexity that isn't needed here

**How it works:**
1. Frontend calls `EventSource('http://localhost:8000/notifications/stream?token=<jwt>')`
   - Token in query param because `EventSource` API cannot set custom headers
2. Backend `GET /notifications/stream` decodes token from query param, identifies user
3. Creates an `asyncio.Queue` for this connection and registers it in `_streams[user_id]`
4. Async generator yields events from the queue; 30-second heartbeat keeps connection alive
5. When any event occurs (document extracted, transaction reviewed):
   - `create_notification()` inserts DB record + calls `_push_to_streams(user_id, payload)`
   - All open connections for that user receive the event simultaneously
6. Frontend `useNotifications()` hook: handles `notification` events, calls `addNotification()` in Zustand store
7. `NotificationBell` component reads unread count from Zustand, shows red badge

**Notifications are targeted, not broadcast — no cross-company leakage.**

The queue is keyed per user:
```python
_streams: dict[str, list[asyncio.Queue]]
# { "user-uuid-123": [queue1, queue2], "user-uuid-456": [queue1] }
```
Each user has their own queue list — one entry per open browser tab. Pushing to a user's queue only reaches that specific user. If the same user has two tabs open, both receive the event simultaneously.

**Who gets notified — by action:**

| Action | Function Called | Who Receives It |
|---|---|---|
| Document extracted (success/fail) | `notify_company_users(company_id)` | All **company_admin + company_user** of that company only |
| Transaction **accepted** | `notify_company_users(company_id)` | All users of that specific company |
| Transaction **rejected** | `notify_company_users(company_id)` | All users of that specific company |
| New document uploaded (ready for review) | `notify_firm_accountants(firm_id)` | All **accountants** under that firm |
| Report published | `notify_company_users(company_id)` | All users of that company |

**Example to illustrate isolation:**
- TechCorp uploads an invoice → `notify_firm_accountants(apex_firm_id)` → only `accountant1@apex.com` and `accountant2@apex.com` are pinged. ManuFab's admin sees nothing.
- Accountant accepts the transaction → `notify_company_users(techcorp_id)` → only `admin@techcorp.com` and `user@techcorp.com` are notified. ManuFab users see nothing.

**The push mechanism internally:**
```python
def notify_company_users(db, company_id, message, ...):
    users = db.query(User).filter(
        User.company_id == company_id,
        User.role.in_([company_admin, company_user])
    ).all()

    for user in users:
        create_notification(db, user.id, message, ...)  # writes to DB
        _push_to_streams(str(user.id), payload)          # pushes to live SSE queues
```
`_push_to_streams` iterates over `_streams[user_id]` and puts the payload into every open queue for that user — covering multiple tabs.

---

### E. Audit Trail

Every mutation in the system calls:
```python
log_action(db, user_id, action, entity_type, entity_id, company_id, meta={...})
```

**Complete list of logged actions:**

| Action | Entity Type | Where Logged | Meta Fields |
|---|---|---|---|
| `firm_created` | `firm` | `firms.py → create_firm` | `firm_name`, `admin_email` |
| `company_created` | `company` | `companies.py → create_company` | `company_name`, `business_type`, `admin_email` |
| `accountant_added` | `user` | `companies.py → create_accountant` | `email`, `full_name` |
| `company_user_added` | `user` | `company_users.py → create_company_user` | `email`, `full_name` |
| `document_uploaded` | `document` | `documents.py → upload_document` | `filename`, `document_type` |
| `document_extracted` | `document` | `ai_extraction.py` | `transactions_created`, `confidence_score` |
| `document_deleted` | `document` | `documents.py → delete_document` | `filename`, `document_type_id` |
| `document_retry` | `document` | `documents.py → retry_extraction` | `filename` |
| `transaction_accepted` | `transaction` | `transactions.py → accept_transaction` | `party_name`, `amount` |
| `transaction_rejected` | `transaction` | `transactions.py → reject_transaction` | `party_name`, `rejection_note` |
| `report_uploaded` | `report` | `reports.py → upload_report` | `title`, `filename` |
| `report_deleted` | `report` | `reports.py → delete_report` | `title`, `filename` |
| `payment_head_created` | `payment_head` | `payment_heads.py → create_head` | `name` |
| `payment_head_deleted` | `payment_head` | `payment_heads.py → delete_head` | `name` |
| `payment_sub_head_created` | `payment_head` | `payment_heads.py → create_sub_head` | `name`, `head_name` |
| `payment_sub_head_deleted` | `payment_head` | `payment_heads.py → delete_sub_head` | `name` |
| `payment_heads_preset_applied` | `payment_head` | `payment_heads.py → apply_preset` | `business_type`, `heads_created` |

**Firm Admin audit view:** `GET /audit-logs` — filterable by company, action type, entity type (`document`, `transaction`, `report`, `firm`, `company`, `user`, `payment_head`), and date range. Every row shows: timestamp, user email, action, entity type, company name, expandable meta details.

**How it works technically:** `log_action()` simply does `db.add(AuditLog(...))` — the caller is always responsible for `db.commit()`. This means the audit record and the business change commit atomically in the same transaction. If the business operation fails and rolls back, the audit record is also rolled back — no phantom audit entries.

---

### F. AI Insights Panel ⭐ Phase 15

**Design philosophy:** Real financial SaaS tools (QuickBooks, Zoho Books, Tally) provide pre-defined report queries — not open-ended NLP — because financial queries must be exact and predictable.

**Why NOT Text-to-SQL:**
- LLMs hallucinate SQL — wrong joins, wrong filters, wrong aggregations
- Tenant isolation cannot be guaranteed if Claude writes the WHERE clause
- Unpredictable results make it unusable in a real accounting context

**How the panel works:**
1. "✨ Ask AI" button floats bottom-right on all portals (rendered via React Portal into `document.body`)
2. Opens a 420px slide-in panel
3. 7 pre-built query cards shown on open
4. User clicks a card → `POST /chat/run { query_id: "spend_by_head" }`
5. Backend looks up the query ID in the registry, executes pre-written SQLAlchemy query
6. `company_id` injected from JWT — user cannot override scope
7. Results (up to 200 rows) serialized to dicts
8. Claude `claude-sonnet-4-6` called with results → writes 2–3 sentence plain-English summary
9. Returns: `{ answer, rows, columns, query_label }`
10. Panel shows: Claude summary bubble + scrollable results table

**The 7 queries:**
| Card | What it runs |
|---|---|
| Pending > ₹1 Lakh | `WHERE status='pending_review' AND amount >= 100000 ORDER BY amount DESC` |
| Spend by Expense Head | `SUM(amount) GROUP BY payment_head.name WHERE status='accepted'` |
| Top Vendors | `SUM(amount) GROUP BY party_name WHERE status='accepted' LIMIT 10 per group` |
| Low Confidence | `WHERE confidence_score < 0.8 AND status='pending_review'` |
| Rejected + Reasons | `WHERE status='rejected' ORDER BY reviewed_at DESC` |
| Monthly Trend | 6-month loop of `SUM(amount) WHERE status='accepted'` |
| All Pending | `WHERE status='pending_review' ORDER BY amount DESC` |

**Claude's exact role in this feature:** Reads the serialized row data and writes a plain-English business summary. It does NOT write SQL. It does NOT decide what data to show.

**Role-aware data segregation:**

The panel automatically scopes and groups results based on the logged-in user's role:

| Role | Scope | Group Column Added | Data shown |
|---|---|---|---|
| Company Admin / Company User | `single` | None | Only that company's data |
| Accountant / Firm Admin | `firm` | **Company** column | Per-company breakdown within their firm |
| Platform Admin | `platform` | **Firm** column | Firm-level aggregated data across all firms |

For firm scope, each query result row includes a `Company` column so accountants can compare Acme Corp vs TechStart side by side.

For platform scope, each query result row includes a `Firm` column. Multiple companies under the same firm are aggregated together (spend summed, vendors merged) so the platform admin sees firm-level patterns, not company-level noise.

**How the segregation is implemented (`backend/app/routers/chat.py`):**
```python
# In run_query():
if current_user.role in (company_admin, company_user):
    companies = [current company]
    scope = "single"
elif current_user.role in (accountant, firm_admin):
    companies = [all companies in their firm]
    scope = "firm"
    label_map = {str(c.id): c.name for c in companies}      # company_id → company name
else:  # platform_admin
    companies = [all companies on platform]
    scope = "platform"
    label_map = {str(c.id): firm_name for c in companies}    # company_id → firm name

# _group_col(scope) → "Company" if firm, "Firm" if platform, None if single
# Every query prepends this column to results when gc is not None
# For platform scope, _aggregate_rows() sums amounts across companies in same firm
```

---

### G. Reports

- Accountants upload MIS reports (PDFs/Excel) via `/accountant/reports`
- Tagged to a specific company
- Company admins download via `/company/reports`
- **Download auth trick:** Browser `<a href>` downloads cannot set `Authorization` headers. Solution: backend accepts `?token=<jwt>` query param, manually decodes and validates it. Frontend appends token via `downloadUrl()` helper.

---

### H. PWA / Mobile

- `vite-plugin-pwa` + Workbox service worker — app is installable from Chrome on Android/iOS
- Manifest: name "FinBridge", indigo theme color, standalone display mode
- Upload page: `<input accept="image/*" capture="environment">` → opens device camera directly
- Offline fallback page served by service worker when network is unavailable
- All pages use Tailwind responsive classes — works on mobile screens

---

## 4. Database Schema — Key Design Decisions

### Why JSONB for `extracted_data` and `raw_ai_output`?
Different document types extract completely different fields. An invoice has `invoice_number`, `gstin`, `cgst`; a salary register has `employee_id`, `basic_pay`, `hra`. Storing these in a fixed-column schema would require either a massive table with mostly-null columns or a separate table per document type. JSONB gives flexibility — each transaction stores exactly what Claude extracted for its type.

### Why `document_types` is a table not an enum?
If document types were hardcoded, adding "Purchase Order" or "Delivery Challan" would require a code deployment. With `document_types` as a DB table (storing the Claude prompt template + expected fields JSON), adding a new type is a single SQL INSERT. Zero code changes.

### UUID primary keys everywhere
No sequential IDs means no ID enumeration attacks. A malicious user cannot guess `transaction/1`, `transaction/2`, etc.

### `confidence_score` + `low_confidence_fields`
These are returned by Claude as part of the `tool_use` response. Stored in the `transactions` table. The frontend uses them to highlight amber warnings for accountants — guiding human attention to where AI was uncertain.

---

## 5. Complete Tech Stack with Rationale

| Layer | Technology | Why This Choice |
|---|---|---|
| **Backend** | Python 3.12 + FastAPI | Async-native, Anthropic SDK is Python-first, Pydantic validation for free |
| **AI** | Claude claude-sonnet-4-6 | Native PDF support, best vision accuracy for financial docs, `tool_use` for deterministic JSON |
| **ORM** | SQLAlchemy 2.0 + Alembic | Type-safe queries, migration management, JSONB support |
| **Database** | PostgreSQL 16 | JSONB for flexible extraction data, mature, reliable |
| **Auth** | JWT + bcrypt (python-jose) | Stateless → horizontal scaling; role+tenant embedded in token |
| **Real-time** | Server-Sent Events | Unidirectional server→client push, no extra infra, browser-native |
| **Frontend** | React 18 + Vite + TypeScript | Fast HMR, type safety, PWA-ready |
| **Styling** | Tailwind CSS v4 | Utility-first, consistent design system, no CSS file maintenance |
| **State** | React Query + Zustand | React Query for server state (caching, refetch), Zustand for client state (auth, notifications) |
| **PWA** | vite-plugin-pwa + Workbox | Service worker, installable, offline support, camera access |

---

## 6. API Endpoints Summary

```
POST   /auth/login                          → JWT token
POST   /auth/logout

GET    /firms                               → list firms (platform_admin)
POST   /firms                               → create firm
GET    /firms/{id}/companies                → companies under firm
POST   /firms/{id}/companies                → create company
GET    /firms/{id}/accountants              → accountants under firm

GET    /companies/{id}/payment-heads        → payment taxonomy
POST   /companies/{id}/payment-heads
POST   /companies/{id}/payment-heads/{id}/sub-heads

POST   /documents/upload                    → upload + trigger AI extraction
GET    /documents                           → list (role-filtered)
GET    /documents/{id}                      → detail with transactions
DELETE /documents/{id}                      → delete document (audited)
POST   /documents/{id}/retry               → re-trigger extraction (audited)

GET    /transactions                        → list (role-filtered, filterable)
PUT    /transactions/{id}                   → edit fields (accountant)
POST   /transactions/{id}/accept           → accept + notify
POST   /transactions/{id}/reject           → reject + notify

GET    /reports                             → list (role-filtered)
POST   /reports                             → upload MIS report (audited)
GET    /reports/{id}/download?token=...    → download file
DELETE /reports/{id}                        → delete report (audited)

GET    /dashboard/summary                   → role-aware analytics

GET    /notifications                       → list notifications
GET    /notifications/stream?token=...     → SSE stream
POST   /notifications/{id}/read            → mark read

GET    /audit-logs                          → audit trail (firm_admin only)

GET    /companies/users                     → list company users (company_admin)
POST   /companies/users                     → create company user (company_admin)
PUT    /companies/users/{id}               → update company user name (company_admin)
DELETE /companies/users/{id}               → remove company user (company_admin)

GET    /chat/queries                        → 7 query cards
POST   /chat/run                            → run query + Claude explanation
```

---

## 7. Anticipated Judge Questions — Full Answers

**Q: "How does the AI extraction actually work? Walk me through it."**

When a company uploads an invoice PDF, FinBridge fires a background task. The task reads the `document_types` table to get the Claude system prompt and expected field schema for that document type. It then dynamically builds a Claude `tool_use` schema from those fields, sends the PDF (base64 encoded) plus the schema to Claude claude-sonnet-4-6 using the vision API. Claude is forced via `tool_choice` to respond ONLY through the structured tool — so it returns exact JSON: vendor name as a string, total amount as a number, date in YYYY-MM-DD format. No parsing needed. The result is mapped to database Transaction rows, confidence scores are stored, and accountants are notified via SSE.

---

**Q: "How do you ensure one company can't see another company's data?"**

Every API endpoint in the backend reads `company_id` and `firm_id` from the JWT token — which is signed server-side at login and cannot be tampered with by the client. The client never sends tenant context. Every database query has a filter like `Transaction.company_id == current_user.company_id`. For the AI Insights panel, the `company_id` is injected directly into the SQLAlchemy query from the JWT — Claude cannot influence it. Even if a malicious user modified the `query_id` in the request, they only choose which pre-written query runs, not which company's data it accesses.

---

**Q: "Why Claude over GPT-4 or Gemini?"**

Three specific reasons: First, Claude claude-sonnet-4-6 has native PDF support via the `pdfs-2024-09-25` beta, which means PDFs are processed directly without converting to images — better fidelity on multi-page invoices. Second, Claude's `tool_use` with forced `tool_choice` gives the most reliable structured JSON output — in our testing, it handles Indian GST number formats, comma-separated Indian number formats, and partially-visible fields better than alternatives. Third, the Anthropic Python SDK integrates naturally with our FastAPI + async architecture.

---

**Q: "What if Claude misreads a field?"**

Two safety nets: First, `confidence_score` — Claude returns a score between 0 and 1 for the overall extraction, and `low_confidence_fields` lists specifically which fields it was uncertain about. The UI highlights these in amber for the accountant. Second, the accountant review step is mandatory — no transaction goes to "accepted" without a human reviewing it. The accountant can correct any AI error before accepting. The full raw Claude response is stored in `raw_ai_output` JSONB for debugging any systematic issues.

---

**Q: "How does the real-time notification work technically?"**

When an accountant accepts a transaction, the backend calls `notify_company_users()`. This creates a `Notification` DB record and pushes to an `asyncio.Queue` for each company user currently connected. The frontend connected an `EventSource` at login to `GET /notifications/stream?token=<jwt>` — token in the query param because the browser's `EventSource` API cannot set custom HTTP headers. The backend's async generator yields events from the queue every time one arrives, with a 30-second heartbeat to keep the connection alive. The frontend's `useNotifications()` hook listens for the `notification` event type and adds it to the Zustand store, which triggers the bell badge to update.

---

**Q: "How would you scale this to production?"**

The architecture was designed with scaling in mind. File storage is abstracted behind `UPLOAD_DIR` — swapping to S3 is a config change. SSE queues are currently in-memory dictionaries — replacing with Redis pub/sub would allow multiple backend instances. Background extraction jobs could move to Celery with a Redis broker. JWT is stateless so the backend scales horizontally behind a load balancer with no session sharing. PostgreSQL connection pooling via PgBouncer. The only shared mutable state is the SSE queue dict — everything else is already stateless.

---

**Q: "Why pre-built queries for the AI panel instead of letting users type questions?"**

Because financial data queries need to be exact. If Claude generates SQL from natural language, it might join the wrong tables, miss a filter, or aggregate incorrectly — and in accounting, wrong numbers have real consequences. Pre-built queries are tested and correct. Claude's role is only to explain the results in plain English — it never touches the query logic. This is also how production financial tools work: QuickBooks has a report menu, not a chat box. Our approach gives the UX of AI (natural language answers) with the reliability of hardcoded queries.

---

**Q: "What's the database schema for the AI extraction output?"**

The `transactions` table has:
- `extracted_data` JSONB — all type-specific fields Claude extracted (flexible per document type)
- `raw_ai_output` JSONB — full unprocessed Claude response for audit/debug
- `confidence_score` Numeric — overall extraction confidence
- `low_confidence_fields` JSONB array — field names Claude was uncertain about
- `party_name`, `amount`, `transaction_date`, `description` — normalized common fields present for ALL document types regardless of what else was extracted

---

## 8. Demo Flow Cheat Sheet

| Step | Login | Action | What to Show |
|---|---|---|---|
| 1 | admin@techcorp.com / Tech@1234 | Upload any PDF invoice | Upload UI, drag-and-drop, document type picker |
| 2 | Same | Wait ~10 seconds | Status changes: pending → processing → extracted in real time |
| 3 | accountant1@apex.com / Acc@1234 | Open Review Queue | Bell notification, pending transaction list |
| 4 | Same | Click transaction, review | Editable fields, confidence badges, payment head dropdown |
| 5 | Same | Click Accept | Transition animation, queue clears |
| 6 | admin@techcorp.com / Tech@1234 | Check bell notification | "Transaction accepted" notification |
| 7 | firm@apexaccounting.com / Firm@1234 | Audit Trail page | Every action logged with user + timestamp |
| 8 | Any role | Click "✨ Ask AI" button | Panel opens with 7 query cards |
| 9 | Same | Click "Pending > ₹1 Lakh" | Real DB data + Claude's plain-English summary |

**Demo credentials quick reference:**
- Platform Admin: `admin@finbridge.com` / `Admin@123`
- Firm Admin: `firm@apexaccounting.com` / `Firm@1234`
- Accountant: `accountant1@apex.com` / `Acc@1234`
- TechCorp Admin: `admin@techcorp.com` / `Tech@1234`
- ManuFab Admin: `admin@manufab.com` / `Manu@1234`

---

## 9. What We'd Build Next

1. **S3 file storage** — replace local `uploads/` with AWS S3; already abstracted behind `UPLOAD_DIR`
2. **GST validation API** — auto-verify GSTIN against government API; flag mismatches before accountant review
3. **WhatsApp bot integration** — company sends bill photo to a WhatsApp number → auto-extracted and loaded into FinBridge (removes even the portal upload step)
4. **Multi-currency support** — handle USD/EUR invoices; store currency, show converted INR equivalent
5. **ML payment head suggestions** — train on accepted transactions to auto-suggest payment heads; learns from accountant corrections over time
6. **Email notifications** — supplement SSE with email alerts for critical events (document rejected, report published)
7. **Bulk accept with confidence threshold** — accountant can select all transactions with confidence ≥ 0.95 and accept in one click

---

*End of Technical Briefing — FinBridge Hackathon 2025*
