# Payment and Payout System

## Purpose

The Payment and Payout System governs:

# how money moves through TankUp.

This includes:

- customer payments,
- platform fees,
- fleet payouts,
- refunds,
- dispute holds,
- operational penalties.

The system must prioritize:

- operational trust,
- payout clarity,
- financial accountability,
- dispute recoverability.

---

# Core Philosophy

TankUp is not merely processing payments.

It is coordinating:

# operational financial trust.

Money movement must reflect:

- operational reality,
- delivery completion,
- verified execution,
- dispute resolution.

---

# Important Operational Insight

Customers are not primarily paying for:

# water itself.

They are paying for:

- diesel,
- tanker movement,
- delivery coordination,
- operational difficulty,
- equipment burden,
- time.

This philosophy affects pricing structure.

---

# Major Financial Actors

## Customer

Pays for delivery service.

---

## Platform

Coordinates operations and earns service fees.

---

## Fleet

Receives operational payout.

---

## Driver

May receive compensation through fleet structure.

---

# Important Operational Reality

Initially,
TankUp should likely pay:

# fleets/fleet heads,
not individual drivers directly.

Reason:

Existing tanker operations already function through:

- fleet ownership,
- operational hierarchy,
- internal commission structures.

Ignoring this reality too early may create:

- payout conflicts,
- operational resistance,
- driver ownership disputes.

---

# Payment Lifecycle

Payments move through operational states.

---

# Payment States

## pending

Payment initiated but not completed.

---

## paid

Payment successfully confirmed.

Request becomes operationally eligible.

---

## held

Funds temporarily restricted due to:

- dispute,
- verification issue,
- operational review.

---

## partially_refunded

Only part of payment returned.

---

## refunded

Customer funds returned fully.

---

## failed

Payment processing unsuccessful.

---

## cancelled

Payment abandoned before completion.

---

# Customer Payment Flow

Customer initiates request
↓
Pricing calculated
↓
Payment generated
↓
Payment confirmed
↓
Request becomes dispatch eligible

---

# Important Rule

Unpaid requests should NOT enter active dispatch.

This prevents:

- operational waste,
- fake demand,
- tanker misuse.

---

# Pricing Structure

Pricing reflects operational economics.

---

# Pricing Components

## Base Water Cost

Estimated water acquisition value.

---

## Logistics Cost

Operational tanker movement cost.

Primarily affected by:

- distance,
- diesel,
- route complexity.

---

## Site Difficulty Cost

Operational burden adjustment.

Examples:

- high tank elevation
- poor accessibility
- difficult terrain

---

## Batch Coordination Fee

Operational coordination cost for grouped deliveries.

---

## Priority Delivery Fee

Premium operational speed cost.

---

## Waiting Penalty

May apply for excessive customer delays.

---

## Platform Service Fee

TankUp operational revenue component.

---

# Dynamic Pricing Future

Future pricing may consider:

- dry season demand,
- tanker scarcity,
- high-demand regions,
- historical operational difficulty,
- rejection frequency,
- site intelligence.

---

# Escrow Philosophy

TankUp should initially behave like:

# operational escrow coordination.

Customer payment should not instantly become fleet payout.

---

# Why Escrow Matters

Escrow protects against:

- fake completion,
- operational disputes,
- customer fraud,
- incomplete delivery claims.

---

# Payout Eligibility

Fleet payout eligibility depends on:

- delivery completion,
- OTP confirmation,
- dispute state,
- operational verification.

---

# Payout Lifecycle

## pending

Awaiting operational completion.

---

## eligible

Ready for payout processing.

---

## processing

Payout initiated.

---

## completed

Funds transferred successfully.

---

## held

Temporarily restricted due to operational review.

---

## reversed

Payout rollback due to severe operational issue.

---

# Payout Timing

The platform should avoid:

# instant irreversible payouts.

A short operational review window improves dispute handling.

---

# Example Review Window

Possible future structure:

- delivery completed
- payout delayed briefly
- dispute window expires
- payout released

---

# Batch Payment Logic

Batch deliveries create shared operational economics.

---

# Important Insight

Batch members are sharing:

- tanker utilization,
- logistics burden,
- operational efficiency.

---

# Batch Payment Rules

Each batch member:

- pays individually,
- receives individual receipts,
- maintains separate dispute rights.

---

# Important Operational Rule

One problematic customer should NOT automatically block:

# entire fleet payout unnecessarily.

Dispute isolation becomes important.

---

# Priority Payment Logic

Priority deliveries optimize for:

- speed,
- certainty,
- dedicated tanker allocation.

---

# Operational Reality

Priority deliveries are:

- easier operationally,
- less coordination-heavy,
- faster to execute.

This justifies premium pricing.

---

# Refund Model

Refund logic must reflect operational reality.

---

# Full Refund Examples

- no tanker dispatched
- operational cancellation before execution
- severe platform failure

---

# Partial Refund Examples

- partial delivery
- operational interruption
- reduced delivered volume

---

# No Refund Examples

Possible future examples:

- customer unavailable after dispatch
- deliberate obstruction
- fake dispute attempts
- Early exit from batch delivery (although there is a warning)

---

# Important Principle

Refunds should balance:

- customer fairness,
- operational cost recovery,
- fleet protection.

---

# Dispute Holds

Disputed deliveries may trigger temporary holds.

---

# Hold Goals

Prevent:

- irreversible payout mistakes,
- fraud exploitation,
- operational injustice.

---

# Operational Penalties

Repeated harmful behavior may trigger penalties.

---

# Customer Penalties

Examples:

- repeated false disputes
- repeated misinformation
- operational obstruction

---

# Driver/Fleet Penalties

Examples:

- fake completion
- operational negligence
- repeated incident frequency

---

# Financial Auditability

Every financial event must generate:

# audit logs.

---

# Audit Examples

- payment creation
- payment confirmation
- payout release
- refund execution
- admin override
- dispute hold

---

# Important Governance Rule

No invisible financial manipulation.

All overrides must remain traceable.

---

# Financial Failure Handling

Failures will happen.

Examples:

- payment gateway downtime
- payout failure
- duplicate transaction attempt
- reconciliation mismatch

---

# Recovery Philosophy

The platform should prioritize:

- consistency,
- recoverability,
- auditability.

Silent corruption is dangerous.

---

# Long-Term Strategic Goal

Over time,
TankUp should evolve into:

# trusted operational financial infrastructure.

Not merely:

- payment buttons,
- transaction tables,
- gateway integrations.

But a coordinated financial trust layer for real-world logistics operations.