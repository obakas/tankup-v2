# Batch Availability & Customer Presence

**Status: design note — batch delivery is currently suspended.** This documents the availability
problem discovered 2026-08-16 and the agreed resumption plan, so batch can be re-enabled without
re-deriving this thinking. Nothing here is implemented for batch yet unless marked "already exists".

## The problem

Batch delivery shares one tanker across customers, but demand is time-dependent and the water is
physical. Two failure modes:

1. **Window mismatch.** Customer A wants water this afternoon, Customer B this evening. If both land
   in the same batch, one of them is always wrong.
2. **The absent customer.** A customer in Kubwa is at work in Central Area when the batch dispatches.
   Either she drives home (unacceptable), the tanker waits (destroys the economics and ghosts every
   downstream stop), or the stop is skipped (feels like TankUp stealing her water if she wasn't
   warned at order time).

The underlying abstraction: a batch customer is not buying litres, they are buying
**litres + a delivery slot + an obligation to make the tank accessible during that slot**.
Batch = cheaper, less flexible. Priority = pricier, more flexible. That trade-off must be explicit
in the product, at order time.

## What already exists (do not rebuild)

- **Per-stop queue position + ETA** — `batch_live_service.py` computes `stops_ahead` from
  `stop_order` and per-member distance ETA; customer arrival ring shipped. There is no
  batch-wide "tanker filled!" blast to remove.
- **Skip flow** — `skip_delivery_stop()` in `delivery_service.py` with `skip_reason` /
  `reason_code`; `skipped` is a valid terminal per-stop state in `status_rules.py`; member status
  propagates; refunds handled by the refund pipeline.
- **Scheduled requests** — `LiquidRequest.scheduled_for` + `scheduled` status + activation monitor.
  Currently flagged "meaningful only for priority"; the batch fix is largely *exposing this for
  batch mode*, not building new machinery.
- **90-minute batch fill window** — de facto keeps afternoon and evening demand in separate batches,
  provided scheduled batch requests only enter the pool at their chosen time.

## Resumption plan, in priority order

### 1. Proxy receiver (highest leverage, smallest build)

In Abuja compounds the person opening the tank is usually not the payer — gateman, family member,
house help. The only blocker today is that the delivery code lives in the payer's app.

Build: at request time ask **"who will receive this delivery?"** — name + phone. Send (or let the
customer forward) the delivery code to that phone. A 6-digit code read over the phone works
regardless of the receiver's IT literacy. No new OTP infrastructure.

This also solves the Kubwa/Central Area case outright: nobody drives home for water.

**Implement at the request level, not batch level.** Receiver name + phone belongs on
`LiquidRequest` (flowing down to the `DeliveryRecord` stop), not on `BatchMember` — the
payer-isn't-the-receiver pattern applies to both delivery modes. Ship it on **priority first**,
while batch is suspended: priority is live, so it validates the whole flow (do customers fill it
in, can gatemen read codes to drivers) before batch resumes. When batch returns, its hardest
availability fix is already proven.

### 2. Dwell timeout (policy + monitor)

Skip exists but is driver-initiated with no enforced maximum wait, so "driver waits 40 minutes as a
favour" is still possible. Add a scheduler job in the existing pattern (late-arrival /
loading-timeout monitors): waiting at a stop > N minutes → push warning to customer → flag stop for
skip. Start as a **driver-facing countdown + recommendation**, not a hard auto-skip — drivers will
resist an app that skips a customer they're on the phone with. Skipped customer gets the existing
refund/reschedule flow.

### 3. Batch-mode scheduling (near-zero backend work)

Let the batch request flow set `scheduled_for` (morning / afternoon / evening picker — simple enums,
not a datetime widget, per IT-literacy constraints). The scheduled-request monitor already activates
them; the 90-minute fill window then separates the windows naturally.

### Explicitly rejected: pre-dispatch confirmation push

"Will someone be available? Confirm / Reschedule, no answer = auto-removed" assumes customers
reliably answer a push within 30–60 minutes. Field research (Asokoro + park engagement) says the
opposite: low IT literacy, missed notifications are the norm. No-response auto-removal silently
drops paying customers and reads as TankUp ghosting *them*. The proxy-receiver field at order time
achieves the same goal without a real-time response dependency. Revisit only if pilot data shows
customers do respond to pushes.

### Deferred: formal time-windowed batch objects

Explicit "Kubwa 2–4 PM" batch entities with locked windows and route generation are correct at
scale, but premature: the Asokoro deputy is skeptical of batch, launch is exclusive/manual-dispatch
first, and items 1–3 above cover the failure modes at pilot volume. Build only when batch volume
makes window collisions an observed problem rather than a hypothetical one.

## Customer-facing framing when batch resumes

At join time, state the deal plainly: *"Cheaper delivery, arriving between X and Y. Someone must be
able to open your tank in that window — you or your named receiver."* The skip policy is then a
kept promise, not a surprise.
