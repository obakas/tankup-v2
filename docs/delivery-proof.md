# Delivery Proof System

## Purpose

The Delivery Proof System exists to establish:

# operational truth.

The platform must reliably determine:

- whether delivery occurred,
- whether water quantity was reasonable,
- whether the driver truly arrived,
- whether the customer acknowledged completion,
- whether operational incidents occurred.

Delivery proof protects:

- customers,
- drivers,
- fleets,
- platform integrity.

---

# Core Philosophy

OTP alone is NOT sufficient proof.

Photos alone are NOT sufficient proof.

Driver updates alone are NOT sufficient proof.

Delivery proof must become:

- layered,
- auditable,
- recoverable,
- difficult to manipulate.

---

# Major Operational Reality

Disputes will happen.

Customers may claim:

- water not enough,
- delivery incomplete,
- driver misconduct.

Drivers may claim:

- customer delayed OTP,
- accessibility problems,
- customer aggression,
- delivery completed successfully.

The system must preserve enough operational evidence to investigate fairly.

---

# DeliveryRecord Entity

Every delivery creates a:

# DeliveryRecord

This becomes the official operational execution history.

---

# DeliveryRecord Responsibilities

The record stores:

- delivery progress,
- timestamps,
- operational evidence,
- OTP verification,
- measurement records,
- incident reports,
- verification media.

---

# Delivery Lifecycle

Delivery proof follows operational stages.

---

# Stage 1 — Assignment Confirmation

Driver/fleet accepts delivery assignment.

System records:

- assigned tanker,
- assigned driver,
- assignment timestamp.

---

# Stage 2 — Loading Confirmation

Driver confirms tanker loading.

---

# Loading Evidence

May include:

- loading timestamp,
- loading location,
- optional loading photo,
- estimated tanker volume.

---

# Important Operational Insight

Fake loading claims create operational confusion.

Loading confirmation improves dispatch visibility.

---

# Stage 3 — Navigation Tracking

Driver begins movement toward customer site.

---

# Navigation Data

System may store:

- departure timestamp,
- GPS heartbeat future,
- estimated arrival progress.

---

# Important Philosophy

TankUp should NOT initially over-engineer live tracking.

Operational reliability matters more than flashy maps.

---

# Stage 4 — Arrival Confirmation

Driver confirms arrival at customer location.

---

# Arrival Verification

May include:

- arrival timestamp,
- GPS verification,
- arrival photo optional,
- customer acknowledgment optional.

---

# Important Operational Insight

Arrival is NOT delivery.

Many logistics systems incorrectly combine both.

TankUp separates them operationally.

---

# Stage 5 — Measurement Process

Delivery enters measurement phase.

---

# Measurement Goals

The platform should establish reasonable evidence that water transfer occurred.

---

# Measurement Inputs

## Manual Inputs

- estimated delivered volume
- pumping duration
- tank fill observations

---

## Future Meter Inputs

Future hardware integration may include:

- digital flow meters,
- smart pumping systems.

---

# Important Operational Reality

Precise volume verification may not initially be possible operationally.

The MVP should prioritize:

# reasonable operational evidence,
not impossible perfection.

---

# Stage 6 — Site Verification

Drivers may verify operational site conditions.

---

# Site Verification Inputs

Drivers may submit:

- actual tank height,
- hose distance,
- accessibility difficulty,
- operational observations.

---

# Important Insight

Delivery proof also strengthens:

# Site Intelligence.

---

# Stage 7 — OTP Verification

Customer confirms delivery completion.

---

# OTP Philosophy

OTP confirms:

# customer acknowledgment,
not scientific measurement certainty.

---

# OTP Rules

Current backend OTP generation is allowed only while delivery status is:

```txt
ASSIGNED
```

Current backend OTP verification is allowed only while delivery status is:

```txt
AWAITING_OTP
```

The generated OTP is:

- 4 digits,
- valid for 90 minutes,
- stored on the delivery record while pending,
- reset when a new OTP is generated.

When OTP is generated, the backend records:

- `DELIVERY_OTP_GENERATED` delivery event,
- matching audit log,
- expiry timestamp metadata.

When OTP verification succeeds, the backend:

- clears `otpCode`,
- clears `otpExpiresAt`,
- sets `otpVerifiedAt`,
- stores `otpVerifiedByActorType`,
- stores `otpVerifiedByActorId` when supplied,
- records `DELIVERY_OTP_VERIFIED`,
- writes a matching audit log.

When OTP verification fails because the code is invalid or expired, the backend:

- increments `otpAttemptCount`,
- records `DELIVERY_OTP_FAILED`,
- writes a matching audit log,
- returns a domain error.

Current completion rule:

```txt
AWAITING_OTP → COMPLETED
```

is accepted only after `otpVerifiedAt` exists.

---

# Important Operational Rule

Drivers should NOT complete deliveries without OTP,
except under specific recovery workflows.

Current backend reality:

- no driver-only completion exists,
- no admin completion override exists yet,
- OTP verification does not automatically transition the delivery to `COMPLETED`; completion still uses the transition endpoint afterward.

---

# Stage 8 — Completion

Delivery enters completed state.

---

# Completion Conditions

System validates:

- assignment exists,
- arrival recorded,
- measurement recorded,
- OTP verified,
- no unresolved blocking incident.

---

# Evidence Types

TankUp may support multiple evidence layers.

---

# Photo Evidence

Examples:

- tanker at site
- hose connection
- tank environment
- difficult accessibility

---

# Video Evidence Future

Optional future support for:

- pumping process clips
- incident recording

---

# Timestamp Evidence

System stores:

- assignment time
- loading time
- arrival time
- OTP completion time
- completion duration

---

# Operational Metadata

Examples:

- delivery duration
- waiting duration
- pumping duration
- retry attempts

---

# Incident Evidence

Drivers and customers may submit:

- photos
- descriptions
- operational complaints

---

# Failed Delivery Handling

Not all deliveries complete successfully.

The system must model failure honestly.

---

# Failed Delivery Examples

- inaccessible compound
- customer unavailable
- tanker breakdown
- severe pumping issue
- unsafe environment
- payment dispute escalation

---

# Failed Delivery Rules

Failures should preserve:

- operational evidence,
- timestamps,
- incident details,
- responsible parties.

---

# Partial Delivery Handling

Some deliveries may partially succeed.

---

# Examples

- tanker runs out early
- pumping interruption
- customer stops process midway
- equipment failure during pumping

---

# Partial Delivery Requirements

The system should capture:

- estimated delivered quantity,
- interruption reason,
- evidence,
- compensation implications.

---

# Offline Recovery Handling

Real operations may experience:

- poor network,
- temporary offline execution.

---

# Offline Philosophy

The platform must tolerate temporary operational disconnection.

---

# Offline Recovery Examples

- delayed OTP synchronization
- delayed photo upload
- delayed arrival confirmation

---

# Important Operational Rule

Offline recovery must NOT allow:

- duplicate completion,
- fake backdated progress,
- inconsistent delivery states.

---

# Delivery State Integrity

Operational states must remain sequential.

---

# Forbidden Examples

A delivery should NOT:

- complete before arrival,
- verify OTP before measurement,
- skip operational stages arbitrarily.

---

# Delivery Audit Trail

Every major delivery action should create:

# immutable operational logs.

---

# Audit Examples

- status changes
- OTP verification
- incident submissions
- admin overrides
- dispute resolutions

---

# Admin Override Rules

Admins may intervene operationally.

Examples:

- manual completion
- dispute-based reversal
- incident escalation

---

# Important Governance Rule

All admin overrides must generate:

# audit records.

No invisible operational manipulation.

---

# Customer Protection

Delivery proof protects customers from:

- fake completion,
- incomplete delivery,
- operational negligence.

---

# Driver Protection

Delivery proof protects drivers from:

- fake dispute claims,
- false non-delivery accusations,
- customer manipulation.

---

# Fleet Protection

Delivery proof protects fleets from:

- payout disputes,
- operational misinformation,
- fake escalation claims.

---

# Long-Term Strategic Goal

Over time,
TankUp should become capable of generating:

# high-confidence operational truth.

Not merely:

- status buttons,
- delivery claims,
- screenshots.

But structured operational evidence.

That operational trust layer becomes:

# one of the strongest infrastructure advantages of the platform.
