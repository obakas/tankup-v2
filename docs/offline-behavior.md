# TankUp V2 — Offline Behavior

## Purpose

TankUp must survive weak internet.

In Nigerian logistics, offline behavior is not an edge case.

It is Tuesday.

Drivers may lose signal during:

- loading,
- navigation,
- arrival,
- measurement,
- OTP,
- incident reporting.

The system must avoid chaos when connectivity breaks.

---

# 1. Core Principle

The server remains the source of truth.

The client may store pending actions temporarily.

No final delivery completion should be trusted until confirmed by the server.

---

# 2. Offline-Capable Actions

Future mobile app should support local saving for:

```txt
driver_arrived
measurement_started
measurement_completed
incident_reported
site_intelligence_submitted
photo_evidence_captured
otp_attempted
location_ping
```

---

# 3. Actions That Must Require Server Confirmation

```txt
payment_confirmation
delivery_completion
refund
payout
admin_override
driver_assignment
offer_acceptance
```

Reason:

These actions affect money, trust, or dispatch integrity.

---

# 4. Offline Event Queue

When offline, the mobile app may save events locally:

```txt
local_event_id
event_type
entity_type
entity_id
payload
created_at_device
sync_status
retry_count
```

Statuses:

```txt
pending_sync
syncing
synced
failed
conflict
```

---

# 5. Sync Rules

When network returns:

1. Send queued events in order.
2. Server validates each event.
3. Server accepts, rejects, or marks conflict.
4. Client updates local state.
5. User is shown result.

---

# 6. Conflict Examples

## Example 1

Driver recorded `arrived` offline.

But admin already cancelled delivery.

Result:

```txt
conflict
```

Server wins.

---

## Example 2

Driver recorded `measurement_completed` offline.

But delivery is still `loading` on server.

Result:

```txt
rejected
```

Reason:

Forbidden transition.

---

## Example 3

Driver submits incident offline.

Delivery still exists.

Result:

```txt
accepted
```

---

# 7. Offline OTP Handling

OTP is sensitive.

Recommended MVP rule:

- OTP confirmation requires server.
- If network fails, keep delivery in `awaiting_otp`.
- Driver can report OTP network issue.
- Admin may later resolve with audit evidence.

Future option:

- signed offline OTP confirmation,
- short-lived token,
- device-bound confirmation.

Not needed for MVP.

---

# 8. Offline Photo Evidence

Driver should be able to capture evidence offline:

```txt
site_photo
tank_photo
parking_photo
incident_photo
measurement_photo
```

Photo upload can retry later.

Event should store:

```txt
local_file_uri
captured_at
gps_at_capture
upload_status
```

---

# 9. Offline Location

Location pings may fail.

Mobile app should queue last known locations.

Server should treat location as helpful evidence, not absolute truth.

Location can support decisions, but should not replace operational proof.

---

# 10. User Experience Rules

When offline, app should clearly show:

```txt
Offline mode
Actions will sync when connection returns
Completion requires server confirmation
```

Never pretend an action is completed if it is only saved locally.

Use language like:

```txt
Saved locally
Pending sync
Synced
Sync failed
```

---

# 11. MVP Offline Scope

For MVP, keep it simple:

## Must Have

- detect offline state,
- prevent fake completion,
- show network error clearly,
- allow retry,
- keep delivery in safe status.

## Nice To Have

- local incident draft,
- local photo capture,
- queued site intelligence.

## Later

- full offline event queue,
- conflict resolution UI,
- offline OTP design.

---

# 12. Dangerous Offline Mistakes

Avoid:

- completing delivery offline,
- accepting offers offline after expiry,
- confirming payment offline,
- changing payout offline,
- hiding sync failure,
- overwriting server truth with stale device state.

Offline support should reduce chaos, not create fraud.
