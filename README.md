# TankUp

**TankUp** is a water tanker delivery coordination platform. It connects customers who need water delivered with drivers/tankers who deliver it, coordinated by fleet heads and governed by admins.

## What it does

Water trucking in most cities today runs on phone calls and word of mouth — missed calls mean lost customers, and drivers show up to jobs blind to site conditions they'll only discover once they arrive. TankUp turns that into a digital, always-on coordination system.

Two delivery modes are supported:

- **Batch** — multiple nearby customer requests are grouped onto a single tanker run. Cheaper and slower, since the tanker makes several stops.
- **Priority** — a tanker is dedicated to a single customer. Faster, and priced accordingly.

## How it works

1. A customer submits a delivery request (batch or priority).
2. The backend's offer-based dispatch engine ranks available tankers and sends a time-boxed job offer to a driver. If it's rejected or expires, the offer moves on to the next-ranked driver.
3. The driver progresses through a validated delivery state machine: loading → en route → arrived → measuring → OTP confirmation → completed.
4. Fleet heads see all of their tankers on a live dashboard instead of coordinating over calls and messages. Admins get platform-wide oversight, audit logs, and operational alerting (e.g. a tanker going offline mid-delivery triggers a re-assignment alert).
5. After each delivery, the driver records site conditions (tank height, hose difficulty). That "site intelligence" is remembered and factored into future dispatch decisions for that site — so the platform gets smarter about difficult sites over time instead of drivers rediscovering the same problems on every visit.

Every status change goes through an enforced transition table and produces an audit trail — nothing moves state silently.

## Tech stack

| Workspace | Stack |
|---|---|
| `backend/` | FastAPI, SQLAlchemy 2.0, Alembic, APScheduler, PostgreSQL (Supabase), JWT auth |
| `frontend/` | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Leaflet |
| `mobile/` | React Native (Expo), Expo Router, NativeWind, react-native-maps, Reanimated |

## Repo structure

```
backend/    FastAPI + SQLAlchemy + PostgreSQL API and dispatch engine
frontend/   React web app (customer / driver / fleet head / admin views)
mobile/     Expo React Native app (customer / driver / fleet head / admin views)
docs/       Product spec — domain model, status/transition rules, dispatch model, pricing, etc.
scripts/    Dev tooling, e.g. combined backend + tunnel + mobile-config startup script
```

The three workspaces are independent — each has its own dependency manager and `.env` file. There's no shared monorepo tooling tying them together.

## Getting started

Each workspace needs its own `.env` file — copy the corresponding `.env.example` in each folder and fill in the values before running.

### Backend

```bash
cd backend
source .venv/bin/activate   # always activate venv first

pip install -r requirements.txt

# Run the dev server — must bind 0.0.0.0 for the mobile app to reach it
uvicorn app.main:app --reload --host 0.0.0.0

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Frontend

```bash
cd frontend
npm install

npm run dev    # dev server on :8080
npm run build  # production build
npm run lint
npm run test   # vitest
```

### Mobile

```bash
cd mobile
npm install

npx expo start --tunnel --clear  # physical device
npx expo start --android         # Android emulator
npx expo start --ios             # iOS simulator
```

### Combined dev workflow (recommended for testing on a physical device)

```bash
# Terminal 1 — starts the backend, opens an ngrok tunnel, and patches mobile/app.json with the tunnel URL
bash scripts/dev.sh

# Terminal 2
cd mobile && npx expo start --tunnel --clear
```

## Documentation

The `docs/` directory is the source of truth for product and domain decisions — read it before making significant changes. A few starting points:

- `docs/mvp-scope.md` — what's in and out of scope for the current MVP
- `docs/workflow.md` — the delivery status flow
- `docs/dispatch-model.md` — how tankers are ranked and offered jobs
- `docs/entities.md` — the core data entities
- `docs/transition-rules.md` — allowed/forbidden status transitions

## Status

TankUp is an active work-in-progress MVP, not a finished product. Expect incomplete auth flows, mocked payment integrations, and features still being validated against real-world usage.
