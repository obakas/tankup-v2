# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TankUp V2 is a water tanker delivery coordination platform. It connects customers requesting water delivery with drivers/tankers, coordinated by fleet heads, governed by admins. The `docs/` directory contains the full product spec — read it before making significant changes.

The repo has three independent workspaces:

```
backend/    FastAPI + SQLAlchemy + PostgreSQL (Supabase)
frontend/   React + Vite + TypeScript + Tailwind + shadcn/ui
mobile/     React Native Expo + NativeWind
```

---

## Commands

### Backend
```bash
cd backend

# Install dependencies
pip install -r app/requirements.txt

# Run dev server (from backend/ dir)
uvicorn app.main:app --reload

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
alembic downgrade -1

# Create an admin user
python -m app.scripts.create_admin_user
```

### Frontend
```bash
cd frontend

npm run dev        # dev server on :5173
npm run build      # production build
npm run lint       # ESLint
npm run test       # vitest (single run)
npm run test:watch # vitest watch mode
```

### Mobile
```bash
cd mobile

npx expo start           # Expo dev server (scan QR with Expo Go)
npx expo start --android # open Android emulator
npx expo start --ios     # open iOS simulator
npm run lint             # expo lint
```

---

## Backend Architecture

**Entry point:** `app/main.py` — mounts all routers, starts the APScheduler, configures CORS.

**Config:** `app/core/config.py` — reads from `backend/.env`. Key vars:
- `DATABASE_URL` — Supabase PostgreSQL in prod, SQLite for local fallback
- `ADMIN_SECRET` — header secret required alongside Bearer token on all `/admin/*` routes
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — credentials for `POST /admin/login`
- `SECRET_KEY` — JWT signing key

**Route structure** (all under `app/api/routes/`):

| Prefix | Purpose |
|--------|---------|
| `/requests` | Customer delivery request creation |
| `/batches` | Batch lifecycle |
| `/batch-members` | Individual members within a batch |
| `/tankers` | Tanker CRUD and driver job flow — **most endpoints are public (no auth)** |
| `/deliveries` | Delivery record transitions |
| `/payments`, `/refunds` | Payment lifecycle |
| `/auth`, `/users` | Customer auth (phone-based) |
| `/admin` | Admin read/write operations — requires Bearer JWT + `x-admin-secret` header |
| `/admin/login` | Admin + fleet head login, returns JWT |
| `/histories`, `/notifications`, `/healths` | Supporting endpoints |

**Auth model — two separate systems:**

1. **Customer users** — `POST /auth/login` with phone number, returns JWT stored client-side. Used for `/requests/`, `/batch-members/`, etc.
2. **Admin / Fleet Head** — `POST /admin/login` with username/password, returns JWT where `sub = "admin"`. All `/admin/*` endpoints require this token via `Authorization: Bearer <token>` **and** `x-admin-secret` header. Validated by `require_admin` in `app/api/deps.py`.

Fleet heads currently use admin credentials (MVP simplification — no fleet-head-specific auth endpoint exists yet).

**Background scheduler** (`app/core/scheduler.py`): APScheduler starts on startup with 6 jobs:
- Offer expiry monitor — 15s
- Priority assignment timeout — 30s
- Loading timeout — 30s
- Late arrival flagging — 30s
- Batch health monitor — 60s
- Delivery timeout — 5min

**Delivery status machine:** `CREATED → ASSIGNED → LOADING → EN_ROUTE → ARRIVED → MEASURING → AWAITING_OTP → COMPLETED`. Terminal states: `COMPLETED`, `FAILED`, `SKIPPED`. All transitions are validated via `app/utils/status_rules.py`. Every successful transition writes a `DeliveryEvent` + `AuditLog` row.

**Models of note:**
- `Tanker` — carries `pending_offer_type`, `pending_offer_id`, `offer_expires_at` for the offer-based dispatch flow
- `Batch` — groups multiple customer requests onto one tanker; has fill percentage and health scoring
- `DeliveryRecord` — one row per customer stop; tracks OTP, meter readings, and timestamps
- `DriverMetric` — per-zone scoring used by the assignment service to rank tankers

---

## Frontend Architecture

**Entry:** `src/main.tsx` → `App.tsx` — `BrowserRouter` with two explicit routes:
- `/` → `Index.tsx` (role selector + in-page view switching)
- `/admin` → `AdminDashboard.tsx`

**Role selection model:** `Index.tsx` reads `localStorage("tankup_active_role")` + separate auth keys on mount. It renders one of four views based on `role` state:

| Role state | Component | Auth key |
|------------|-----------|----------|
| `select` | Role picker UI | — |
| `client` | `ClientView` | `water_user` / `water_client_session` |
| `driver` | `DriverView` | `driver_auth` |
| `fleet_head` | `FleetHeadView` | `fleet_head_auth` |

Admin is always at `/admin` — never shown as a role card. Access is via 5 rapid clicks on the TankUp logo within 2 seconds.

**API libs:**
- `src/lib/api.ts` — base `apiRequest` wrapper
- `src/lib/admin.ts` — admin API calls (uses `x-admin-secret` + Bearer token)
- `src/lib/fleetHeadApi.ts` — fleet head API calls (same pattern, token stored as `fleet_head_auth`)
- `src/lib/driverApi.ts`, `src/lib/batches.ts`, `src/lib/requests.ts` etc. — domain-specific

**Theme:** CSS custom properties in `src/index.css`, toggled via `document.documentElement.classList.toggle("dark", ...)`. `localStorage("tankup-theme")` persists the preference.

**UI components:** `src/components/ui/` contains shadcn/ui primitives. Don't modify these directly — they're generated. Use them via import.

**Hooks:** Business logic lives in hooks under `src/hooks/`. `useClientFlow` and `useDriverFlow` are the main stateful orchestrators for the client and driver experiences respectively.

---

## Mobile Architecture

**Routing:** Expo Router (file-based). The `app/` directory maps directly to routes:
- `app/index.tsx` — role selection home screen
- `app/client/index.tsx`, `app/driver/index.tsx`, `app/admin/index.tsx`, `app/fleet-head/index.tsx`

**Auth + theme storage:** `AsyncStorage` (not localStorage). Keys mirror the web: `tankup_active_role`, `driver_auth`, `water_user`, `water_client_session`, `fleet_head_auth`, `tankup-theme`.

**Theme:** NativeWind (Tailwind for RN) + inline `style={}` props sourced from `constants/tankupTheme.ts`. Because NativeWind doesn't fully support dynamic theming, components use `const c = isDark ? darkColors : colors` and pass `c.foreground`, `c.primary` etc. as inline style values.

**Admin access:** 5 rapid taps on the logo within 2 seconds → `router.push("/admin")`.

**Router type definitions** (`mobile/.expo/types/router.d.ts`) are auto-generated at dev server start. New routes (`/fleet-head`) won't appear there until next `expo start` — this is expected and doesn't affect runtime.

---

## Key Conventions

**Status transitions are law.** Never set entity status directly in application code without going through the validated transition helpers in `app/utils/status_rules.py`. Every transition must produce an audit trail.

**Dispatch uses offers, not direct assignment.** The system never assigns a tanker directly. It generates a `JobOffer`, sends it to the driver, and waits for acceptance or expiry. Rejected/expired offers trigger retry with a different tanker.

**Batch vs. priority:** Two fundamentally different delivery modes. Batch groups multiple customers on one tanker run (cheaper, slower). Priority dedicates a tanker to one customer (expensive, fast). Most of the dispatch and payment logic branches on `delivery_type`.

**Fleet head auth for MVP:** Fleet heads authenticate via `POST /admin/login` and use the same admin endpoints. When fleet-head-specific backend endpoints are built, `src/lib/fleetHeadApi.ts` and `mobile/app/fleet-head/index.tsx` are the files to update.

**Docs are the source of truth for product decisions.** When in doubt about intended behavior (transition rules, pricing logic, dispatch scoring), check `docs/` before improvising.
