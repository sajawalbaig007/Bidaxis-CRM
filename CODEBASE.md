# BEM CRM — Complete Codebase Documentation

> **Project:** CRM Dashboard for BEM Solutions  
> **Repository:** `CRM/` (monorepo: `backend/` + `frontend/`)  
> **Last updated:** July 2026

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
15. [Caching & Performance](#15-caching--performance)
16. [External Services](#16-external-services)
17. [Environment Variables](#17-environment-variables)
18. [Local Development](#18-local-development)
19. [Deployment Notes](#19-deployment-notes)
20. [Quick Reference](#20-quick-reference)

---
//
## 1. Overview

This is a **full-stack Customer Relationship Management (CRM)** system built for **BEM Solutions**. It powers daily sales/CSR operations:

- **Lead assignment** to CSRs with status workflows (pending, not picked, not interested, important, interested, etc.)
- **Potential clients** pipeline (important / scheduled / interested)
- **Client directory** (new vs returning / old clients)
- **Active projects** (won deals with phases, deadlines, payments)
- **Admin bulk Excel uploads** with CSR round-robin distribution
- **Internal real-time chat** (WebSocket + REST fallback)
- **Reports**, audit logs, access history, and layered security controls

### User Roles

| Role | Route prefix | Purpose |
|------|--------------|---------|
| `admin` | `/admin/*` | Full control: users, settings, stealth CSR chat, shuffle, CSR purge, access history |
| `manager` | `/manager/*` | Leads, reports, projects, uploads, bin — **reuses admin pages** (no Users / Settings) |
| `csr` | `/csr/*` | Own assigned leads, status updates, clients, projects, bin, chat |

Login requires selecting the correct **portal** (Admin / Manager / CSR). Backend enforces `loginRole` must match account role.

### Seed Accounts (`backend/prisma/seed.ts`)

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| `admin@gmail.com` | `123456` | admin | |
| `manager@gmail.com` | `123456` | manager | |
| `csr@gmail.com` | `123456` | csr | `csrCode`: CSR001 |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Browser (Next.js 16 App Router)                   │
│  /  → portal picker   |   /login/{admin|manager|csr}               │
│  /admin/*  |  /manager/*  |  /csr/*  |  proxy.ts (route guard)      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │  POST /api/auth/set-session        │  httpOnly JWT cookie
              │  /api/backend/[...path]            │  reverse proxy → Express
              └─────────────────┬─────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│              Express 5 API (port 5000) + WebSocket /ws/chat           │
│  /api/auth | /api/admin | /api/csr | /api/users | /api/uploads      │
│  /api/reports | /api/report-uploads | /api/chat                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
    MongoDB               Cloudinary              Gmail SMTP
   (Prisma ORM)         (files, reports)       (2FA OTP, alerts)
         │
    Cloudflare Turnstile (login CAPTCHA)
    Have I Been Pwned (password breach check)
```

### Request Flow (Development)

1. Browser calls `/api/backend/csr/stats` (same-origin Next.js proxy)
2. `frontend/app/api/backend/[...path]/route.ts` forwards to `http://127.0.0.1:5000/api/csr/stats`
3. Cookie `token` + optional `Authorization: Bearer` + `X-Client-Mac` header sent to backend
4. `verifyToken` validates JWT, session binding, active account, network access policy
5. `allowRoles("csr")` checks role
6. Handler returns JSON (often from in-memory cache)

### Production Topology

- **Frontend:** Vercel (`dashboard.bemsolutions.io`)
- **Backend:** Render / Node host (`node dist/server.js`)
- **Database:** MongoDB Atlas (or compatible)

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
| Realtime | `ws` WebSocket (`/ws/chat`) |
| Files | multer (memory), xlsx (Excel), Cloudinary |
| Email | Nodemailer (Gmail SMTP) |
| Dev | ts-node-dev |
| Prod start | `node dist/server.js` (compiled `dist/` is committed) |

### Frontend (`frontend/`)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.2 (App Router), React 19 |
| Styling | Tailwind CSS v4, CSS variables (light/dark) |
| HTTP | Axios (`lib/api.ts`) |
| Realtime | WebSocket client (`lib/chatSocket.ts`) |
| Charts | Recharts (lazy-loaded on Reports) |
| Themes | next-themes |
| Icons | lucide-react, react-icons |
| PDF | jspdf + jspdf-autotable |
| Toasts | react-hot-toast |

---

## 4. Repository Structure

```
CRM/
├── CODEBASE.md
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── dist/                    # Compiled JS (used by npm start)
│   └── src/
│       ├── server.ts            # HTTP + WS + cron jobs
│       ├── app.ts               # Express middleware + route mount
│       ├── chat/
│       │   ├── chatSocket.ts    # WebSocket server
│       │   └── chatMessageFormat.ts
│       ├── config/              # db, env, cloudinary, security
│       ├── controllers/         # auth, user, upload, report (5 files)
│       ├── middleware/          # auth, role, rateLimit, upload, adminIp
│       ├── routes/              # 8 route modules (heavy inline logic)
│       └── utils/               # ~30 domain helpers
└── frontend/
    ├── proxy.ts                 # Route guard logic (+ config.matcher)
    ├── app/
    │   ├── page.tsx             # Portal picker (Admin / Manager / CSR)
    │   ├── login/[portal]/      # Per-portal login
    │   ├── layout.tsx           # Root: fonts, theme, toast
    │   ├── api/
    │   │   ├── auth/            # set-session, clear-session
    │   │   └── backend/         # Reverse proxy to Express
    │   ├── admin/               # Admin pages + components
    │   ├── manager/             # Re-exports admin pages + own sidebar
    │   ├── csr/                 # CSR pages, hooks, constants, components
    │   └── components/          # Shared: chat, auth, projects, staff, tables
    └── lib/                     # api, session, caches, chat, device identity
```

> **Note:** `proxy.ts` exports `proxy()` and `config.matcher`. Ensure a root `middleware.ts` re-exports it if your Next.js version requires that wiring for route protection to run.

---

## 5. Database (MongoDB + Prisma)

**Provider:** MongoDB (`DATABASE_URL`)  
**IDs:** `cuid()` mapped to `_id` via `@map("_id")`  
**Lead statuses:** plain strings (not Prisma enums) for workflow flexibility

### Models

#### `User`

| Field | Notes |
|-------|-------|
| `role` | `admin` \| `csr` \| `manager` |
| `csrCode` | e.g. CSR001 — used in `clientCode` generation |
| `cnic`, `cnicPdfUrl` | Identity docs (Cloudinary) |
| `profilePic` | Cloudinary URL |
| `isActive` | `false` after 90-day CSR inactivity (cron) |
| `isOnline`, `lastActive` | Presence via heartbeat |
| `twoFAEnabled` | Email OTP on login |
| `tokenVersion` | Incremented on password change / logout-all |
| `activeSessionId` | Single active session binding (`sid` in JWT) |
| `allowedIps[]` | Max 5 in-house approved IPs |
| `allowedMacAddress` | In-house device ID (via `X-Client-Mac` header) |
| `temporaryAccessIp/Mac/Until` | Temporary outside access (9–10 hours, auto-expires) |

**Indexes:** `role`, `isActive`, `lastActive`, `[role,isActive]`, `temporaryAccessUntil`

#### `Lead` (central entity)

| Field | Notes |
|-------|-------|
| `status` | Default `"pending"` — see [Lead Statuses](#lead-statuses) |
| `assignedTo` | FK → User (CSR) |
| `important`, `interested` | Boolean flags synced with status |
| `nextSchedule`, `nextTime`, `timezone` | Scheduled important calls |
| `followUpNotes` | Multi-line try history (NI / NP) |
| `interestedService` | Service when interested |
| `projectTitle`, `projectCode`, `projectDeadline`, etc. | Active project fields |
| `projectPhase` | `not_started`, takeoff/pricing/QA phases |
| `projectPayments` | JSON string of payment entries |
| `clientCode` | Auto on Close Client: `{csrCode}-01`, etc. |
| `isOldClient` | Auto if company had prior won project |
| `notInterestedCount`, `notPickedCount` | Retry counters (limits: 3 / 7) |
| `inBin`, `binReason`, `binPreviousStatus` | Bin / soft-delete |
| `hiddenOnMain` | Hides from CSR main pipeline |
| `uploadedFileId` | FK → UploadFile |
| `shuffleAttempts` | Lead shuffle cron counter |

**Indexes:** `assignedTo`, `status`, `phone`, `email`, `company`, `createdAt`, `updatedAt`, `important`, `interested`, `inBin`, `nextSchedule`, `hiddenOnMain`, and multiple composites for tab/bin queries.

#### Other Models

| Model | Purpose |
|-------|---------|
| `LeadNote` | Timestamped notes per lead |
| `SubContact` | Extra contacts on a lead |
| `CallLog` | CSR status change history |
| `UploadSource` | Admin source label + `sudoName` (shown to CSRs) |
| `UploadFile` | Excel upload metadata + Cloudinary URL |
| `Report` | Generated or uploaded reports |
| `Conversation` | Chat thread (direct / group) |
| `ConversationMember` | Membership, `lastReadAt`, `archivedAt` |
| `Message` | Text/file/voice; reactions JSON; replies; mentions |
| `SecurityAuditLog` | Auth & security events |
| `AccessHistory` | Login/logout/heartbeat per user |
| `LoginLockout` | Failed login tracking |
| `LoginAttemptAlert` | Concurrent login attempt notifications |
| `RateLimitEntry` | Optional Prisma rate-limit store |

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

### Entry: `src/server.ts`

1. Loads `.env`, `validateEnv()`
2. Creates HTTP server, attaches Express app
3. Initializes WebSocket chat (`initChatSocket` on `/ws/chat`)
4. Runs background cron jobs (see [§14](#14-background-jobs-cron))

### App: `src/app.ts`

| Middleware | Purpose |
|------------|---------|
| `helmet` | CSP (prod), HSTS, security headers |
| `cors` | localhost, bemsolutions.io, Vercel, `FRONTEND_URL` |
| `express.json` | 1 MB limit |
| `cookieParser` | JWT cookie |
| `apiLimiter` | 300 req/min on `/api` (in-memory by default) |

### Route Mounting

| Prefix | File | Notes |
|--------|------|-------|
| `/api/auth` | `auth.routes.ts` | Login, 2FA, profile |
| `/api/admin` | `admin.routes.ts` | `enforceAdminIpAllowlist` on all routes |
| `/api/csr` | `csr.routes.ts` | ~1,200 lines — most CSR business logic |
| `/api/users` | `user.routes.ts` | User CRUD + network policy |
| `/api/uploads` | `upload.routes.ts` | Excel import |
| `/api/reports` | `report.routes.ts` | Performance reports |
| `/api/report-uploads` | `reportUpload.routes.ts` | Manual report files |
| `/api/chat` | `chat.routes.ts` | Chat REST + admin stealth view |

### Controllers (`src/controllers/`)

| File | Responsibility |
|------|----------------|
| `auth.controller.ts` | Login, 2FA, register, profile, password, audit logs, network policy on login |
| `user.controller.ts` | User CRUD, network policy fields, admin password reset |
| `upload.controller.ts` | Excel parse, chunked insert (1000), batched updates (30), CSR distribution |
| `report.controller.ts` | Period reports + internal 90s/300s cache |
| `reportUpload.controller.ts` | Report file upload/delete |

> Most admin/CSR lead logic lives **inline in route files**, not controllers.

### Middleware (`src/middleware/`)

| File | Purpose |
|------|---------|
| `auth.middleware.ts` | JWT verify, session binding, network access, `lastActive` touch |
| `role.middleware.ts` | `allowRoles(...)` |
| `rateLimit.middleware.ts` | Login 15/15min; API 300/min; Prisma store only if `RATE_LIMIT_STORE=prisma` |
| `adminIp.middleware.ts` | `ADMIN_ALLOWED_IPS` gate on `/api/admin/*` |
| `upload.middleware.ts` | Multer: images 5MB, Excel 15MB, PDF 10MB |

### Key Utils (`src/utils/`)

| File | Purpose |
|------|---------|
| `cache.ts` | In-memory TTL cache, pattern invalidation, throttled heal lock |
| `binLeads.ts` | Bin rules (NI=3, NP=7), `buildBinWhere`, pipeline where-clauses |
| `csrDashboardQueries.ts` | CSR tab stats, paginated tab leads, potential leads |
| `csrLeadSelect.ts` | Lean Prisma `select` shapes (max 5 notes on client list) |
| `adminClientQueries.ts` | Admin list filters (important/schedule/interested/closed) |
| `adminSummaryStats.ts` | Admin dashboard tab counts + chart series |
| `potentialClientBuckets.ts` | Important / interested / scheduled bucket rules |
| `leadClientPromotion.ts` | Won-client promotion, pending dedupe, `healPipelineLeaksForCsr` |
| `leadPhoneLookup.ts` | Returning client phone search |
| `leadDuplicateCheck.ts` | Phone/email duplicate detection |
| `projectLeads.ts` | Active/won project filters |
| `projectPayments.ts` | Payment JSON parse/totals |
| `networkAccess.ts` | Per-user IP/MAC allowlist + temporary access |
| `uploadExcelParse.ts` | xlsx row parsing + classification |
| `uploadCategory.ts` | Upload category enum |
| `deleteLeadsCascade.ts` | Cascade delete + cache invalidation |
| `purgeCsrLeads.ts` | Bulk purge CSR leads |
| `sessions.ts` | OTP store, `activeSessionId`, login alerts, browser tab map |
| `loginLockout.ts` | 8 fails → 30min block; CAPTCHA after 3 |
| `auditLog.ts` | Security audit writes |
| `accessHistory.ts` | Login/logout/heartbeat history (throttled) |
| `rateLimitStore.ts` | Prisma-backed express-rate-limit store |

---

## 7. API Reference

All endpoints prefixed with `/api`. Auth: `verifyToken` unless noted.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/captcha-config` | Public | Turnstile site key |
| POST | `/login` | Public | Login (+ portal role, network policy, CAPTCHA) |
| POST | `/verify-otp` | Public | 2FA OTP |
| POST | `/resend-otp` | Public | Resend OTP |
| POST | `/register` | Admin | Create user |
| POST | `/logout` | Auth | Logout |
| GET | `/me` | Auth | Current user |
| GET | `/session-status` | Auth | Login-attempt alert status |
| POST | `/session-alert/ack` | Auth | Dismiss alert |
| POST | `/logout-all` | Admin/Manager | Invalidate all sessions |
| GET | `/audit-logs` | Admin | Security audit log |
| PUT | `/profile` | Auth | Update profile |
| PUT | `/change-password` | Auth | Change password |
| PUT | `/toggle-2fa` | Auth | Enable/disable 2FA |

### Admin — `/api/admin`

Protected by `verifyToken` + role + `enforceAdminIpAllowlist`.  
Many routes allow **`admin` and `manager`**; admin-only routes noted.

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/dashboard` | admin | Legacy stub |
| GET | `/notifications` | admin, manager | Scheduled important calls |
| GET | `/csrs` | admin, manager | Active CSR list |
| GET | `/clients/tab-counts` | admin, manager | Tab badge counts |
| GET | `/clients/summary` | admin, manager | Dashboard stats + charts |
| GET | `/clients` | admin, manager | Paginated leads (`view`, filters) |
| GET/PUT/DELETE | `/lead/:id` | admin, manager | Lead CRUD |
| PUT | `/lead/:id/reassign` | admin, manager | Reassign to CSR |
| POST/PUT/DELETE | `/lead/:id/notes[/:noteId]` | admin, manager | Notes CRUD |
| POST/PUT/DELETE | `/lead/:id/subcontacts[/:subId]` | admin, manager | Sub-contacts |
| GET | `/projects` | admin, manager | Paginated active projects |
| POST/PUT | `/project`, `/project/:id` | admin, manager | Project CRUD |
| GET | `/lookup-by-phone` | admin, manager | Phone lookup |
| GET | `/bin` | admin, manager | Bin leads (`buildBinWhere`) |
| PUT | `/csr-status/:id` | admin | Activate/deactivate CSR |
| GET | `/csr-history/:csrId` | admin | CSR history |
| DELETE | `/csr-leads/:csrId` | admin | Purge all CSR leads |
| GET | `/shuffle-status` | admin | Shuffle preview |
| POST | `/run-shuffle` | admin | Manual shuffle |
| GET/POST/PATCH/DELETE | `/upload-sources[/:id]` | admin, manager | Upload sources |
| GET | `/access-history/:userId` | admin | User access history |
| POST | `/migrate-legacy-notes` | admin | One-time migration |

### CSR — `/api/csr`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Tab counts (cached; throttled pipeline heal) |
| GET | `/tab-leads` | Paginated leads by tab (`today`, `pending`, `important`, etc.) |
| GET | `/potential-leads` | Important / schedule / interested bucket |
| GET | `/dashboard` | Legacy full dashboard payload (cached) |
| GET | `/clients` | Won clients (new vs old; cache-first, lean notes) |
| GET | `/leads` | Client directory leads |
| GET | `/not-interested` | NI / NP retry leads |
| GET | `/bin` | Bin leads (`buildBinWhere` DB query) |
| GET | `/projects` | Active projects |
| GET | `/notifications` | Scheduled calls + 24h stats |
| GET | `/activity-report` | Activity by date range |
| GET/POST/PUT | `/lead`, `/lead/:id` | Lead CRUD + status workflow |
| PUT | `/lead/:id/assign` | CSR-to-CSR assign |
| GET | `/lookup-by-phone` | Returning client lookup |
| GET | `/csrs` | Peer CSR list |
| POST | `/project` | Create project lead |
| POST | `/heartbeat` | Presence (DB write throttled to 30s) |
| POST | `/offline` | Mark offline (beacon) |
| POST/PUT/DELETE | `/lead/:id/notes`, `/subcontacts` | Notes & sub-contacts |

### Uploads — `/api/uploads`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/` | admin, manager | Excel upload → distribute |
| POST | `/preview` | admin, manager | Dry-run preview |
| GET | `/latest`, `/history` | admin, manager | Upload metadata |
| PATCH | `/:id/source` | admin, manager | Change source |
| DELETE | `/:id` | admin, manager | Delete upload + cascade |

### Reports

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/reports/` | admin, manager | CSR performance report |
| POST | `/report-uploads/` | admin | Upload report file |
| DELETE | `/report-uploads/:id` | admin | Delete report |

### Chat — `/api/chat`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | List (`?archived=1`) |
| POST | `/conversations` | Create direct/group |
| DELETE | `/conversations/:id` | Delete/leave |
| GET/POST | `/conversations/:id/messages` | Fetch/send (files up to 200 MB) |
| PATCH/DELETE | `/messages/:id` | Edit (10 min) / delete |
| POST | `/messages/:id/reactions` | Toggle reaction |
| POST | `/conversations/:id/read` | Mark read |
| POST/GET | `/conversations/:id/typing` | Typing (in-memory + WS) |
| POST | `/conversations/:id/pin` | Pin message |
| POST | `/conversations/:id/archive` \| `/unarchive` | Per-user archive |
| POST | `/status` | Online/offline heartbeat |
| GET | `/users` | Chat directory |
| GET | `/conversations/:id/members` | Group members |
| GET | `/admin/view/:csrId/conversations` | Admin stealth CSR chat list |
| GET | `/admin/view/:csrId/.../messages` | Admin read CSR messages |

### Users — `/api/users`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/` | admin, csr, manager | User list (CNIC masked for non-admin) |
| POST | `/upload-pic` | Auth | Profile picture |
| POST | `/upload-cnic` | admin | CNIC PDF |
| PUT | `/:id` | admin | Update user + network policy |
| PUT | `/:id/password` | admin | Reset password |
| DELETE | `/:id` | admin | Delete user + chat cascade |

---

## 8. Frontend

### Routes

| Path | Page | Role |
|------|------|------|
| `/` | Portal picker | Public |
| `/login/admin` \| `/login/manager` \| `/login/csr` | Login + 2FA | Public |
| `/admin` | Dashboard | Admin |
| `/admin/users` | User management + IP/MAC policy | Admin only |
| `/admin/leads` | All leads | Admin |
| `/admin/reports` | CSR performance | Admin |
| `/admin/active-projects` | Project DB | Admin |
| `/admin/uploads` | Excel uploads | Admin |
| `/admin/bin` | Bin (all CSRs) | Admin |
| `/admin/settings` | Profile, 2FA, audit logs | Admin only |
| `/manager` | Dashboard (re-export) | Manager |
| `/manager/leads` … `/manager/bin` | Same admin pages | Manager |
| `/csr` | Call Data main dashboard | CSR |
| `/csr/potential-clients` | Important / schedule / interested | CSR |
| `/csr/not-interested` | NI, NP, misc statuses | CSR |
| `/csr/clients` | Client directory | CSR |
| `/csr/active-projects` | CSR projects | CSR |
| `/csr/bin` | CSR bin | CSR |
| `/csr/chat` | Full-page chat | CSR |
| `/csr/settings` | CSR 2FA settings | CSR |

### Layouts

| Layout | Initializes |
|--------|-------------|
| `app/layout.tsx` | Fonts, `ThemeProvider`, toast |
| `app/admin/layout.tsx` | `StaffPresenceInit`, `StaffChatNotifier`, `ChatLayoutCleanup` |
| `app/manager/layout.tsx` | Same as admin |
| `app/csr/layout.tsx` | Above + `DevToolsGuard`, `CsrPresenceInit` |

### Route Protection: `frontend/proxy.ts`

- Parses JWT from httpOnly `token` cookie (`role`, `exp`, `sid`)
- Protects `/admin`, `/manager`, `/csr`
- Redirects unauthenticated → `/`
- Redirects authenticated at `/` or `/login/*` → role home
- Cross-role redirects to correct portal

### API Client: `lib/api.ts`

- Axios, `withCredentials: true`, 30s timeout
- Dev: base URL `/api/backend` (Next.js proxy)
- Prod: `NEXT_PUBLIC_API_URL` or `/api/backend`
- Sends `Authorization: Bearer` from `sessionStorage` + `X-Client-Mac` from `deviceIdentity.ts`
- **401** on `/admin` or `/csr` → clear session → redirect `/`

### Session: `lib/session.ts`

1. Login → backend JWT
2. `setFrontendSession(token)` → httpOnly cookie + `sessionStorage` mirror
3. `dashboardPathForRole()` → `/admin`, `/manager`, or `/csr`

### CSR Data Architecture

Main dashboard (`/csr`) uses **`useCsrTabPage`** hooks:

| Hook / API | Source |
|------------|--------|
| `useCsrStats` | `GET /csr/stats` via `csrTabApiCache` |
| `useCsrTabLeads` | `GET /csr/tab-leads` (paginated per tab) |
| `usePotentialLeads` | `GET /csr/potential-leads` |

Other CSR pages use dedicated hooks + `csrApiCache`:

- `useLeadsData` → `/csr/clients`
- `useProjectsData` → `/csr/projects`
- `useBinData` → `/csr/bin`
- `useNotInterested` → `/csr/not-interested`

Legacy `useCsrDashboard` (`/csr/dashboard`) exists but main page no longer uses it.

### Admin / Manager Shared Pages

Manager routes **re-export** admin page components. `useStaffBase()` / `useStaffSidebar()` switch paths between `/admin` and `/manager`. Manager sidebar omits Users and Settings.

### Key UI Patterns

- **CSR tables:** `csrTableStyles.tsx` — shared column layout
- **Column filters:** `components/table/columnFilters.tsx`
- **Project editor:** `ProjectWorkbenchModal.tsx` — admin + CSR
- **Client history:** `ClientHistoryModal.tsx` — old client services & revenue
- **Theme:** `next-themes` + `globals.css` CSS variables
- **Staff shell:** `StaffPageShell.tsx`, `StaffMobileNav.tsx`

### Lead Statuses (`csr/constants/leadStatuses.ts`)

| Status | Display | Notes |
|--------|---------|-------|
| `pending` | Pending | Default |
| `not picked` / `not completed` | Not Picked | Limit: 7 |
| `Not Interested` / `completed` | Not Interested | Limit: 3 |
| `no owner available` | No Owner | Misc tab |
| `not in service` | Not In Service | Misc tab |
| `in house` | In House | Misc tab |
| `important` | Important | + schedule fields |
| `interested` | Interested | + `interestedService` |
| `Close Client` | Close Client | Becomes active project |

---

## 9. Authentication & Sessions

### Login Flow

1. User picks portal → `/login/{admin|manager|csr}`
2. `POST /api/auth/login` with email, password, `loginRole`, optional Turnstile
3. Lockout check → CAPTCHA if needed → bcrypt verify
4. **Network access policy** evaluated (IP + `X-Client-Mac`)
5. Optional HIBP breach check
6. If 2FA → OTP email → `POST /api/auth/verify-otp`
7. JWT: `{ id, role, tv, sid }`
8. `setFrontendSession(token)` → httpOnly cookie (7 days) + sessionStorage
9. `POST /chat/status { online: true }` → redirect to dashboard

### Session Binding

- **One active session** per user (`activeSessionId` must match JWT `sid`)
- `tokenVersion` incremented on password change / logout-all
- `verifyToken` rejects: missing `sid`, version mismatch, deactivated account, failed network policy

### Per-User Network Access (`utils/networkAccess.ts`)

- **In-house:** up to 5 `allowedIps` + one `allowedMacAddress`
- **Temporary outside:** `temporaryAccessIp/Mac` with `temporaryAccessUntil` (9 or 10 hours)
- Frontend sends persistent device ID as `X-Client-Mac` (`lib/deviceIdentity.ts`)
- Enforced on login, OTP verify, and every authenticated request

---

## 10. Security

### Backend

| Control | Implementation |
|---------|----------------|
| Password hashing | bcryptjs (10 rounds) |
| JWT secret | Min 32 chars in production |
| Rate limiting | Login 15/15min; API 300/min (in-memory default) |
| Login lockout | Prisma `LoginLockout` — 8 fails / 30min |
| CAPTCHA | Cloudflare Turnstile after 3 fails |
| Password breach | Have I Been Pwned k-anonymity |
| Admin IP allowlist | `ADMIN_ALLOWED_IPS` on login + `/api/admin/*` |
| Per-user network policy | IP/MAC allowlist + temporary access |
| Portal role gate | Login role must match account role |
| Helmet + CORS | CSP (prod), HSTS, origin allowlist |
| Audit logs | `SecurityAuditLog` |
| Access history | IP, user-agent, device per login/heartbeat |
| CSR auto-deactivate | 90 days without `lastActive` |
| File upload limits | Images 5MB, Excel 15MB, PDF 10MB |
| CNIC masking | Non-admins see masked CNIC |

### Frontend

| Control | Implementation |
|---------|----------------|
| Route guard | `proxy.ts` |
| DevTools guard | `DevToolsGuard.tsx` on CSR layout |
| Session invalidation | Axios 401 interceptor |
| Device identity | `localStorage` device ID for MAC header |

---

## 11. Lead Workflow & Business Logic

### CSR Main Dashboard (`/csr`)

- Uses `/csr/stats` + `/csr/tab-leads` (paginated, DB-level filters)
- Tabs: Today, Pending, Important, Schedule, Interested, Project Won, etc.
- Client-side filters: state, timezone, phone code, upload source
- Status changes open modals (Important, Interested, Project Won, etc.)

### Potential Clients (`/csr/potential-clients`)

- `fetchPotentialLeads`: broad DB query (important OR interested), then in-memory bucket filter via `potentialClientBuckets.ts`
- Buckets: important-only, scheduled call, interested

### Not Interested / Not Picked Limits

- **Not Interested:** `notInterestedCount++` → at **3** → `inBin: true`, `binReason: limit-not-interested`
- **Not picked:** `notPickedCount++` → at **7** → bin with `limit-not-picked`
- Bin leads need manual CSR reassignment

### Bin System (`utils/binLeads.ts`)

Lead is in bin if `inBin === true` OR NP count ≥ 7 OR NI count ≥ 3.  
`buildBinWhere(csrId)` powers efficient DB queries (no full-table scan).

### Close Client → Project

- Status `Close Client` → auto `clientCode` (`{csrCode}-01`, …)
- `isOldClient` from prior won leads with same company
- Appears in Active Projects with phases, deadlines, payments

### Pipeline Heal

`healPipelineLeaksForCsr` dedupes won/pending conflicts — throttled to once per CSR per 2 minutes via `shouldSkipThrottledHeal`.

### Lead Shuffle (Cron)

- Midnight, then every **2 days**
- Reassigns `not completed` leads to other CSRs (round-robin)
- Max **3 shuffle attempts** → lead deleted; report saved to Cloudinary

---

## 12. Uploads & Data Import

### Admin Upload Flow (`/admin/uploads`)

1. Wizard: category, reset mode, company, source (optional), CSR selection, preview
2. `POST /api/uploads` — Excel parsed, duplicates by phone/email
3. Leads distributed round-robin to selected CSRs
4. File archived to Cloudinary

### Upload Categories

`call-data`, `new-client`, `old-client`, `interested`, `important`, `active-projects`

### Upload Source

- `name` — admin-only label
- `sudoName` — shown to CSRs as lead source

---

## 13. Chat System

### Architecture (WebSocket-first)

```
StaffPresenceInit → connectWebSocket() + startChatStatusHeartbeat()
StaffChatNotifier → initChatRealtime() → chatUnreadStore
ChatPanel / TopNavbar / AdminChatPanel → UI
```

- **WebSocket:** `ws://host/ws/chat` (JWT `token` query param)
- **REST fallback:** polling when WS disconnected
- **Global unread:** `chatUnreadStore.ts` — WS `conversation:update` + 60s HTTP fallback

### WebSocket Events (`chat/chatSocket.ts`)

Client: `ping`, `presence`, `watch`, `typing`  
Server: `message:new`, `message:edit`, `message:delete`, `message:reaction`, `message:pinned`, `conversation:update`, `read`, `presence`, `typing`

### Features

- Direct + group conversations
- Text, image, file, voice (Cloudinary, up to 200 MB)
- Reactions, replies, mentions, pin, per-user archive
- Read receipts via `lastReadAt`
- Offline queue: `chatOfflineQueue.ts` (localStorage)
- Sound + browser notifications: `chatSound.ts`
- **Admin stealth mode:** `AdminChatPanel` → view CSR conversations read-only

### Entry Points

| Portal | Chat UI |
|--------|---------|
| Admin | `AdminChatPanel` in sidebar (stealth CSR view) |
| Manager | `ChatPanel` in sidebar |
| CSR | `ChatPanel` in `TopNavbar` or `/csr/chat` page |

---

## 14. Background Jobs (Cron)

| Job | Schedule | Purpose |
|-----|----------|---------|
| Auto-offline | Every **60s** | `isOnline: false` if `lastActive` > **90s** ago; circuit breaker on DB failures |
| Daily report | **3:30 AM** daily | Yesterday's leads → JSON → Cloudinary → `Report` |
| Lead shuffle | Midnight, every **2 days** | Reassign not-completed leads |
| CSR deactivation | Every **24h** + on startup | Deactivate CSRs inactive 90+ days |

Manual shuffle: `POST /api/admin/run-shuffle`

---

## 15. Caching & Performance

### Backend Cache (`utils/cache.ts`)

In-process `Map` with TTL (not Redis — per-process only).

| Key pattern | TTL | Used for |
|-------------|-----|----------|
| `admin:clients:summary` | 180s | Admin dashboard |
| `admin:clients:tab-counts` | 60s | Tab badges |
| `admin:clients:list:*` | 60s | Paginated leads |
| `admin:bin:*` | 30s | Admin bin |
| `admin:projects:*` | 45s | Projects |
| `csr:stats:*` | 30s | CSR tab counts |
| `csr:tab:*` | 20s | Paginated tab leads |
| `csr:clients:*` | 45s | Won clients |
| `csr:bin:*` | 30s | CSR bin |
| `csr:heal-lock:*` | 120s | Throttle pipeline heal |
| Report controller | 90s / 300s | Reports endpoint |

Invalidated on mutations via `invalidateCsrLeadCaches`, `flushAdminClientsCache`, etc.

### Backend Performance Patterns

1. **Lean Prisma selects** — `CSR_DASHBOARD_LEAD_SELECT`, max 5 notes on client list
2. **DB pagination** — `/csr/tab-leads`, admin `/clients` (not full in-memory slice)
3. **`buildBinWhere`** — bin queries at DB level
4. **Cache-first reads** — clients, bin, projects skip heal on GET
5. **Throttled heartbeat DB writes** — CSR heartbeat writes at most every 30s
6. **Throttled pipeline heal** — max once per CSR per 2 min
7. **Bulk upload batching** — 1000-row inserts, 30-row updates
8. **Optional Prisma rate-limit store** — only when `RATE_LIMIT_STORE=prisma`
9. **Compound indexes** on `Lead` for tab/bin/assigned queries
10. **WebSocket push** — chat without constant HTTP polling

### Frontend Cache (`lib/`)

| Module | TTL | Endpoints |
|--------|-----|-----------|
| `authMeCache` | 60s | `/auth/me` |
| `adminSummaryCache` | 60–120s | summary, tab-counts (+ sessionStorage) |
| `csrTabApiCache` | 45s | stats, tab-leads, potential-leads |
| `csrApiCache` | 28s | clients, leads, bin, projects, NI |
| `reportsCache` | 300s | `/reports` |
| `chatApiCache` | 12–120s | conversations, messages, members |

### Polling / Heartbeat Intervals

| Interval | Location | Purpose |
|----------|----------|---------|
| 30s | `useCsrPresence.ts` | CSR `/heartbeat` (pauses when tab hidden) |
| 30s | `chatStatusHeartbeat.ts` | `/chat/status` or WS presence |
| 60s | `chatUnreadStore.ts` | Conversation poll when WS down |
| 10s | `chatSocket.ts` | WebSocket ping |

`visibleInterval.ts` pauses timers when browser tab is hidden.

### Render / Budget Hosting Notes

- Run `npx tsc` after src changes — production uses committed `dist/`
- Do **not** set `RATE_LIMIT_STORE=prisma` unless you need multi-instance rate limiting (adds DB load)
- Keep heartbeat/cron intervals at current values (60s offline, 30s presence) on $25 plans

---

## 16. External Services

| Service | Purpose | Config |
|---------|---------|--------|
| MongoDB | Primary database | `DATABASE_URL` |
| Cloudinary | Uploads, reports, profiles, CNIC, chat files | `CLOUDINARY_*` |
| Gmail SMTP | 2FA OTP, login alerts | `SMTP_USER`, `SMTP_PASS` |
| Cloudflare Turnstile | Login CAPTCHA | `TURNSTILE_SECRET_KEY` |
| Have I Been Pwned | Password breach check | Public API |

---

## 17. Environment Variables

### Backend (`.env`)

| Variable | Required (prod) | Description |
|----------|-----------------|-------------|
| `PORT` | No | Default 5000 |
| `DATABASE_URL` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes (≥32 chars) | JWT signing |
| `FRONTEND_URL` | Yes | CORS + cookies |
| `NODE_ENV` | No | `production` enables strict checks |
| `SMTP_USER` / `SMTP_PASS` | Recommended | 2FA email |
| `ADMIN_ALLOWED_IPS` | Optional | Comma-separated admin IPs |
| `TURNSTILE_SECRET_KEY` | Optional | Turnstile |
| `RATE_LIMIT_STORE` | Optional | Set `prisma` for distributed rate limit (default: in-memory) |
| `SESSION_DEFAULT_HOURS` | Optional | Default 12 |
| `SESSION_REMEMBER_HOURS` | Optional | Default 168 (7 days) |
| `CLOUDINARY_*` | Yes | Cloudinary credentials |

### Frontend

| Variable | Description |
|----------|-------------|
| `BACKEND_URL` | Server-side proxy target (default `http://127.0.0.1:5000`) |
| `NEXT_PUBLIC_API_URL` | Direct API URL (optional) |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (optional; defaults derived from API) |
| `NEXT_DIST_DIR` | Optional custom Next.js dist dir |

---

## 18. Local Development

```bash
# Terminal 1 — Backend
cd backend
npm install
# Create .env: DATABASE_URL, JWT_SECRET, FRONTEND_URL, CLOUDINARY_*
npx prisma generate
npx prisma db push
npm run dev          # http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm install
# .env.local: BACKEND_URL=http://127.0.0.1:5000
npm run dev          # http://localhost:3000
```

**Login:** `admin@gmail.com` / `manager@gmail.com` / `csr@gmail.com` — password `123456`

**After backend src changes for production parity:**
```bash
cd backend && npx tsc
```

---

## 19. Deployment Notes

| Component | Typical host | Start command |
|-----------|--------------|---------------|
| Frontend | Vercel | `next build && next start` |
| Backend | Render ($25 plan) | `npm start` → `node dist/server.js` |

**Backend build** (`package.json`): `prisma generate && prisma db push && tsc && seed`

**Checklist:**
- `FRONTEND_URL` on backend must match deployed frontend origin
- `BACKEND_URL` on frontend must point to backend
- Rebuild `dist/` before pushing backend changes
- Run `npx prisma db push` when schema changes (network access fields, indexes)
- WebSocket must be reachable at `/ws/chat` on same host (or set `NEXT_PUBLIC_WS_URL`)

---

## 20. Quick Reference

| Concern | File |
|---------|------|
| DB schema | `backend/prisma/schema.prisma` |
| Server + cron | `backend/src/server.ts` |
| Express app | `backend/src/app.ts` |
| WebSocket chat | `backend/src/chat/chatSocket.ts` |
| Auth middleware | `backend/src/middleware/auth.middleware.ts` |
| Network access | `backend/src/utils/networkAccess.ts` |
| Bin logic | `backend/src/utils/binLeads.ts` |
| CSR tab queries | `backend/src/utils/csrDashboardQueries.ts` |
| Upload parser | `backend/src/controllers/upload.controller.ts` |
| Portal picker | `frontend/app/page.tsx` |
| Login form | `frontend/app/components/auth/LoginPortalForm.tsx` |
| API client | `frontend/lib/api.ts` |
| Device ID header | `frontend/lib/deviceIdentity.ts` |
| Route guard | `frontend/proxy.ts` |
| Backend proxy | `frontend/app/api/backend/[...path]/route.ts` |
| CSR main page | `frontend/app/csr/page.tsx` |
| CSR tab hooks | `frontend/app/csr/hooks/useCsrTabPage.ts` |
| Admin users + IP policy | `frontend/app/admin/users/page.tsx` |
| Admin uploads | `frontend/app/admin/uploads/page.tsx` |
| Chat panel | `frontend/app/components/chat/ChatPanel.tsx` |
| Manager sidebar | `frontend/app/manager/components/layout/Sidebar.tsx` |
| Lead statuses | `frontend/app/csr/constants/leadStatuses.ts` |

---

*End of documentation.*
