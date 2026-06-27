# BEM CRM — Complete Codebase Documentation

> **Project:** CRM Dashboard for BEM Solutions  
> **Repository:** `CRM/` (monorepo: `backend/` + `frontend/`)  
> **Last updated:** June 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Database (MongoDB + Prisma)](#5-database-mongodb--prisma)
6. [Backend](#6-backend)
7. [API Reference](#7-api-reference)
8. [Frontend](#8-frontend)
9. [Authentication & Sessions](#9-authentication--sessions)
10. [Security](#10-security)
11. [Lead Workflow & Business Logic](#11-lead-workflow--business-logic)
12. [Uploads & Data Import](#12-uploads--data-import)
13. [Chat System](#13-chat-system)
14. [Background Jobs (Cron)](#14-background-jobs-cron)
15. [Caching](#15-caching)
16. [External Services](#16-external-services)
17. [Environment Variables](#17-environment-variables)
18. [Local Development](#18-local-development)
19. [Deployment Notes](#19-deployment-notes)

---

## 1. Overview

This is a **full-stack Customer Relationship Management (CRM)** system used internally by BEM Solutions. It manages:

- **Lead assignment** to CSRs (Customer Service Representatives)
- **Daily call workflows** (pending, not picked, not interested, important, interested, etc.)
- **Active projects** (won clients with phases, deadlines, payments)
- **Admin bulk Excel uploads** with CSR distribution
- **Internal chat** between admin and CSRs
- **Reports**, audit logs, and security controls

### User Roles

| Role | Route prefix | Purpose |
|------|--------------|---------|
| `admin` | `/admin/*` | Full system control: users, uploads, all leads, reports, bin, projects |
| `csr` | `/csr/*` | Own assigned leads, status updates, clients, projects, chat |

### Seed Accounts (`backend/prisma/seed.ts`)

| Email | Password | Role |
|-------|----------|------|
| `admin@gmail.com` | `123456` | admin |
| `csr@gmail.com` | `123456` | csr (code: CSR001) |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js 16)                      │
│  /admin/*  |  /csr/*  |  / (login)  |  proxy.ts (route guard)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │  /api/auth/set-session       │  httpOnly cookie
              │  /api/backend/[...path]      │  reverse proxy
              └──────────────┬──────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Express 5 API (port 5000)                        │
│  /api/auth | /api/admin | /api/csr | /api/uploads | /api/chat    │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    MongoDB            Cloudinary          Gmail SMTP
   (Prisma ORM)      (files, reports)    (2FA OTP, alerts)
         │
    Cloudflare Turnstile (login CAPTCHA)
    Have I Been Pwned (password breach check)
```

### Request Flow (Development)

1. Browser calls `/api/backend/csr/dashboard` (same-origin proxy)
2. Next.js `app/api/backend/[...path]/route.ts` forwards to `http://127.0.0.1:5000/api/csr/dashboard`
3. Cookie `token` + optional `Authorization: Bearer` header sent to backend
4. `verifyToken` middleware validates JWT + session binding
5. `allowRoles("csr")` checks role
6. Handler returns JSON

---

## 3. Tech Stack

### Backend (`backend/`)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js, TypeScript 5.8 |
| Framework | Express 5.1 |
| ORM | Prisma 6.19 → **MongoDB** |
| Auth | JWT + httpOnly cookies, bcryptjs |
| Security | helmet, cors, express-rate-limit, login lockout |
| Files | multer (memory), xlsx (Excel parse), Cloudinary |
| Email | Nodemailer (Gmail SMTP) |
| Dev | ts-node-dev |

### Frontend (`frontend/`)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.2 (App Router), React 19 |
| Styling | Tailwind CSS v4, CSS variables (light/dark) |
| HTTP | Axios (`lib/api.ts`) |
| Charts | Recharts |
| Themes | next-themes |
| Icons | lucide-react, react-icons |
| PDF | jspdf + jspdf-autotable |
| Toasts | react-hot-toast |

---

## 4. Repository Structure

```
CRM/
├── CODEBASE.md                 ← this file
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # MongoDB models
│   │   └── seed.ts             # Default users
│   └── src/
│       ├── server.ts           # Entry + cron jobs
│       ├── app.ts              # Express setup, route mounting
│       ├── config/             # db, env, cloudinary, security
│       ├── controllers/        # auth, user, upload, report (5 files)
│       ├── middleware/         # auth, role, rateLimit, upload, adminIp
│       ├── routes/             # 8 route modules (most logic inline)
│       └── utils/              # ~25 domain helpers
└── frontend/
    ├── proxy.ts                # Route guard (replaces middleware.ts)
    ├── app/
    │   ├── page.tsx            # Login
    │   ├── layout.tsx          # Root layout, ThemeProvider
    │   ├── globals.css         # Design tokens + dark mode bridge
    │   ├── api/
    │   │   ├── auth/           # set-session, clear-session
    │   │   └── backend/      # Reverse proxy to Express
    │   ├── admin/              # Admin pages + components
    │   ├── csr/                # CSR pages + hooks + constants
    │   └── components/         # Shared UI (chat, projects, theme, tables)
    └── lib/                    # api, session, caches, chat utilities
```

---

## 5. Database (MongoDB + Prisma)

**Provider:** MongoDB (`DATABASE_URL`)  
**IDs:** `cuid()` mapped to `_id` via `@map("_id")`  
**Statuses on Lead:** string-based (not Prisma enums) for flexibility

### Models

#### `User`
Core auth and profile entity.

| Field | Type | Notes |
|-------|------|-------|
| `role` | `admin` \| `csr` | Enum |
| `csrCode` | String? | e.g. CSR001 — used in client codes |
| `cnic`, `cnicPdfUrl` | String? | Identity docs (Cloudinary) |
| `profilePic` | String? | Cloudinary URL |
| `isActive` | Boolean | Deactivated after 90d inactivity (CSR) |
| `isOnline`, `lastActive` | Boolean, DateTime? | Presence heartbeat |
| `twoFAEnabled` | Boolean | Email OTP on login |
| `tokenVersion` | Int | Incremented to invalidate all sessions |
| `activeSessionId` | String? | Single active session binding |

**Relations:** leads (assigned), callLogs, reports, chat memberships/messages, auditLogs, accessHistory

#### `Lead` (central entity)
| Field | Notes |
|-------|-------|
| `status` | Default `"pending"` — see [Lead Statuses](#lead-statuses) |
| `assignedTo` | FK → User (CSR) |
| `important`, `interested` | Boolean flags synced with status |
| `nextSchedule`, `nextTime`, `timezone` | Scheduled important calls |
| `followUpNotes` | Multi-line try history (Not Interested / Not Picked) |
| `interestedService` | Service type when interested |
| `projectTitle`, `projectCode`, `projectDeadline`, etc. | Active project fields |
| `projectPhase` | `not_started`, takeoff/pricing/QA phases |
| `projectPayments` | JSON string of payment entries |
| `clientCode` | Auto-generated on Close Client: `{csrCode}-{seq}` |
| `isOldClient` | Auto-set if company had prior won project |
| `notInterestedCount`, `notPickedCount` | Retry counters (limits: 3 / 7) |
| `inBin`, `binReason`, `binPreviousStatus` | Soft-delete / bin system |
| `hiddenOnMain` | Hides from CSR main dashboard (special uploads) |
| `uploadedFileId` | FK → UploadFile |

**Indexes:** `assignedTo`, `status`, `phone`, `email`, `company`, `createdAt`, `updatedAt`, composites

#### `LeadNote`
Timestamped notes per lead (`leadId`, `text`, `createdAt`).

#### `SubContact`
Additional contacts on a lead (name, designation, phone, email).

#### `CallLog`
CSR status change history (`leadId`, `csrId`, `status`, `createdAt`).

#### `UploadSource`
Admin-only source tracking with optional `sudoName` (shown to CSRs on leads).

#### `UploadFile`
Excel upload metadata: `fileName`, `cloudinaryUrl`, `totalLeads`, `uploadCategory`, `sourceId`.

**Upload categories:** `call-data`, `new-client`, `old-client`, `interested`, `important`, `active-projects`

#### `Report`
Generated or uploaded reports (`reportName`, `reportUrl`, `reportType`, `generatedBy`).

#### `Conversation`, `ConversationMember`, `Message`
Internal chat: direct + group, file messages, reactions (JSON), replies, mentions, pin, archive.

#### Security / Infra Models
- `SecurityAuditLog` — login, logout, 2FA, account events
- `AccessHistory` — per-user login device/IP history
- `LoginLockout` — failed attempt tracking per key
- `LoginAttemptAlert` — concurrent login attempt notifications
- `RateLimitEntry` — Prisma-backed rate limit store (production)

### Entity Relationship (simplified)

```
User ──< Lead (assignedTo)
Lead ──< LeadNote, SubContact, CallLog
UploadSource ──< UploadFile ──< Lead
User ──< Report
Conversation ──< ConversationMember >── User
Conversation ──< Message >── User (sender)
```

---

## 6. Backend

### Entry Point: `src/server.ts`

1. Loads `.env`, validates env
2. Starts Express on `PORT` (default **5000**)
3. Runs background jobs (see [§14](#14-background-jobs-cron))

### App Setup: `src/app.ts`

| Middleware | Purpose |
|------------|---------|
| `helmet` | CSP (prod), HSTS, security headers |
| `cors` | Allowlist: localhost, bemsolutions.io, Vercel, `FRONTEND_URL` |
| `express.json` | 1 MB limit |
| `cookieParser` | JWT cookie |
| `apiLimiter` | 300 req/min on `/api` (Prisma store in prod) |

### Route Mounting

| Prefix | File | Default auth |
|--------|------|--------------|
| `/api/auth` | `auth.routes.ts` | Mixed |
| `/api/admin` | `admin.routes.ts` | Admin + IP allowlist |
| `/api/csr` | `csr.routes.ts` | CSR |
| `/api/users` | `user.routes.ts` | Authenticated |
| `/api/uploads` | `upload.routes.ts` | Admin (via controller) |
| `/api/reports` | `report.routes.ts` | Admin |
| `/api/report-uploads` | `reportUpload.routes.ts` | Admin |
| `/api/chat` | `chat.routes.ts` | Authenticated |

### Controllers (`src/controllers/`)

| File | Responsibility |
|------|----------------|
| `auth.controller.ts` | Login, logout, register, 2FA OTP, profile, password, audit logs |
| `user.controller.ts` | updateUser, deleteUser, adminSetUserPassword |
| `upload.controller.ts` | Excel import, preview, history, delete, patch source |
| `report.controller.ts` | getReports |
| `reportUpload.controller.ts` | Manual report upload/delete to Cloudinary |

> **Note:** Most admin/CSR/chat business logic lives **inline in route files** (~900–1300 lines each), not in controllers.

### Key Utils (`src/utils/`)

| File | Purpose |
|------|---------|
| `binLeads.ts` | Bin filters, limits (NI=3, NP=7), `buildBinWhere` |
| `projectLeads.ts` | Project lead queries, display filters |
| `projectPayments.ts` | Payment parsing, totals |
| `uploadExcelParse.ts` | Excel row parsing |
| `uploadSourceStats.ts` | Source analytics |
| `purgeCsrLeads.ts` | CSR lead purge |
| `deleteLeadsCascade.ts` | Cascade delete + cache invalidation |
| `sessions.ts` | OTP store, active session, touch |
| `auditLog.ts` | Security audit writes |
| `loginLockout.ts` | Brute-force protection |
| `captcha.ts` | Cloudflare Turnstile verify |
| `passwordBreach.ts` | HIBP k-anonymity check |
| `cache.ts` | In-memory TTL cache |
| `leadPhoneLookup.ts` | Returning client phone lookup |
| `adminClientQueries.ts` | Admin leads list/summary queries |

---

## 7. API Reference

All endpoints prefixed with `/api`. Auth: `verifyToken` unless noted.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/captcha-config` | Public | Turnstile site key + enabled flag |
| POST | `/login` | Public | Login (rate limited, CAPTCHA after failures) |
| POST | `/verify-otp` | Public | 2FA OTP verification |
| POST | `/resend-otp` | Public | Resend OTP |
| POST | `/register` | Admin | Create new user |
| POST | `/logout` | Auth | Logout current session |
| GET | `/me` | Auth | Current user profile |
| GET | `/session-status` | Auth | Session validity check |
| POST | `/session-alert/ack` | Auth | Acknowledge login attempt alert |
| POST | `/logout-all` | Auth | Invalidate all devices |
| GET | `/audit-logs` | Admin | Security audit log list |
| PUT | `/profile` | Auth | Update name, email, etc. |
| PUT | `/change-password` | Auth | Change own password |
| PUT | `/toggle-2fa` | Auth | Enable/disable 2FA |

### Admin — `/api/admin`

Protected by `verifyToken` + `allowRoles("admin")` + `enforceAdminIpAllowlist`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Legacy dashboard stub |
| GET | `/notifications` | Scheduled important calls (all CSRs) |
| GET | `/csrs` | Active CSR list (cached) |
| GET | `/clients/summary` | Dashboard stats + chart data |
| GET | `/clients` | Paginated leads list (tabs, filters) |
| GET | `/lead/:id` | Single lead detail |
| PUT | `/lead/:id` | Update lead |
| DELETE | `/lead/:id` | Delete lead (cascade) |
| PUT | `/lead/:id/reassign` | Reassign to another CSR |
| POST | `/lead/:id/notes` | Add note |
| PUT/PATCH/DELETE | `/lead/:id/notes/:noteId` | Edit/delete notes |
| POST/DELETE | `/lead/:id/subcontacts` | Sub-contact CRUD |
| GET | `/projects` | Active projects list |
| POST | `/project` | Create project lead |
| PUT | `/project/:id` | Update project |
| DELETE | `/project/:id` | Delete project lead |
| GET | `/lookup-by-phone` | Phone-based client lookup |
| GET | `/bin` | Bin leads (`buildBinWhere`, cached) |
| POST | `/shuffle` | Manual lead shuffle trigger |
| GET/POST/PATCH/DELETE | `/upload-sources` | Upload source CRUD |
| GET | `/upload-sources/:sourceId` | Source detail + stats |
| GET | `/access-history/:userId` | User login history |
| POST | `/migrate-legacy-notes` | One-time notes migration |

### CSR — `/api/csr`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | CSR main leads (cached ~28s) |
| GET | `/leads` | Client directory leads |
| GET | `/not-interested` | NI + NP retry leads (cached) |
| GET | `/bin` | CSR bin leads (cached) |
| GET | `/projects` | Active projects (cached) |
| GET | `/notifications` | Scheduled calls + 24h activity stats |
| GET | `/activity-report` | CSR activity by date range |
| GET | `/lead/:id` | Lead detail |
| PUT | `/lead/:id` | Update lead + status logic (NI/NP limits) |
| POST | `/lead` | Manual lead create |
| PUT | `/lead/:id/assign` | Manual assign after limit reached |
| GET | `/lookup-by-phone` | Returning client lookup |
| GET | `/csrs` | Other active CSRs (for reassignment) |
| POST | `/heartbeat` | Presence ping (`isOnline`, `lastActive`) |
| POST | `/offline` | Mark offline (beacon on tab close) |
| POST/PUT/DELETE | `/lead/:id/notes` | Notes CRUD |
| POST/DELETE | `/lead/:id/subcontacts` | Sub-contacts |

### Uploads — `/api/uploads`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Upload Excel → parse → distribute to CSRs |
| POST | `/preview` | Dry-run preview (duplicates, counts) |
| GET | `/latest` | Latest upload metadata |
| GET | `/history` | Upload history |
| PATCH | `/:id/source` | Assign/change upload source |
| DELETE | `/:id` | Delete upload + cascade leads |

### Reports — `/api/reports` & `/api/report-uploads`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/` | List reports |
| POST | `/report-uploads/` | Upload report file to Cloudinary |
| DELETE | `/report-uploads/:id` | Delete report |

### Chat — `/api/chat`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | List conversations (optional `?archived=1`) |
| POST | `/conversations` | Create direct or group |
| DELETE | `/conversations/:id` | Delete conversation |
| GET | `/conversations/:id/messages` | Messages + pinned message |
| POST | `/conversations/:id/messages` | Send text/file (up to 200 MB) |
| PATCH | `/messages/:id` | Edit message |
| DELETE | `/messages/:id` | Delete message |
| POST | `/messages/:id/reactions` | Add/remove reaction |
| POST | `/conversations/:id/read` | Mark read |
| POST/GET | `/conversations/:id/typing` | Typing indicators (in-memory) |
| POST | `/conversations/:id/pin` | Pin message |
| POST | `/conversations/:id/archive` | Archive |
| POST | `/conversations/:id/unarchive` | Unarchive |
| POST | `/status` | Online/offline status |
| GET | `/users` | Chat user directory |
| GET | `/conversations/:id/members` | Group members |

### Users — `/api/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin/CSR | User list |
| POST | `/upload-pic` | Auth | Profile picture |
| POST | `/upload-cnic` | Admin | CNIC PDF upload |
| PUT | `/:id` | Admin | Update user |
| PUT | `/:id/password` | Admin | Set user password |
| DELETE | `/:id` | Admin | Delete user |

---

## 8. Frontend

### Routing

| Path | Page | Role |
|------|------|------|
| `/` | Login | Public |
| `/admin` | Dashboard | Admin |
| `/admin/users` | User management | Admin |
| `/admin/leads` | All leads | Admin |
| `/admin/reports` | CSR performance reports | Admin |
| `/admin/active-projects` | Project DB | Admin |
| `/admin/uploads` | Excel uploads | Admin |
| `/admin/bin` | Bin (all CSRs) | Admin |
| `/admin/settings` | Admin profile / 2FA | Admin |
| `/csr` | Call Data (main dashboard) | CSR |
| `/csr/potential-clients` | Important / scheduled / interested | CSR |
| `/csr/not-interested` | NI, NP, No Owner, Not In Svc, In House | CSR |
| `/csr/clients` | Client directory | CSR |
| `/csr/active-projects` | CSR projects | CSR |
| `/csr/bin` | CSR bin | CSR |
| `/csr/chat` | Full-page chat | CSR |

### Route Protection: `frontend/proxy.ts`

- Validates JWT `exp` + `sid` from httpOnly cookie
- Redirects unauthenticated users from `/admin`/`/csr` → `/`
- Redirects logged-in users from `/` → role dashboard
- Cross-role redirect (admin ↔ csr)
- Invalid/expired token → clear cookie, redirect home

### API Client: `lib/api.ts`

- Axios with `withCredentials: true`, 30s timeout
- Browser (localhost): base URL `/api/backend` (Next.js proxy)
- Production: `NEXT_PUBLIC_API_URL` or `/api/backend`
- Dual auth: httpOnly `token` cookie + `sessionStorage` mirror (`crm_api_token`) for Bearer header
- **401 on `/admin` or `/csr`:** clear session → redirect to login

### Session: `lib/session.ts`

- `setFrontendSession(token)` → POST `/api/auth/set-session` + sessionStorage mirror
- `clearFrontendSession()` / `logoutSession()`
- `dashboardPathForRole()` → `/admin` or `/csr`

### Caching (`lib/`)

| Module | Endpoint | TTL |
|--------|----------|-----|
| `authMeCache.ts` | `/auth/me` | 60s |
| `adminSummaryCache.ts` | `/admin/clients/summary` | 90s |
| `csrDashboardCache.ts` | `/csr/dashboard` | 28s |
| `csrApiCache.ts` | leads, bin, projects, NI | 28s each |

### Key Frontend Patterns

- Almost all pages are **`"use client"`** (no React Query/Redux)
- **CSR table system:** `csrTableStyles.tsx` — fixed columns, shared thead classes
- **Column filters:** `components/table/columnFilters.tsx` — `useColumnFilters`, `FilterableTh`
- **Project workbench:** `ProjectWorkbenchModal.tsx` — shared admin/CSR project editor
- **Theme:** `next-themes` + CSS variables in `globals.css` (dark mode bridge for legacy classes)
- **Chat polling:** Only while chat panel/page is open (`ensureChatUnreadPolling` / `stopChatUnreadPolling`)

### Lead Statuses (CSR constants: `csr/constants/leadStatuses.ts`)

| Status string | Display | Notes |
|---------------|---------|-------|
| `pending` | Pending | Default, today's calls |
| `not picked` / `not completed` | Not Picked | Limit: 7 tries |
| `Not Interested` / `completed` | Not Interested | Limit: 3 tries |
| `no owner available` | No Owner Available | Follow-up tab |
| `not in service` | Not In Service | Follow-up tab |
| `in house` | In House | Follow-up tab |
| `important` | Important | + schedule fields |
| `interested` | Interested | + `interestedService` |
| `Close Client` | Close Client | Becomes active project |

---

## 9. Authentication & Sessions

### Login Flow

1. `POST /api/auth/login` with email, password, optional Turnstile token, remember-me
2. Login lockout check → CAPTCHA if needed → bcrypt verify
3. Optional HIBP password breach check
4. If 2FA enabled → OTP emailed → `POST /api/auth/verify-otp`
5. JWT issued with: `id`, `role`, `tv` (tokenVersion), `sid` (activeSessionId)
6. Frontend: `setFrontendSession(token)` → httpOnly cookie (7 days) + sessionStorage
7. Hard redirect to `/admin` or `/csr`

### Session Binding

- **One active session per user** (`activeSessionId` in DB must match JWT `sid`)
- `tokenVersion` incremented on password change / logout-all → invalidates old tokens
- `verifyToken` middleware rejects missing `sid`, version mismatch, deactivated account

### JWT Cookie

Set via `app/api/auth/set-session/route.ts`:
- `httpOnly: true`, `sameSite: lax`, `secure` in production, `path: /`, `maxAge: 7 days`

---

## 10. Security

### Backend

| Control | Implementation |
|---------|----------------|
| Password hashing | bcryptjs (10 rounds) |
| JWT secret | Min 32 chars required in production |
| Rate limiting | Login: 15/15min; API: 300/min |
| Login lockout | Prisma-backed after failed attempts |
| CAPTCHA | Cloudflare Turnstile after lockout threshold |
| Password breach | Have I Been Pwned (k-anonymity API) |
| Admin IP allowlist | `ADMIN_ALLOWED_IPS` env (comma-separated) |
| Helmet | CSP, HSTS in production |
| CORS | Strict origin allowlist |
| Audit logs | `SecurityAuditLog` for auth events |
| Access history | Per-login IP, user-agent, device |
| CSR auto-deactivate | 90 days without `lastActive` |
| File upload limits | Images 5MB, Excel 15MB, PDF 10MB, reports vary |
| Body size | 1 MB JSON limit |

### Frontend

| Control | Implementation |
|---------|----------------|
| Route guard | `proxy.ts` — role + expiry check |
| DevTools guard | `DevToolsGuard.tsx` — blocks shortcuts (strict on login) |
| Session invalidation | Axios 401 interceptor → logout redirect |
| CNIC masking | Backend masks CNIC in responses |

---

## 11. Lead Workflow & Business Logic

### CSR Main Dashboard (`/csr`)

- Shows leads where `hiddenOnMain = false`
- Tabs: Today, Pending, Not Picked, Not Interested, No Owner, Not In Svc, In House, Important, Schedule, Interested, Close Client
- Status update via dropdown → modals for Important, Interested, Close Client, etc.
- Filters: state, timezone, phone code, upload source (sudo name)

### Not Interested / Not Picked Limits

When CSR sets status to **Not Interested**:
- `notInterestedCount++`
- Append line to `followUpNotes`
- If count ≥ **3** → `inBin: true`, `binReason: limit-not-interested` → needs manual CSR reassignment

When CSR sets **not picked**:
- `notPickedCount++`
- If count ≥ **7** → bin with `limit-not-picked`

### Bin System (`utils/binLeads.ts`)

A lead is in bin if:
- `inBin === true`, OR
- Not Picked count ≥ 7, OR
- Not Interested count ≥ 3

Admin bin uses `buildBinWhere()` for efficient DB query (not full table scan).

### Close Client → Project

- Status `Close Client` triggers auto `clientCode` (`{csrCode}-01`, etc.)
- `isOldClient` auto-detected from prior won leads with same company
- Appears in Active Projects with phases, deadlines, payments

### Lead Shuffle (Cron)

- Runs every **2 days** at midnight
- Reassigns `not completed` leads to **other** CSRs (round-robin)
- Max **3 shuffle attempts** → lead deleted
- Report saved to Cloudinary

---

## 12. Uploads & Data Import

### Admin Upload Flow (`/admin/uploads`)

1. Select file → modal wizard:
   - **Category** (call-data, important, interested, active-projects, etc.)
   - **Reset mode** (keep / reset call data — snapshots before delete)
   - **Company** name
   - **Source** (optional — admin name + sudo name for CSR; can **Skip**)
   - **CSR selection** + preview
2. `POST /api/uploads` with FormData
3. Excel parsed → duplicates detected by phone/email
4. Leads distributed round-robin to selected CSRs
5. File archived to Cloudinary

### Upload Source

- `UploadSource.name` — admin-only label
- `UploadSource.sudoName` — shown to CSRs as `sourceSudoName` on leads
- Optional on upload; can assign later from upload history

---

## 13. Chat System

### Architecture

- **Polling-based** (no WebSockets)
- Polling **only when chat is open** (ChatPanel mount or `/csr/chat` page)
- Global store: `lib/chatUnreadStore.ts` — deduped requests, 4s visible / 15s hidden interval

### Features

- Direct + group conversations
- Text, image, file, voice messages (Cloudinary)
- Reactions, replies, mentions, pin, archive
- Typing indicators (in-memory `typingMap` on backend)
- Read receipts via `lastReadAt` on `ConversationMember`
- Offline message queue (`chatOfflineQueue.ts`)
- Sound ping (`chatSound.ts`) + browser notifications

### Chat Panel

- Admin: `AdminChatPanel` (re-exports `ChatPanel`) from sidebar message icon
- CSR: `ChatPanel` from `TopNavbar` or full `/csr/chat` page

---

## 14. Background Jobs (Cron)

| Job | Schedule | File | Purpose |
|-----|----------|------|---------|
| Auto-offline | Every 5s | `server.ts` | `isOnline: false` if `lastActive` > 15s ago |
| Daily report | 3:30 AM daily | `server.ts` | Yesterday's leads → JSON on Cloudinary → `Report` |
| Lead shuffle | Midnight, every 2 days | `server.ts` | Reassign not-completed leads |
| CSR deactivation | Every 24h + on start | `server.ts` | Deactivate CSRs inactive 90+ days |

---

## 15. Caching

**Backend:** In-memory TTL cache (`utils/cache.ts`)

| Key pattern | Used for |
|-------------|----------|
| `admin:clients:summary` | Admin dashboard |
| `admin:clients:list:*` | Admin leads tabs |
| `admin:csrs` | CSR dropdown |
| `admin:bin` / `admin:bin:{csrId}` | Admin bin |
| `csr:dashboard:{id}` | CSR main page |
| `csr:leads:{id}` | Client directory |
| `csr:bin:{id}` | CSR bin |
| `csr:not-interested:{id}` | NI page |
| `csr:projects:{id}` | Projects |

Invalidated on lead mutations via `invalidateCsrLeadCaches`, `flushAdminClientsCache`, `invalidateAllLeadCaches`.

**Frontend:** Module-level caches in `lib/` (see §8).

---

## 16. External Services

| Service | Purpose | Config |
|---------|---------|--------|
| **MongoDB** | Primary database | `DATABASE_URL` |
| **Cloudinary** | Uploads, reports, profiles, CNIC, chat files | `CLOUDINARY_*` |
| **Gmail SMTP** | 2FA OTP, login alerts | `SMTP_USER`, `SMTP_PASS` |
| **Cloudflare Turnstile** | Login CAPTCHA | `TURNSTILE_SECRET_KEY` |
| **Have I Been Pwned** | Password breach check | (public API) |

---

## 17. Environment Variables

### Backend (`.env`)

| Variable | Required (prod) | Description |
|----------|-----------------|-------------|
| `PORT` | No | Default 5000 |
| `DATABASE_URL` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes (≥32 chars) | JWT signing secret |
| `FRONTEND_URL` | Yes | CORS + cookie origin |
| `NODE_ENV` | No | `production` enables strict checks |
| `SMTP_USER` / `SMTP_PASS` | Recommended | Email for 2FA |
| `ADMIN_ALLOWED_IPS` | Optional | Comma-separated admin IP allowlist |
| `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile |
| `SESSION_DEFAULT_HOURS` | Optional | Default 12 |
| `SESSION_REMEMBER_HOURS` | Optional | Default 168 (7 days) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary |

### Frontend

| Variable | Description |
|----------|-------------|
| `BACKEND_URL` | Server-side proxy target (default `http://127.0.0.1:5000`) |
| `NEXT_PUBLIC_API_URL` | Direct API URL in production (optional) |
| `NEXT_PUBLIC_BACKEND_URL` | Alternative backend root |

---

## 18. Local Development

```bash
# Terminal 1 — Backend
cd backend
npm install
# Create .env with DATABASE_URL, JWT_SECRET, etc.
npx prisma generate
npx prisma db push
npm run dev          # http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm install
# Set BACKEND_URL=http://127.0.0.1:5000 in .env.local
npm run dev          # http://localhost:3000
```

Login: `admin@gmail.com` / `123456` or `csr@gmail.com` / `123456`

---

## 19. Deployment Notes

- **Frontend:** Typically Vercel (`dashboard.bemsolutions.io`)
- **Backend:** Separate Node host (e.g. Render) on port 5000
- **Frontend env:** `BACKEND_URL` → backend origin; proxy forwards `/api/backend/*`
- **Backend env:** `FRONTEND_URL` must match deployed frontend for CORS/cookies
- **Build:** `backend`: `prisma generate && prisma db push && tsc && seed`
- **Build:** `frontend`: `next build && next start`

---

## Quick Reference — Important Files

| Concern | File |
|---------|------|
| DB schema | `backend/prisma/schema.prisma` |
| Server + cron | `backend/src/server.ts` |
| Express app | `backend/src/app.ts` |
| Auth middleware | `backend/src/middleware/auth.middleware.ts` |
| Bin logic | `backend/src/utils/binLeads.ts` |
| Upload parser | `backend/src/controllers/upload.controller.ts` |
| Login page | `frontend/app/page.tsx` |
| API client | `frontend/lib/api.ts` |
| Route guard | `frontend/proxy.ts` |
| Backend proxy | `frontend/app/api/backend/[...path]/route.ts` |
| CSR main page | `frontend/app/csr/page.tsx` |
| Admin uploads | `frontend/app/admin/uploads/page.tsx` |
| Chat panel | `frontend/app/components/chat/ChatPanel.tsx` |
| Lead statuses | `frontend/app/csr/constants/leadStatuses.ts` |

---

*End of documentation.*
