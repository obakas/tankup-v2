# TankUp V2 — Fraud Prevention

## Purpose

Fraud prevention protects TankUp from fake activity, dishonest reporting, payment abuse, false completion, and operational manipulation.

Fraud in logistics is rarely dramatic.

It usually appears as small repeated lies.

TankUp must detect patterns early.

---

# 1. Fraud Domains

```txt
customer_fraud
driver_fraud
fleet_fraud
payment_fraud
site_fraud
delivery_fraud
dispute_fraud
platform_abuse
```

---

# 2. Customer Fraud Risks

## Examples

- lying about tank height,
- hiding poor site access,
- claiming delivery was incomplete after receiving water,
- refusing OTP after delivery,
- using wrong address,
- repeated refund claims,
- aggressive behavior to avoid payment.

## Signals

```txt
repeated_site_mismatch
otp_refusal_count
dispute_frequency
refund_frequency
driver_incident_reports
high_risk_site_reports
```

## Response

- reduce customer trust score,
- require site verification,
- mark site high risk,
- require admin review,
- restrict account if severe.

---

# 3. Driver Fraud Risks

## Examples

- claiming arrival without being at site,
- claiming delivery without OTP,
- inflating difficulty reports,
- false incident reports,
- colluding with customer,
- avoiding normal jobs,
- hiding tanker breakdown.

## Signals

```txt
gps_mismatch
repeated_customer_complaints
otp_conflict
high_incident_frequency
unusual_rejection_pattern
fast_completion_pattern
```

## Response

- reduce driver reliability score,
- require fleet head review,
- suspend from priority jobs,
- admin investigation.

---

# 4. Fleet Fraud Risks

## Examples

- assigning poor tankers,
- forcing false completion,
- hiding driver misconduct,
- manipulating payout claims,
- using unavailable tankers.

## Signals

```txt
fleet_dispute_rate
fleet_breakdown_rate
fleet_otp_conflict_rate
fleet_late_delivery_rate
fleet_customer_complaint_rate
```

## Response

- payout hold,
- fleet warning,
- fleet restriction,
- admin review,
- suspension.

---

# 5. Payment Fraud Risks

## Examples

- fake payment reference,
- duplicate payment reference,
- chargeback abuse,
- refund manipulation,
- manual payment claim without confirmation.

## Rules

- never trust frontend payment success alone,
- verify payment server-side,
- payment reference must be unique,
- refund requires audit log,
- payout requires delivery completion.

---

# 6. Site Fraud Risks

## Examples

- customer registers easy site but actual site is difficult,
- old site data becomes outdated,
- customer uses same site under different account,
- fake photos submitted.

## Response

- driver verification,
- site confidence score,
- photo evidence,
- admin review for repeated mismatch.

---

# 7. Delivery Fraud Risks

## Examples

- delivery completed without actual delivery,
- quantity exaggerated,
- OTP shared before delivery,
- driver/customer collusion,
- false partial delivery.

## Prevention

Delivery completion requires:

```txt
arrival
measurement
otp
event trail
```

OTP alone is not enough.

---

# 8. Trust Scores

TankUp may maintain trust scores for:

```txt
customer_trust_score
site_confidence_score
driver_reliability_score
fleet_reliability_score
```

Do not over-automate punishments in MVP.

Use scores first as admin decision support.

---

# 9. Fraud Severity

```txt
low
medium
high
critical
```

Examples:

```txt
one site mismatch = low
repeated OTP refusal = medium
fake delivery claim = high
payment manipulation = critical
```

---

# 10. Fraud Event Types

```txt
POSSIBLE_SITE_MISREPRESENTATION
REPEATED_OTP_REFUSAL
SUSPICIOUS_REFUND_PATTERN
DRIVER_LOCATION_MISMATCH
FALSE_COMPLETION_ATTEMPT
PAYMENT_REFERENCE_REUSE
FLEET_BREAKDOWN_PATTERN
CUSTOMER_AGGRESSION_PATTERN
```

---

# 11. MVP Fraud Prevention Rules

For MVP, enforce these:

1. Payment must be verified server-side.
2. OTP required before completion.
3. Measurement required before OTP.
4. Driver cannot complete delivery alone .
5. Admin override requires audit reason.
6. Repeated disputes are visible to admin.
7. Site mismatch is recorded.
8. Refunds require admin/audit trail.
9. Payout only after successful completion.
10. Duplicate payment reference rejected.

---

# 12. What Not To Build Yet

Do not build full AI fraud detection yet.

Do not build automatic bans too early.

Do not over-punish based on one incident.

Collect data first.

Pattern beats assumption.

Reality beats ego.
