# TankUp V2 — Audit Logging

## Purpose

Audit logs protect TankUp from confusion, fraud, and invisible manipulation.

If money, delivery proof, status, disputes, or user access changes, TankUp must know:

- who changed it,
- what changed,
- when it changed,
- why it changed,
- what evidence supported it.

Audit logging is not a luxury feature.

It is operational insurance.

---

# 1. Core Rule

No admin override should ever happen silently.

No payment change should ever happen silently.

No dispute resolution should ever happen silently.

No suspension should ever happen silently.

---

# 2. Audit Log Structure

```txt
id
actor_type
actor_id
action
entity_type
entity_id
old_value
new_value
reason
metadata
ip_address
user_agent
created_at
```

---

# 3. Actor Types

```txt
customer
driver
fleet_head
admin
system
payment_provider
```

---

# 4. Entity Types

```txt
user
customer_profile
customer_site_profile
delivery_request
delivery_offer
delivery_record
payment
payout
driver_profile
tanker
fleet
incident
dispute
site_intelligence_report
system_config
```

---

# 5. Required Audit Actions

## Admin Actions

```txt
ADMIN_STATUS_OVERRIDE
ADMIN_PAYMENT_OVERRIDE
ADMIN_REFUND_APPROVED
ADMIN_DISPUTE_RESOLVED
ADMIN_USER_SUSPENDED
ADMIN_DRIVER_SUSPENDED
ADMIN_FLEET_SUSPENDED
ADMIN_TANKER_SUSPENDED
ADMIN_CONFIG_CHANGED
ADMIN_MANUAL_ASSIGNMENT
```

---

## Payment Actions

```txt
PAYMENT_CONFIRMED
PAYMENT_FAILED
PAYMENT_HELD
PAYMENT_REFUNDED
PAYOUT_APPROVED
PAYOUT_HELD
PAYOUT_COMPLETED
PAYOUT_REVERSED
```

---

## Delivery Actions

```txt
DELIVERY_STATUS_CHANGED
DELIVERY_COMPLETED
DELIVERY_FAILED
DELIVERY_DISPUTED
DELIVERY_ADMIN_COMPLETED
```

---

## Site Intelligence Actions

```txt
SITE_PROFILE_UPDATED
SITE_VERIFICATION_SUBMITTED
SITE_VERIFICATION_APPROVED
SITE_RISK_CHANGED
SITE_RESTRICTED
```

---

## Security Actions

```txt
LOGIN_SUCCESS
LOGIN_FAILED
PASSWORD_CHANGED
ROLE_CHANGED
ACCOUNT_SUSPENDED
ACCOUNT_REACTIVATED
```

---

# 6. Admin Override Requirements

Any admin override must include:

```txt
entity_type
entity_id
old_status
new_status
reason
admin_id
timestamp
```

Optional but recommended:

```txt
evidence_url
related_incident_id
related_dispute_id
```

---

# 7. Forbidden Audit Behavior

The system should not allow:

- deleting audit logs,
- editing audit logs,
- completing delivery by changing only status,
- refunding payment without reason,
- resolving dispute without resolution summary.

Audit logs should be append-only.

---

# 8. Audit Severity

```txt
low
medium
high
critical
```

Examples:

```txt
LOGIN_SUCCESS = low
DELIVERY_STATUS_CHANGED = medium
PAYMENT_REFUNDED = high
ADMIN_PAYMENT_OVERRIDE = critical
```

---

# 9. Audit Visibility

## Customer Can See

- payment confirmation,
- delivery status history,
- dispute outcome,
- refund status.

## Driver Can See

- assigned delivery status,
- incident submission,
- completion status,
- payout eligibility where applicable.

## Fleet Head Can See

- fleet delivery status,
- tanker status,
- driver incidents,
- payout status.

## Admin Can See

- all audit logs.

---

# 10. Audit Log Retention

MVP:

- store permanently.

Future:

- archive old logs,
- export audit reports,
- filter by actor/entity/date/severity.

---

# 11. Audit Log Examples

## Admin Override

```json
{
  "actor_type": "admin",
  "action": "ADMIN_STATUS_OVERRIDE",
  "entity_type": "delivery_request",
  "old_value": "awaiting_otp",
  "new_value": "completed",
  "reason": "Customer confirmed via recorded support call after OTP network failure."
}
```

## Payment Refund

```json
{
  "actor_type": "admin",
  "action": "PAYMENT_REFUNDED",
  "entity_type": "payment",
  "old_value": "held",
  "new_value": "refunded",
  "reason": "No tanker available within operational threshold."
}
```

---

# 12. MVP Audit Priorities

Implement audit logs for:

1. Admin overrides.
2. Payment updates.
3. Refunds.
4. Delivery completion.
5. Dispute resolution.
6. User suspension.
7. Site risk changes.

Simple table first.

Fancy dashboards later.
