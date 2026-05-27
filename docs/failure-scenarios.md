# TankUp V2 — Failure Scenarios

## Purpose

This document defines real-world failure cases TankUp must expect.

A logistics system that only handles the happy path is not a logistics system. It is theatre.

TankUp must be designed for:

- lies,
- delays,
- bad roads,
- weak networks,
- tanker breakdowns,
- customer disputes,
- driver avoidance,
- hidden operational difficulty,
- payment fear,
- human pressure.

The system should not panic when reality happens.

---

# 1. Customer Lies About Tank Height

## Scenario

Customer reports tank as ground floor or easy access, but driver arrives and discovers:

- tank is high,
- hose distance is long,
- pump strain is high,
- parking is difficult.

## Risk

- driver rejects delivery,
- pump damage,
- delivery delay,
- pricing dispute,
- driver distrusts platform.

## System Response

Driver submits site intelligence update:

```txt
reported_tank_height
actual_tank_height
hose_distance
parking_difficulty
pump_strain_level
photo_evidence
driver_comment
```

## Operational Effect

- delivery may continue with difficulty warning,
- extra charge may apply in future,
- site risk score increases,
- customer trust score decreases if repeated.

## MVP Rule

For MVP, do not automatically charge extra at arrival.

Instead:

- record mismatch,
- flag site as partially verified/high risk,
- use data for future pricing and dispatch.

---

# 2. Customer Refuses OTP After Delivery

## Scenario

Driver delivers water but customer refuses to provide OTP.

## Possible Causes

- customer claims volume is incomplete,
- customer wants refund,
- customer is dishonest,
- measurement disagreement,
- customer is absent,
- network issue.

## System Response

Driver opens incident:

```txt
incident_type: OTP_REFUSAL
delivery_stage: awaiting_otp
evidence: photo/video/comment
delivered_quantity
```

## Operational Effect

- delivery moves to disputed,
- payout is held,
- admin review required,
- customer receives notification.

## MVP Rule

No OTP, no automatic completion.

Admin can complete manually only with evidence.

---

# 3. Driver Claims Completion Without Proof

## Scenario

Driver says delivery is complete but customer did not confirm OTP.

## Risk

- fake completion,
- payout fraud,
- customer complaint,
- platform trust damage.

## System Response

System rejects completion.

Required proof:

- measurement completed,
- OTP confirmed,
- or admin override with evidence.

## MVP Rule

Driver cannot mark delivery completed alone.

---

# 4. Tanker Breaks Down During Loading

## Scenario

Tanker is assigned but fails before leaving loading point.

## System Response

Driver or fleet head reports incident:

```txt
incident_type: TANKER_BREAKDOWN
stage: loading
```

## Operational Effect

- delivery request returns to awaiting_dispatch,
- offer/delivery record marked failed,
- tanker moves to maintenance,
- customer notified of delay,
- dispatch retry starts.

## Financial Effect

- payment remains held,
- no payout eligibility.

---

# 5. Tanker Breaks Down En Route

## Scenario

Tanker leaves loading point but breaks down before reaching customer.

## System Response

Driver reports incident with:

- location,
- reason,
- estimated recovery time,
- photo if available.

## Operational Effect

Admin or fleet head decides:

```txt
reassign
wait
cancel
refund
```

## MVP Rule

Do not auto-refund immediately.

Some breakdowns may be resolved quickly.

---

# 6. Customer Site Is Inaccessible

## Scenario

Driver arrives but cannot access the delivery point due to:

- blocked road,
- narrow street,
- bad terrain,
- security restriction,
- no parking space,
- long hose distance.

## System Response

Driver submits incident:

```txt
incident_type: SITE_INACCESSIBLE
access_reason
photo
driver_comment
```

## Operational Effect

- delivery becomes disputed or failed,
- site profile updated,
- future dispatch avoids unsuitable tankers,
- customer may be asked to update site details.

---

# 7. Customer Is Not Available

## Scenario

Driver arrives but customer cannot be reached.

## System Response

Driver marks:

```txt
arrival_confirmed
customer_unavailable
call_attempts
waiting_started_at
```

## Rules

After waiting threshold:

- delivery may move to failed/disputed,
- waiting fee may apply later,
- admin/fleet head notified.

## MVP Rule

Record the failure first.

Penalties can come later after operational confidence improves.

Another delivery request will be assigned to the tanker if there is a request within the tanker proximity - since the tanker is already loaded

---

# 8. Driver Rejects Difficult Site

## Scenario

Driver sees site risk and rejects offer.

## System Response

Rejection reason required:

```txt
too_far
bad_road
high_tank
low_price
unsafe_area
pump_risk
other
```

## Operational Effect

- request returns to awaiting_dispatch,
- another tanker is searched,
- rejection contributes to dispatch learning.
- Another delivery request will be assigned to the tanker if there is a request within the tanker's proximity - since the tanker is already loaded

## Important Rule

Not all rejection is bad behavior.

Some rejection is operational intelligence.

---

# 9. Driver Repeatedly Rejects Normal Jobs

## Scenario

Driver rejects many reasonable offers.

## System Response

System tracks:

- rejection count,
- expiry count,
- accepted/completed ratio,
- reason patterns.

## Operational Effect

- reliability score decreases,
- driver receives fewer priority jobs,
- fleet head may be notified.

---

# 10. Fleet Head Pressures Driver Into False Completion

## Scenario

Fleet head wants payout quickly and pressures driver/customer to complete falsely.

## System Response

System prevents completion without OTP or admin override.

## Audit Signal

Suspicious pattern:

- same fleet has repeated OTP disputes,
- repeated quick completions,
- repeated customer complaints.

## MVP Rule

Track suspicious patterns manually first.

Automated fraud scoring can come later.

---

# 11. Payment Succeeds But No Tanker Is Available

## Scenario

Customer pays, but system cannot find available tanker.

## System Response

Request stays in awaiting_dispatch.

After threshold:

- notify admin,
- notify customer,
- allow refund or retry.

## MVP Rule

Admin should see stuck paid requests clearly.

---

# 12. Partial Delivery

## Scenario

Driver delivers less than expected quantity.

## Possible Causes

- tanker underloaded,
- leakage,
- wrong tanker volume,
- pump issue,
- customer tank capacity mismatch.

## System Response

Driver records:

```txt
expected_quantity
delivered_quantity
reason
evidence
```

## Operational Effect

- delivery may become disputed,
- partial completion may be allowed later,
- payout may be adjusted.

## MVP Rule

Avoid complex partial payout initially.

Flag for admin review.

---

# 13. Customer Claims Water Was Not Enough

## Scenario

Customer says delivered water quantity is less than paid amount.

## System Response

Open delivery quantity dispute.

Evidence may include:

- driver measurement,
- customer photo,
- tanker record,
- site history,
- previous complaints.

## Operational Effect

- customer trust score may change,
- site risk may change,
- driver reliability may change.

---

# 14. Network Failure During OTP

## Scenario

Customer is ready to confirm OTP but network fails.

## System Response

Mobile/web should allow:

- retry,
- save pending confirmation locally,
- mark delivery as awaiting_otp.

## MVP Rule

Do not complete until server receives confirmation.

Offline proof may be added later.

---

# 15. Driver Phone Battery Dies

## Scenario

Driver cannot update delivery stage.

## System Response

Fleet head/admin may intervene.

## Rule

Manual status changes require audit.

## Future Improvement

Driver app should support offline event queue.

---

# 16. Wrong Customer Location

## Scenario

Customer address/location is incorrect.

## System Response

Driver reports:

```txt
incident_type: WRONG_LOCATION
actual_location
customer_response
```

## Operational Effect

- delivery delayed,
- site profile flagged,
- future verification required.

---

# 17. Customer Aggression Or Safety Issue

## Scenario

Driver reports unsafe behavior.

## System Response

Incident is escalated.

Possible actions:

- delivery stopped,
- customer restricted,
- site marked high risk,
- admin review.

## Rule

Safety beats delivery completion.

---

# 18. MVP Failure Handling Priorities

For MVP, build failure handling for:

1. Customer unavailable.
2. Site inaccessible.
3. Tank height mismatch.
4. OTP refusal.
5. Tanker breakdown.
6. Payment made but no tanker assigned.
7. Driver rejection.
8. Partial delivery.
9. Network failure during OTP.
10. Dispute creation.

Do not overbuild penalties early.

First collect operational truth.
