# MVP Scope

## Purpose

The MVP Scope defines:

# what TankUp V2 will intentionally build,
and what it will intentionally ignore.

This document protects the platform from:

- feature explosion,
- architectural confusion,
- premature optimization,
- founder distraction.

---

# Core Philosophy

The purpose of the MVP is NOT to build:

- the biggest platform,
- the smartest platform,
- the most beautiful platform.

The purpose is to validate:

# operational coordination viability.

TankUp V2 MVP exists to answer:

- Can tanker operations be coordinated digitally?
- Can dispatch become more predictable?
- Can site intelligence reduce delivery uncertainty?
- Can fleets operationally trust the system?
- Can customers trust delivery execution?

---

# MVP Success Definition

The MVP succeeds if it proves:

- repeatable operational execution,
- dispatch coordination reliability,
- real-world delivery completion,
- operational trust growth,
- usable site intelligence collection.

NOT vanity metrics.

---

# Primary MVP Goals

---

# Goal 1 — Operational Delivery Coordination

The platform must successfully coordinate:

- customer requests,
- tanker assignment,
- delivery execution,
- completion verification.

---

# Goal 2 — Site Intelligence Collection

The platform must begin learning:

- accessibility difficulty,
- tank elevation reality,
- operational risk patterns,
- customer operational behavior.

This is one of the most important strategic goals.

---

# Goal 3 — Delivery Proof Reliability

The platform must generate:

- believable operational records,
- auditable delivery history,
- dispute-supporting evidence.

---

# Goal 4 — Fleet Operational Adoption

Fleet heads and drivers must find the platform:

- operationally usable,
- trustworthy,
- not disruptive to existing workflows.

---

# Goal 5 — Financial Coordination

The platform must reliably handle:

- customer payment,
- fleet payout coordination,
- dispute holds,
- refund handling.

---

# MVP Features — Customer

---

# Included

## Customer Registration

Customers create operational identity.

---

## Site Registration

Customers register delivery locations.

---

## Delivery Request Creation

Customers request:

- batch delivery
- priority delivery

---

## Payment

Customers complete delivery payment before dispatch.

---

## Delivery Tracking Basic

Customers see:

- assignment status
- delivery progress
- completion state

---

## OTP Confirmation

Customers acknowledge operational completion.

---

## Dispute Submission

Customers may report operational issues.

---

# Excluded Initially

## Real-Time Live Maps

Not required initially.

Operational reliability matters more.

---

## AI Recommendations

Premature.

---

## Dynamic Route Optimization

Manual operational coordination acceptable initially.

---

## Advanced Analytics Dashboards

Operational execution first.

---

# MVP Features — Driver

---

# Included

## Availability Declaration

Drivers indicate operational readiness.

---

## Offer Acceptance/Rejection

Drivers respond to assignments.

---

## Delivery Progress Updates

Drivers update:

- loading
- en route
- arrived
- measuring
- completed

---

## Site Intelligence Submission

Drivers verify:

- tank height
- accessibility
- operational difficulty

---

## Incident Reporting

Drivers report operational problems.

---

# Excluded Initially

## Continuous GPS Tracking

May create complexity too early.

---

## Automated Route Navigation

Drivers may use external navigation apps initially.

---

## Hardware Meter Integration

Future phase.

---

# MVP Features — Fleet Head

---

# Included

## Driver Supervision

Fleet heads coordinate operational personnel.

---

## Tanker Visibility

Fleet heads view tanker activity.

---

## Assignment Coordination

Fleet heads participate in operational execution.

---

## Dispute Participation

Fleet heads may assist operational clarification.

---

# Excluded Initially

## Advanced Fleet Analytics

Not operationally necessary initially.

---

## Multi-Branch Fleet Structures

Premature complexity.

---

# MVP Features — Admin

---

# Included

## Operational Oversight

Admins monitor system operations.

---

## Dispute Resolution

Admins investigate operational conflict.

---

## Manual Intervention

Admins may override operational deadlocks.

---

## User/Fleet Restriction

Admins may suspend harmful actors.

---

## Pricing Configuration

Admins configure operational pricing rules.

---

# Excluded Initially

## AI Fraud Detection

Premature.

---

## Automated Compliance Systems

Future operational maturity layer.

---

# Payment Scope

---

# Included

## Customer Payment

Operational payment confirmation.

---

## Fleet Payout Coordination

Payout release after operational completion.

---

## Refund Handling

Basic refund workflow.

---

## Payout Hold Logic

Dispute-sensitive payout protection.

---

# Excluded Initially

## Multi-Currency Support

Not necessary for MVP.

---

## Wallet Systems

Premature.

---

## Subscription Billing

Not core to operational validation (could be in the future).

---

# Dispatch Scope

---

# Included

## Basic Dispatch Engine

Operational assignment coordination.

---

## Offer Lifecycle

Offer generation and acceptance flow.

---

## Rejection Handling

Retry and escalation logic.

---

## Batch Coordination

Basic grouped delivery logic.

---

# Excluded Initially

## Machine Learning Dispatch

Premature optimization.

---

## Predictive Optimization Engines

Operational data does not yet exist.

---

## Complex Auto-Routing

Operational simplicity preferred initially.

---

# Site Intelligence Scope

---

# Included

## Site Verification

Drivers confirm operational reality.

---

## Risk Scoring Basic

Sites receive operational difficulty classification.

---

## Historical Site Memory

Platform remembers operational behavior.

---

# Excluded Initially

## Computer Vision Analysis

Premature.

---

## Automated Terrain Analysis

Operational overengineering.

---

# Delivery Proof Scope

---

# Included

## OTP Verification

Customer acknowledgment.

---

## Timestamp Tracking

Operational auditability.

---

## Photo Evidence Optional

Operational support evidence.

---

## Incident Logging

Operational problem recording.

---

# Current Backend Implementation Snapshot

The backend currently implements only the early operational delivery core:

- `Delivery`
- `DeliveryEvent`
- `AuditLog`
- `DeliveryAlert` schema
- `Notification` schema and basic in-app notification records
- delivery status transition service
- delivery OTP generation and verification
- delivery timeline read model
- dev-only delivery routes

Current lifecycle:

```txt
CREATED → ASSIGNED → LOADING → EN_ROUTE → ARRIVED → MEASURING → AWAITING_OTP → COMPLETED
```

Current terminal states:

```txt
COMPLETED
FAILED
SKIPPED
```

Current intentional gaps:

- no customer request creation workflow,
- no payment provider integration,
- no dispatch engine or offer lifecycle,
- no real driver/fleet/customer account model,
- no site intelligence submission workflow,
- no dispute workflow,
- no incident workflow,
- no payout workflow,
- no admin override completion flow,
- no automatic transition after OTP verification,
- no SMS/email/WhatsApp sending,
- no production notification delivery,
- no live GPS tracking,
- no hardware meter integration,
- no automatic scheduled alert runner,
- no persisted `DeliveryAlert` row writes from the current detector,
- no alert-created notification fanout from the current detector.

---

# Excluded Initially

## Smart Meter Hardware

Future phase.

---

## Continuous Video Verification

Operationally unrealistic initially.

---

# Mobile Scope

---

# Included

## Driver Operational Usage

Mobile-first driver workflow.

---

## Customer Basic Usage

Request and tracking functionality.

---

# Important Insight

Drivers are more operationally mobile-dependent than customers.

Mobile driver experience is critical.

---

# Technology Scope

---

# Frontend

- React
- Vite
- TypeScript
- TailwindCSS

---

# Backend

<!-- - Node.js
- Express or NestJS
- PostgreSQL
- Prisma -->
- FastApi
- SQLAlchemy
- PostgreSQL
- Alembic

---

# Mobile

- React Native Expo

---

# Infrastructure

- Supabase/Postgres
- Cloudinary
- Render/Railway/Fly.io

---

# Explicit Non-Goals

TankUp V2 MVP is NOT trying to become:

- Uber,
- Bolt,
- SAP,
- Oracle Logistics,
- AI dispatch company,
- smart city infrastructure.

Not yet.

---

# Most Important Operational Principle

The MVP should optimize for:

# operational truth,
not technological impressiveness.

---

# MVP Launch Philosophy

The first real launch should likely be:

- geographically limited,
- operationally supervised,
- manually supported.

---

# Important Operational Insight

Early-stage logistics operations require:

- human coordination,
- operational flexibility,
- manual intervention.

Pretending everything can be automated early is dangerous.

---

# What Success Looks Like

Success is NOT:

- thousands of users,
- fancy dashboards,
- investor hype.

Success is:

- deliveries completing reliably,
- fleets returning,
- customers trusting execution,
- operational data becoming richer,
- site intelligence improving dispatch quality.

That is the foundation of real logistics infrastructure.
