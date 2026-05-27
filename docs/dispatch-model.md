# Dispatch Model

## Purpose

The Dispatch System is the operational engine of TankUp.

Its responsibility is to:

- assign the right tanker,
- to the right delivery,
- at the right time,
- with the lowest operational risk,
- and highest operational efficiency.

Dispatch is NOT merely:

# “finding the nearest driver.”

TankUp dispatch must consider:

- operational difficulty,
- tanker capability,
- diesel economics,
- delivery risk,
- site intelligence,
- batching efficiency,
- driver reliability.

---

# Core Philosophy

TankUp dispatch is:

# operational coordination,
not gig matching.

The objective is NOT only speed.

The objective is:

- predictability,
- operational success,
- reduced equipment stress,
- reduced failed deliveries,
- improved fleet efficiency.

---

# Dispatch Types

TankUp supports two primary dispatch models.

---

# Batch Dispatch

Multiple customers share tanker utilization.

---

## Goals

- maximize tanker efficiency,
- reduce diesel waste,
- improve route grouping,
- lower customer pricing,
- increase tanker utilization.

---

## Characteristics

- slower than priority,
- operationally efficient,
- requires geographic coordination,
- depends on batch formation logic.

---

# Priority Dispatch

Single customer receives dedicated tanker allocation.

---

## Goals

- faster fulfillment,
- operational certainty,
- direct assignment flow.

---

## Characteristics

- more expensive,
- less efficient operationally,
- simpler dispatch flow.

---

# Dispatch Lifecycle

Every dispatch moves through operational stages.

---

# Stage 1 — Request Eligibility

Before dispatch begins,
the system validates:

- payment status,
- customer trust,
- site verification,
- tanker availability,
- operational restrictions.

---

## Invalid Requests

Requests may be blocked due to:

- unpaid status,
- restricted customer,
- dangerous site,
- operational suspension,
- unresolved dispute history.

---

# Stage 2 — Candidate Selection

The system identifies candidate tankers.

---

# Candidate Inputs

Selection considers:

- tanker availability,
- current location,
- tanker capacity,
- tanker capability,
- fleet operational status,
- site risk compatibility.

---

# Important Realization

Not every tanker should handle every site.

Example:

A high-elevation tank site may require:

- stronger pumping capability,
- experienced operators,
- better hose setup.

---

# Stage 3 — Dispatch Scoring

Candidate tankers receive operational scores.

---

# Dispatch Score Factors

## Proximity Score

Closer tankers reduce:

- diesel usage,
- delivery delay.

---

## Reliability Score

Reliable drivers and fleets receive preference.

---

## Site Compatibility Score

Some tankers/drivers perform better on difficult sites.

---

## Risk Compatibility Score

High-risk sites may require:

- experienced drivers,
- high-trust fleets.

---

## Efficiency Score

Batching efficiency affects dispatch value.

---

## Fairness Score

Platform should avoid starving certain fleets indefinitely.

---

# Dispatch Priorities

TankUp balances:

- speed,
- efficiency,
- fairness,
- operational safety.

This balance changes depending on:

- batch vs priority,
- demand intensity,
- tanker scarcity,
- seasonal pressure.

---

# Offer Lifecycle

Assignments should NOT immediately become active jobs.

Instead:

# dispatch uses offer-based coordination.

---

# Offer States

## generated

Offer created by dispatch engine.

---

## sent

Offer delivered to fleet/driver.

---

## viewed

Offer acknowledged.

---

## accepted

Offer confirmed.

Assignment becomes active.

---

## rejected

Offer declined.

Reason should be recorded.

---

## expired

Offer timed out.

Dispatch retries another candidate.

---

# Important Operational Rule

A tanker should NOT receive multiple conflicting offers simultaneously.

This prevents:

- operational confusion,
- double assignment,
- fleet manipulation.

---

# Rejection Handling

Driver rejection is operational intelligence.

Rejections should NOT be ignored.

---

# Rejection Examples

- site difficulty too high
- tanker incompatible
- road inaccessible
- operational overload
- safety concerns
- mechanical issue

---

# Important Insight

Repeated rejection patterns reveal:

- problematic sites,
- unrealistic pricing,
- operational inefficiency.

Rejection data becomes dispatch intelligence.

---

# Retry Logic

Dispatch must recover from failed offers automatically.

---

# Retry Flow

Offer rejected or expired
↓
Dispatch reevaluates candidates
↓
Risk and availability recalculated
↓
New offer generated

---

# Retry Limits

Infinite retries create operational chaos.

The system should define:

- retry thresholds,
- escalation triggers,
- admin intervention points.

---

# Escalation Logic

Some deliveries may require human coordination.

---

# Escalation Examples

- multiple rejection chains
- repeated assignment failures
- severe operational risk
- dangerous delivery conditions

---

# Escalation Targets

Escalations may involve:

- fleet heads,
- operations admins,
- manual dispatch review.

---

# Batch Dispatch Logic

Batch dispatch is fundamentally different from priority dispatch.

---

# Batch Formation Inputs

Batching considers:

- geographic proximity,
- delivery timing,
- tanker capacity,
- operational compatibility,
- route efficiency.

---

# Important Insight

Bad batching destroys operational trust.

Example:

A low-risk customer should not always suffer because a nearby customer has:

- severe accessibility problems,
- excessive delays,
- dangerous terrain.

---

# Batch Health Model

Each batch receives a health score.

---

# Batch Health Factors

- fill ratio
- geographic compactness
- operational compatibility
- average site difficulty
- waiting duration
- tanker suitability

---

# Batch Expiration

Some batches should expire instead of forcing bad operational decisions.

---

# Expiration Examples

- insufficient participation
- excessive waiting duration
- poor route compatibility

---

# Priority Dispatch Logic

Priority requests optimize for:

- speed,
- operational certainty.

---

# Priority Assignment Goals

- rapid tanker allocation
- minimal coordination delay
- reduced customer waiting

---

# Important Operational Reality

Priority deliveries are operationally easier.

Batch deliveries are operationally more complex.

This should influence:

- pricing,
- dispatch expectations,
- operational rules.

---

# Driver Reliability Model

Dispatch should remember operational behavior.

---

# Positive Signals

- fast acceptance
- successful completion
- low dispute frequency
- punctuality
- accurate reporting

---

# Negative Signals

- repeated no-response
- fake availability
- excessive rejection
- delayed updates
- incident frequency

---

# Fleet Reliability Model

Fleet operational quality affects dispatch trust.

---

# Fleet Signals

- tanker readiness
- coordination quality
- dispute frequency
- successful completion rate
- payout stability

---

# Site Intelligence Integration

Dispatch heavily depends on site intelligence.

---

# Example

A verified difficult site may require:

- experienced fleet,
- stronger tanker,
- higher payout incentive.

---

# Tanker Capability Matching

Future dispatch may classify tanker capabilities.

---

# Example Capability Categories

- standard pumping
- high-pressure capable
- long-hose compatible
- difficult terrain compatible

---

# Time-Based Dispatch Pressure

Operational pressure changes throughout the day.

---

# Examples

Peak demand periods may increase:

- pricing,
- assignment urgency,
- dispatch tolerance thresholds.

---

# Dispatch Failure States

Dispatch may fail due to:

- no available tanker
- repeated rejection chains
- high-risk operational conditions
- insufficient tanker capability

---

# Failure Recovery

Failed dispatches may:

- retry later,
- escalate manually,
- notify customer,
- suggest priority upgrade.

---

# Long-Term Strategic Goal

Over time,
TankUp dispatch should evolve into:

# predictive operational coordination.

The platform should gradually learn:

- which fleets succeed in which environments,
- which sites cause operational pain,
- which deliveries are likely to fail,
- which dispatch decisions maximize efficiency.

That intelligence becomes:

# the operational core of the business.