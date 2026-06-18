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
pip install -r requirements.txt

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

# Run a single test file
npx vitest run src/path/to/file.test.ts
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
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — Supabase storage integration
- `PAYMENT_PROVIDER` — payment backend selection (default: `paystack`)
- `WEB_PUSH_PRIVATE_KEY_FILE` / `WEB_PUSH_PUBLIC_KEY_FILE` / `WEB_PUSH_SUBJECT` — web push key file paths

**Route structure** (all under `app/api/routes/`):

| Prefix | Purpose |
|--------|---------|
| `/requests` | Customer delivery request creation |
| `/batches` | Batch lifecycle |
| `/batch-members` | Individual members within a batch |
| `/tankers` | Tanker CRUD and driver job flow — **most endpoints are public (no auth)** |
| `/deliveries` | Delivery record transitions (current, uses `DeliveryRecord` + state machine) |
| `/delivery` | **Legacy** — `delivery.py` only has `/confirm/{id}` (OTP on `BatchMember`). Coexists with `deliveries.py`; do not add new endpoints here |
| `/payments`, `/refunds` | Payment lifecycle |
| `/auth`, `/users` | Customer auth (phone-based) |
| `/sites` | Customer site profiles (tank size, fill level history) |
| `/customers` | Customer-side delivery confirmation |
| `/admin` | Admin read/write operations — requires Bearer JWT with `sub="admin"` |
| `/admin/login` | Admin + fleet head login, returns JWT |
| `/incidents` | Incident reports from drivers |
| `/histories`, `/notifications`, `/healths` | Supporting endpoints |

**Auth model — two separate systems:**

1. **Customer users** — `POST /auth/login` with phone number, returns JWT stored client-side. Used for `/requests/`, `/batch-members/`, etc.
2. **Admin / Fleet Head** — `POST /admin/login` with username/password, returns JWT where `sub = "admin"`. All `/admin/*` endpoints require `Authorization: Bearer <token>` validated by `require_admin` in `app/api/deps.py` (checks `sub == "admin"`). Note: `x-admin-secret` header enforcement exists in `admins.py` but is currently commented out at the router level.

Fleet heads currently use admin credentials (MVP simplification — no fleet-head-specific auth endpoint exists yet).

**Background scheduler** (`app/core/scheduler.py`): APScheduler starts on startup with 11 jobs:
- Offer expiry monitor — 15s
- Offer reminder monitor — 15s (sends one reminder push partway through the 60s accept window if still unanswered)
- Searching-driver retry monitor — 30s
- Priority assignment timeout — 30s
- Loading timeout — 30s
- Late arrival flagging — 30s
- Driver offline monitor — 30s
- Batch health monitor — 60s
- Nearby notification monitor — 60s
- Scheduled request monitor — 60s
- Delivery timeout — 5min

**Status machines** — all defined in `app/utils/status_rules.py`. Every transition must go through `ensure_valid_transition()`.

| Entity | Status flow |
|--------|-------------|
| Tanker | `available → assigned → loading → delivering → arrived → completed → available` |
| Batch | `forming ↔ near_ready → ready_for_assignment → assigned → loading → delivering → arrived → completed/partially_completed/failed/expired` |
| Request | `pending → searching_driver → assigned → loading → delivering → arrived → completed/partially_completed/failed` |
| DeliveryRecord | `pending → en_route → arrived → measuring → awaiting_otp → delivered` |

Terminal states: `completed`, `partially_completed`, `failed`, `expired`, `assignment_failed`, `cancelled` (batch/request); `delivered`, `failed`, `skipped` (delivery). Every successful transition writes a `DeliveryEvent` + `AuditLog` row.

**Timeout policy** (`app/utils/time_policy.py`): Offer accept: 60s. Loading: 45min. Priority assignment: 20min. Batch fill: 90min. Late arrival alert: 20min. Delivery timeout: 6h.

**Models of note:**
- `Tanker` — carries `pending_offer_type`, `pending_offer_id`, `offer_expires_at` for the offer-based dispatch flow
- `Batch` — groups multiple customer requests onto one tanker; has fill percentage and health scoring
- `DeliveryRecord` (`models/DeliveryRecord.py` — note PascalCase, unlike all other model files) — one row per customer stop; tracks OTP, meter readings, and timestamps
- `DriverMetric` — per-zone scoring used by the assignment service to rank tankers
- `OperationAlert` — surfaced in the admin ops dashboard; fields: `alert_type`, `severity`, `job_type`, `job_id`, `status` (`open`/`resolved`). Admins can trigger re-assignment from an open alert via `POST /admin/operation-alerts/{id}/reassign`

**Schemas** (`app/schemas/`): Pydantic models for request/response validation. Separate from SQLAlchemy models. Named after their domain: `batch.py`, `delivery.py`, `tanker.py`, etc. `DeliveryOut.py` is the exception (PascalCase) and mirrors the model file naming.

**Service layer** (`app/services/`): Routes are thin — all business logic lives in services. Key services:

| Service | Responsibility |
|---------|---------------|
| `assignment_service.py` | Tanker ranking + `JobOffer` creation for both batch and priority |
| `priority_service.py` | Priority-mode assignment flow + retry logic |
| `batch_orchestration_service.py` | Batch state machine orchestration |
| `batch_monitor_service.py` | Scheduler-driven batch health checks |
| `batch_scoring_service.py` | Batch fill-level and priority scoring |
| `batch_live_service.py` | Builds live snapshot for client-side batch polling (next action hint, fill %, stop list) |
| `batch_service.py` | Batch read helpers (`get_batch_by_id`, `get_batch_members`) |
| `batch_member_service.py` | Member leave and batch-membership lifecycle helpers |
| `driver_flow_service.py` | Driver offer accept/reject, loading, delivery step transitions |
| `driver_scoring_service.py` | Zone-based `DriverMetric` updates after each delivery |
| `driver_offline_service.py` | Detects tankers with stale heartbeats; creates `OperationAlert`; escalates with push if actively delivering |
| `delivery_service.py` | `DeliveryRecord` state transitions (arrive, measure, OTP, complete) |
| `delivery_timeout_service.py` | Scheduler-driven delivery timeout enforcement |
| `loading_timeout_service.py` | Scheduler-driven loading timeout enforcement |
| `late_arrival_service.py` | Flags tankers that haven't arrived within the SLA |
| `nearby_notification_service.py` | Sends Expo push when a relevant batch forms near a customer's registered site |
| `notification_preference_service.py` | Checks per-user notification opt-ins before sending any push |
| `operation_alert_service.py` | Creates `OperationAlert` rows surfaced in admin dashboard for operational issues |
| `payment_service.py` | Payment creation and status transitions |
| `payout_service.py` | Driver payout calculations |
| `refund_service.py` | Executes member refunds via payment provider |
| `client_flow_service.py` | Customer-facing request lifecycle helpers |
| `site_intelligence_service.py` | Site difficulty scoring from delivery history |
| `routing_service.py` | Haversine distance calculation between coordinates (used in scoring + nearby notifications) |
| `admin_audit_service.py` | `AuditLog` writes for all admin mutations |

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

**Component structure:** `src/components/` is split by role — `driver/`, `client/`, `admin/` each contain step-level screens and modals for that role view. `shared/` has `LiveDeliveryMap.tsx` (Leaflet). `ui/` is shadcn/ui primitives — don't modify directly.

**Types:** `src/types/` — `driver.ts` (`DriverStep`, `DriverJob`, `DriverStop`), `client.ts` (`ClientStep`, `RequestMode`), `driverAuth.ts`. Import from here, not from hook/API files.

**Toasts:** Use `import { toast } from "sonner"` directly in hooks and components. The `<Sonner />` renderer is mounted in `App.tsx`. Don't use shadcn's `useToast` hook for new code.

**Pricing constants:** `src/constants/water.ts` — `BATCH_PRICE_PER_LITER`, `PRIORITY_FULL_TANKER_PRICE`, `PLATFORM_PRIORITY_COMMISSION_RATE`, `PLATFORM_BATCH_COMMISSION_RATE`. Import from here whenever pricing logic is needed.

**UI components:** `src/components/ui/` contains shadcn/ui primitives. Don't modify these directly — they're generated. Use them via import.

**Hooks** (`src/hooks/`):

| Hook | Purpose |
|------|---------|
| `useClientFlow` | Client experience orchestrator — request → batch/priority → payment → delivery |
| `useDriverFlow` | Driver experience orchestrator — auth → offer → loading → delivery steps |
| `useLiveBatch` | TanStack Query polling for batch live state |
| `useLivePriorityRequest` | TanStack Query polling for priority request state |
| `useDriverAuth` | Driver login/register flow |
| `useDriverLocationHeartbeat` | Sends GPS coords to backend on interval |
| `useDriverOfferAlarm` | Plays sound/vibration when a new offer arrives |
| `useClientDeliveryAlerts` | Surfaces delivery status changes as toasts |
| `useWebPushNotifications` | Browser push notification subscription (frontend) — mobile equivalent is `usePushNotifications` |

---

## Mobile Architecture

**Routing:** Expo Router (file-based). The `app/` directory maps directly to routes:
- `app/index.tsx` — role selection home screen
- `app/client/index.tsx`, `app/driver/index.tsx`, `app/admin/index.tsx`, `app/fleet-head/index.tsx`

**Auth + theme storage:** `AsyncStorage` (not localStorage). Keys mirror the web: `tankup_active_role`, `driver_auth`, `water_user`, `water_client_session`, `fleet_head_auth`, `tankup-theme`.

**Theme:** Two patterns coexist — prefer `useAppTheme()`:
- `hooks/useAppTheme.ts` → returns `{ theme, themeMode, isDark, toggleTheme }` where `theme` is a `TankupTheme` object (from `components/ui/theme.ts`). Has richer tokens: `successSoft`, `destructiveSoft`, `warningSoft`, `cardSoft`, `input`, `shadow`, etc. Used by driver, fleet-head, client, and admin screens.
- `constants/tankupTheme.ts` → simpler `colors` / `darkColors` objects. Only used by the home screen (`app/index.tsx`). Don't use for new screens.

Both patterns pass theme values as inline `style={{ color: theme.foreground }}` props since NativeWind doesn't support dynamic theming at runtime. **NativeWind hybrid rule:** use `className` for static layout/spacing (`flex-row`, `p-4`, `rounded-2xl`); use inline `style` for every dynamic color.

**Fleet-head brand color is intentionally hardcoded** and not in the theme system: `const VIOLET = "#8b5cf6"` / `const VIOLET_SOFT = "rgba(139,92,246,0.12)"` — used in `app/fleet-head/index.tsx` and `app/index.tsx`. Do not move these to the theme.

**Toast system:** `useToast()` from `hooks/useToast.ts` returns `{ toast, showToast }`. `showToast("msg")` = green; `showToast("msg", false)` = red. Render `<ToastMessage toast={toast} theme={theme} />` at the `SafeAreaView` root (not inside `ScrollView`) — it's absolutely positioned with `zIndex: 999`.

**Skeleton loaders:** `<Skeleton theme={theme} width={200} height={20} borderRadius={8} />` from `components/ui/Skeleton.tsx`. Uses Reanimated v4 `withRepeat` on the UI thread. Swap out for real content once the first fetch resolves.

**API libs:** `lib/api.ts` (base `apiRequest`), `lib/driverApi.ts`, `lib/fleetHeadApi.ts` (fleet head — Bearer token stored in AsyncStorage as `fleet_head_auth`). All requests include `ngrok-skip-browser-warning: true` to bypass ngrok's interstitial when tunnelling.

**Mobile hooks** (`hooks/`): `useAppTheme`, `useAppStatePause`, `useClientFlow`, `useDriverFlow`, `useDriverOfferAlarm`, `useLocationHeartbeat` (GPS heartbeat — named differently from the frontend's `useDriverLocationHeartbeat`), `usePushNotifications` (Expo push — named differently from the frontend's `useWebPushNotifications`), `useToast`.

**Background polling:** Two patterns must be used together in any hook that polls the backend:

1. **`searchRef` — stale closure prevention.** State used inside `setInterval` must be mirrored to a ref each render so the callback reads fresh values:
   ```ts
   const searchRef = useRef(search);
   searchRef.current = search; // on every render
   setInterval(() => fetch(searchRef.current), POLL_MS);
   ```

2. **`useAppStatePause`** — pauses/resumes polling when the app backgrounds. Pass `stopPolling`/`restartPolling` callbacks:
   ```ts
   useAppStatePause(stopPolling, restartPolling);
   ```

**API base URL:** Read from `Constants.expoConfig.extra.API_BASE_URL` (set in `mobile/app.json` → `extra.API_BASE_URL`). `scripts/dev.sh` patches this automatically with the current ngrok tunnel URL on every run. Don't rely on `EXPO_PUBLIC_API_BASE_URL` in `.env` — it doesn't inline reliably with Expo Go + `--tunnel`.

**Admin access:** 5 rapid taps on the logo within 2 seconds → `router.push("/admin")`.

**Router type definitions** (`mobile/.expo/types/router.d.ts`) are auto-generated at dev server start. New routes (`/fleet-head`) won't appear there until next `expo start` — this is expected and doesn't affect runtime.

**Do not prop-drill `theme`** in mobile screens — call `useAppTheme()` directly in each component that needs it. They all converge on the same AsyncStorage value.

**Mobile-specific patterns** (polling architecture, toast placement, skeleton loaders, admin API headers, role card hydration logic) are documented in detail in `mobile/CLAUDE.md`.

---

## Key Conventions

**Status transitions are law.** Never set entity status directly in application code without going through the validated transition helpers in `app/utils/status_rules.py`. Every transition must produce an audit trail.

**Dispatch uses offers, not direct assignment.** The system never assigns a tanker directly. It generates a `JobOffer`, sends it to the driver, and waits for acceptance or expiry. Rejected/expired offers trigger retry with a different tanker.

**Batch vs. priority:** Two fundamentally different delivery modes. Batch groups multiple customers on one tanker run (cheaper, slower). Priority dedicates a tanker to one customer (expensive, fast). Most of the dispatch and payment logic branches on `delivery_type`.

**Fleet head auth for MVP:** Fleet heads authenticate via `POST /admin/login` and use the same admin endpoints. When fleet-head-specific backend endpoints are built, `src/lib/fleetHeadApi.ts` and `mobile/app/fleet-head/index.tsx` are the files to update.

**Docs are the source of truth for product decisions.** When in doubt about intended behavior (transition rules, pricing logic, dispatch scoring), check `docs/` before improvising.

---

## Field Research Context — Asokoro Tanker Hub (June 2026)

Two site visits were made to the Asokoro tanker hub before the demo. The hub leader and deputy were interviewed. These findings are ground truth for product decisions. When building or evaluating any feature, check it against this context.

### Operational realities confirmed in the field

**"Customers pay for diesel, not water."** Water as a commodity is almost free. What customers are paying for is the fuel cost + service cost of getting it delivered. All customer-facing language should frame the transaction as a delivery service fee, not a water purchase. Avoid "price per litre of water" framing.

**Tank elevation is the #1 driver pain.** Drivers often arrive at a site and discover the tank is very high or the hose run is extremely long. They don't know this ahead of time. Experienced drivers learn which customers to reject on repeat requests. Some drivers turn back after arriving, counting the trip as a loss, to protect their pump engine. **The site intelligence system directly solves this** — drivers capture actual tank height + hose difficulty post-delivery; it's remembered for every future dispatch. This is the strongest product-market fit story and should be the centrepiece of any demo.

**Non-payment / coercion is a real operational risk.** Generals, military, and high-status customers sometimes bully drivers into delivering without payment, underpay, or set impossible conditions. **Pre-payment before dispatch completely solves this.** The fact that every customer has already paid before the driver is sent is a major driver benefit — make it visually prominent on the driver offer card, not buried.

**They already have informal dispatch systems.** The hub uses informal coordination (Truecaller, WhatsApp). Formal clients (banks, presidential villa, barracks, hotels) use formal dispatch. TankUp should position as an upgrade to their existing system, not a replacement that disrupts it. Don't imply their current methods are wrong.

**They lose customers by missing calls.** This is confirmed. The platform solves it by being always-on and digital — orders come in at any time and wait for the driver, rather than being lost when a call is missed.

**10–11 jobs per tanker per day** at peak. Dispatch needs to be fast enough to keep drivers occupied. Idle time between offers is a driver retention risk.

**Hard-to-serve areas: Lugbe, Airport Road, Orozo** — no water lifting point nearby. Tankers can only realistically serve areas within diesel-viable distance from their hub/lifting point. The system does not yet model lifting point locations, which affects dispatch radius and batch formation. Do not dispatch tankers to areas far from their loading source without accounting for this.

**Remaining water is thrown away after delivery** to reduce vehicle weight and save diesel on the return trip. Partial delivery is normal operational behaviour, not a defect.

**Maintenance is the biggest financial pain** — up to ₦200k per incident. The app does not address this yet (future fleet management scope).

**Peak demand: dry season (January–March).** Current period (June) is low season. Hub leader is time-poor during visits — keep demos tight.

**Customers pay more to skip the queue during high demand.** The hub already does this informally — they tell the customer an expected delivery time, and a customer who doesn't want to wait can pay more to be served faster. This is already implemented as the **Priority** delivery mode (dedicated tanker, faster, costs more) — no new feature needed, just frame it in demos as "the fast-track customers already ask for, made formal."

**Mid-delivery breakdowns are handled by transfer or replacement.** If a tanker breaks down mid-job and it's urgent, the hub transfers the water load to another tanker or sends a replacement. This is already covered by `driver_offline_service.py` (detects stale heartbeats, escalates with push if actively delivering) creating an `OperationAlert`, which an admin resolves via `POST /admin/operation-alerts/{id}/reassign` — no new feature needed.

### What the hub is skeptical about

**Batch delivery** — the deputy was not sold on it. Do not lead with batch delivery in demos or sales conversations. Present it as an optional efficiency mechanism that emerges naturally. Let them adopt basic coordination first, then batch.

**Flow meters / precise volume verification** — they are sceptical. Do not pitch hardware meter integration. The OTP + driver measurement approach is sufficient for trust.

**Technology solving the tank elevation problem** — the deputy explicitly doubted whether technology could identify high-tank customers. The answer is: the app doesn't magically know — the driver tells it after the first delivery and it's remembered forever. This must be demonstrated concretely, not just claimed.

### Demo narrative order (tested against field feedback)

1. Site intelligence — "you told me drivers turn back because of high tanks. Here's exactly how we fix that."
2. Offer screen with site risk badge + pre-paid badge — driver sees the difficulty and the payment guarantee before accepting.
3. Fleet head dashboard — hub leader sees all tankers in one screen, no WhatsApp coordination.
4. Never-miss-an-order — 24/7 digital requests, no lost calls.
5. (Brief mention only) Batch delivery — one tanker, three nearby customers, one trip.

### Key feature gaps identified from field research

- **Driver offer screen lacks site difficulty summary** — before a driver accepts, they should see the site risk score and last driver's note (tank height, hose difficulty). This is the single highest-impact UI gap relative to field feedback.
- **Pre-paid status is not visually prominent** on the driver offer card — needs a clear badge.
- **Post-delivery site intelligence prompt is the missing UX** — after OTP confirmation, a 2–3 question form (tank height enum, hose difficulty, accessibility notes) is what captures the data the site intelligence system depends on.
- **Lifting point locations are unmodeled** in backend/dispatch — future work before scaling beyond Asokoro.
