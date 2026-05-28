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
source .venv/bin/activate   # always activate venv first

# Install dependencies
pip install -r app/requirements.txt

# Run dev server — must use --host 0.0.0.0 for phone access
uvicorn app.main:app --reload --host 0.0.0.0

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

npm run dev        # dev server on :8080
npm run build      # production build
npm run lint       # ESLint
npm run test       # vitest (single run)
npm run test:watch # vitest watch mode
```

### Mobile
```bash
cd mobile

npx expo start --tunnel --clear  # physical device (router has AP isolation — LAN doesn't reach phone)
npx expo start --android         # open Android emulator
npx expo start --ios             # open iOS simulator
npm run lint                     # expo lint
```

### Combined dev (backend + ngrok + mobile env — recommended for physical device)
```bash
# Terminal 1 — starts backend with venv, ngrok tunnel, patches mobile/app.json automatically
bash scripts/dev.sh

# Terminal 2
cd mobile && npx expo start --tunnel --clear
```

---

## Backend Architecture

**Entry point:** `app/main.py` — mounts all routers, starts the APScheduler, configures CORS.

**Config:** `app/core/config.py` — reads from `backend/.env`. Key vars:
- `DATABASE_URL` — Supabase PostgreSQL in prod, SQLite for local fallback
- `ADMIN_SECRET` — intended `x-admin-secret` header value (enforcement is implemented but currently disabled at router level)
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
| `/sites` | Customer site profiles (tank size, fill level history) |
| `/customers` | Customer-side delivery confirmation |
| `/admin` | Admin read/write operations — requires Bearer JWT with `sub="admin"` |
| `/admin/login` | Admin + fleet head login, returns JWT |
| `/histories`, `/notifications`, `/healths` | Supporting endpoints |

**Auth model — two separate systems:**

1. **Customer users** — `POST /auth/login` with phone number, returns JWT stored client-side. Used for `/requests/`, `/batch-members/`, etc.
2. **Admin / Fleet Head** — `POST /admin/login` with username/password, returns JWT where `sub = "admin"`. All `/admin/*` endpoints require `Authorization: Bearer <token>` validated by `require_admin` in `app/api/deps.py` (checks `sub == "admin"`). Note: `x-admin-secret` header enforcement exists in `admins.py` but is currently commented out at the router level.

Fleet heads currently use admin credentials (MVP simplification — no fleet-head-specific auth endpoint exists yet).

**Background scheduler** (`app/core/scheduler.py`): APScheduler starts on startup with 6 jobs:
- Offer expiry monitor — 15s
- Priority assignment timeout — 30s
- Loading timeout — 30s
- Late arrival flagging — 30s
- Batch health monitor — 60s
- Delivery timeout — 5min

**Delivery status machine:** `pending → en_route → arrived → measuring → awaiting_otp → delivered`. Terminal states: `delivered`, `failed`, `skipped`. All transitions are validated via `app/utils/status_rules.py`. Every successful transition writes a `DeliveryEvent` + `AuditLog` row.

**Timeout policy** (`app/utils/time_policy.py`): Offer accept: 60s. Loading: 45min. Priority assignment: 20min. Batch fill: 90min. Late arrival alert: 20min. Delivery timeout: 6h.

**Models of note:**
- `Tanker` — carries `pending_offer_type`, `pending_offer_id`, `offer_expires_at` for the offer-based dispatch flow
- `Batch` — groups multiple customer requests onto one tanker; has fill percentage and health scoring
- `DeliveryRecord` — one row per customer stop; tracks OTP, meter readings, and timestamps
- `DriverMetric` — per-zone scoring used by the assignment service to rank tankers

---

## Frontend Architecture

**Entry:** `src/main.tsx` → `App.tsx` — `BrowserRouter` wrapping TanStack Query `QueryClientProvider`, with two explicit routes:
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
- `src/lib/adminAuth.ts` — admin token storage (`admin_access_token` in localStorage)
- `src/lib/admin.ts` — admin API calls (Bearer token)
- `src/lib/fleetHeadApi.ts` — fleet head API calls (token stored as `fleet_head_auth`)
- `src/lib/driverApi.ts`, `src/lib/batches.ts`, `src/lib/requests.ts` etc. — domain-specific

**Maps:** Leaflet (`import "leaflet/dist/leaflet.css"` in `main.tsx`). Used for driver location display in fleet/admin views.

**Theme:** CSS custom properties in `src/index.css`, toggled via `document.documentElement.classList.toggle("dark", ...)`. `localStorage("tankup-theme")` persists the preference.

**UI components:** `src/components/ui/` contains shadcn/ui primitives. Don't modify these directly — they're generated. Use them via import.

**Hooks:** Business logic lives in hooks under `src/hooks/`. `useClientFlow` and `useDriverFlow` are the main stateful orchestrators for the client and driver experiences respectively.

---

## Mobile Architecture

**Routing:** Expo Router (file-based). The `app/` directory maps directly to routes:
- `app/index.tsx` — role selection home screen
- `app/client/index.tsx`, `app/driver/index.tsx`, `app/admin/index.tsx`, `app/fleet-head/index.tsx`

**Auth + theme storage:** `AsyncStorage` (not localStorage). Keys mirror the web: `tankup_active_role`, `driver_auth`, `water_user`, `water_client_session`, `fleet_head_auth`, `tankup-theme`.

**Theme:** Two patterns coexist — prefer `useAppTheme()`:
- `hooks/useAppTheme.ts` → returns `{ theme, themeMode, isDark, toggleTheme }` where `theme` is a `TankupTheme` object (from `components/ui/theme.ts`). Has richer tokens: `successSoft`, `destructiveSoft`, `warningSoft`, `cardSoft`, `input`, `shadow`, etc. Used by driver, fleet-head, client, and admin screens.
- `constants/tankupTheme.ts` → simpler `colors` / `darkColors` objects. Only used by the home screen (`app/index.tsx`). Don't use for new screens.

Both patterns pass theme values as inline `style={{ color: theme.foreground }}` props since NativeWind doesn't support dynamic theming at runtime.

**API libs:** `lib/api.ts` (base `apiRequest`), `lib/driverApi.ts`, `lib/fleetHeadApi.ts` (fleet head — Bearer token stored in AsyncStorage as `fleet_head_auth`). All requests include `ngrok-skip-browser-warning: true` to bypass ngrok's interstitial when tunnelling.

**Background polling:** `hooks/useAppStatePause.ts` — pauses polling hooks when the app enters the background (AppState `active` check). Use this in any hook that polls the backend on an interval.

**API base URL:** Read from `Constants.expoConfig.extra.API_BASE_URL` (set in `mobile/app.json` → `extra.API_BASE_URL`). `scripts/dev.sh` patches this automatically with the current ngrok tunnel URL on every run. Don't rely on `EXPO_PUBLIC_API_BASE_URL` in `.env` — it doesn't inline reliably with Expo Go + `--tunnel`.

**Admin access:** 5 rapid taps on the logo within 2 seconds → `router.push("/admin")`.

**Router type definitions** (`mobile/.expo/types/router.d.ts`) are auto-generated at dev server start. New routes (`/fleet-head`) won't appear there until next `expo start` — this is expected and doesn't affect runtime.

---

## Key Conventions

**Status transitions are law.** Never set entity status directly in application code without going through the validated transition helpers in `app/utils/status_rules.py`. Every transition must produce an audit trail.

**Dispatch uses offers, not direct assignment.** The system never assigns a tanker directly. It generates a `JobOffer`, sends it to the driver, and waits for acceptance or expiry. Rejected/expired offers trigger retry with a different tanker.

**Batch vs. priority:** Two fundamentally different delivery modes. Batch groups multiple customers on one tanker run (cheaper, slower). Priority dedicates a tanker to one customer (expensive, fast). Most of the dispatch and payment logic branches on `delivery_type`.

**Fleet head auth for MVP:** Fleet heads authenticate via `POST /admin/login` and use the same admin endpoints. When fleet-head-specific backend endpoints are built, `src/lib/fleetHeadApi.ts` and `mobile/app/fleet-head/index.tsx` are the files to update.

**Docs are the source of truth for product decisions.** When in doubt about intended behavior (transition rules, pricing logic, dispatch scoring), check `docs/` before improvising.
