# TankUp V2 — Notification Architecture

## Purpose

Notifications coordinate the real-world movement of people, tankers, money, and decisions.

In TankUp, notifications are not just messages.

They are operational signals.

A missed notification can mean:

- missed delivery,
- delayed tanker,
- angry customer,
- unpaid driver/fleet,
- failed dispatch,
- poor trust.

---

# 1. Notification Channels

MVP channels:

```txt
in_app
sms
email
whatsapp_manual
```

Future channels:

```txt
push_notification
automated_whatsapp
voice_call
```

---

# 2. Notification Types

```txt
transactional
operational
alert
escalation
reminder
marketing
```

For MVP, focus only on:

```txt
transactional
operational
alert
escalation
reminder
```

---

# 3. Customer Notifications

## Customer Should Be Notified When

```txt
account_created
site_profile_created
payment_required
payment_confirmed
request_awaiting_dispatch
driver_assigned
driver_loading
driver_en_route
driver_arrived
otp_required
delivery_completed
delivery_failed
dispute_created
dispute_resolved
refund_initiated
refund_completed
```

---

# 4. Driver Notifications

## Driver Should Be Notified When

```txt
offer_received
offer_expiring_soon
offer_cancelled
delivery_assigned
customer_site_warning
loading_required
navigation_started
customer_unavailable_report_required
awaiting_otp
delivery_completed
incident_acknowledged
```

---

# 5. Fleet Head Notifications

## Fleet Head Should Be Notified When

```txt
driver_receives_offer
driver_accepts_offer
driver_rejects_offer
tanker_assigned
tanker_breakdown_reported
delivery_delayed
customer_dispute_created
payout_eligible
payout_held
driver_reliability_warning
```

---

# 6. Admin Notifications

## Admin Should Be Notified When

```txt
paid_request_stuck
no_tanker_available
delivery_failed
dispute_created
critical_incident_created
otp_refusal_reported
customer_aggression_reported
driver_repeated_rejection
payment_refund_required
manual_intervention_required
```

---

# 7. Notification Priority

```txt
low
normal
high
critical
```

Examples:

```txt
payment_confirmed = normal
offer_received = high
otp_required = high
customer_aggression_reported = critical
```

---

# 8. Notification Payload

Every notification should contain:

```txt
id
recipient_type
recipient_id
channel
type
priority
title
message
related_entity_type
related_entity_id
status
created_at
sent_at
read_at
failed_at
retry_count
```

---

# 9. Notification Statuses

```txt
pending
sent
delivered
read
failed
expired
```

---

# 10. Retry Rules

If notification fails:

- retry for high priority messages,
- log failure,
- expose failure to admin where operationally important.

Critical notifications should escalate if not acknowledged.

---

# 11. Acknowledgement Rules

Some notifications only inform.

Others require action.

## Action Required Examples

```txt
driver_offer_received
customer_otp_required
admin_dispute_review_required
fleet_breakdown_response_required
```

## No Action Required Examples

```txt
payment_confirmed
delivery_completed
refund_completed
```

---

# 12. Notification Escalation

Escalation should occur when:

- driver does not respond to offer,
- paid request has no tanker,
- delivery stuck too long,
- OTP not confirmed,
- critical incident submitted.

Current backend alert/notification behavior:

- delivery transition events can create in-app notifications,
- notification recipients are derived from `customerId`, `driverId`, plus global fleet-head/admin recipients,
- duplicate notifications are prevented per source event and recipient key,
- notifications can be listed and marked read through dev routes,
- notification delivery channels beyond `IN_APP` are not implemented.

Current alert scaffolding:

<!-- - Prisma has a `DeliveryAlert` model. -->
- The notification service recognizes `DELIVERY_ALERT_CREATED`.
- The alert detector currently recognizes `LOADING_TOO_LONG`, `EN_ROUTE_TOO_LONG`, `ARRIVED_NOT_MEASURING`, `MEASURING_TOO_LONG`, `AWAITING_OTP_TOO_LONG`, and `REPEATED_OTP_FAILURES`.
- The notification planner currently handles only `LOADING_TOO_LONG`, `EN_ROUTE_TOO_LONG`, and `REPEATED_OTP_FAILURES`.
- Alert notifications are planned for driver, customer, fleet head, and admin depending on alert type.

Current alert detection strategy:

- `POST /dev/deliveries/check-alerts` runs a polling-style detector.
- The detector scans deliveries in `LOADING`, `EN_ROUTE`, `ARRIVED`, `MEASURING`, and `AWAITING_OTP`.
- Duration alerts use the event that entered the current status as the status start time when available.
- Thresholds are currently hard-coded: loading 60 minutes, en route 120 minutes, arrived without measuring 30 minutes, measuring 45 minutes, awaiting OTP 30 minutes, repeated OTP failures 3 attempts.
- New alerts create `DELIVERY_ALERT_CREATED` delivery events and audit logs.
- Duplicate alerts are suppressed by checking for an existing `DELIVERY_ALERT_CREATED` event with the same `alertType`.
- The detector currently emits to the in-process event bus, which only logs events.
- The detector does not currently call notification creation.
- The detector does not currently write rows to the `DeliveryAlert` table.

Example:

```txt
driver_offer_received
→ no response after 60 seconds
→ offer expires
→ fleet/admin notified if repeated
```

---

# 13. MVP Notification Strategy

Do not start with complex push notification infrastructure.

Start with:

1. In-app notification table.
2. SMS for OTP.
3. Email for receipts.
4. Admin dashboard alerts.
5. Manual WhatsApp fallback where needed.

This is enough for MVP.

---

# 14. Future Push Notification Strategy

Later support:

- Expo push notifications for mobile,
- browser push notifications for web,
- notification preference settings,
- sound alerts for drivers,
- escalation notifications for fleet heads.

---

# 15. Notification Anti-Spam Rules

Avoid spamming users with every minor event.

Group or suppress low-value updates.

Notify only when the message changes behavior.

Good notification:

```txt
Driver has arrived. Please prepare to confirm OTP after delivery.
```

Bad notification:

```txt
System updated delivery state from en_route to arrived.
```

Humans do not care about database poetry.
