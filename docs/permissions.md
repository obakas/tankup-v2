# TankUp V2 Permissions

## Permission Philosophy

TankUp permissions are based on operational responsibility.

Actors should only access actions required for their role.

The system should avoid giving one actor too much control over the full delivery chain.

---

# Customer Permissions

## Can
- create account
- update own profile
- register delivery sites
- create delivery requests
- make payments
- view own delivery status
- receive delivery updates
- confirm delivery with OTP
- open disputes
- request refunds
- rate delivery experience

## Cannot
- assign drivers
- change delivery status manually
- edit driver/tanker records
- approve payouts
- see internal fleet operations
- override delivery completion

---

# Driver Permissions

## Can
- view assigned/offered jobs
- accept delivery offers
- reject delivery offers
- update own availability
- update delivery progress
- confirm loading
- confirm arrival
- record measurement
- request OTP confirmation
- submit incident reports
- submit site intelligence reports

## Cannot
- create customer requests
- change pricing
- approve payments
- approve refunds
- assign jobs to themselves
- edit customer payment records
- approve own payout
- mark delivery completed without OTP

---

# Fleet Head Permissions

## Can
- onboard drivers
- register tankers
- manage fleet drivers
- manage fleet tankers
- view fleet assignments
- monitor delivery progress
- assist customer escalation
- coordinate driver reassignment
- validate driver reports
- view fleet payout records

## Cannot
- modify platform-wide pricing
- approve platform-wide refunds
- delete delivery history
- secretly change customer OTP confirmation
- override admin fraud restrictions
- access other fleets’ private operations

---

# Admin Permissions

## Can
- view platform-wide operations
- approve/restrict fleets
- approve/restrict drivers
- suspend customers/drivers/fleets
- configure pricing rules
- configure assignment rules
- review disputes
- approve refunds
- hold payouts
- resolve fraud cases
- perform emergency reassignment
- view analytics

## Cannot

Admins should not casually bypass operational truth.

Admin overrides must be logged.

Examples:
- changing delivery status
- forcing refund
- suspending actor
- overriding payout
- reopening completed request

All admin interventions must create an audit log.

---

# Compliance Officer / Inspector Permissions Future

## Can
- verify driver documents
- verify tanker documents
- verify water sources
- audit high-risk sites
- submit compliance reports
- flag suspicious operations

## Cannot
- assign deliveries
- collect customer payment
- approve payouts
- override admin decisions
- modify pricing rules

---

# System Permissions

The system can automatically:
- expire unpaid requests
- expire delivery offers
- trigger reassignment
- flag late deliveries
- flag abnormal rejection patterns
- update risk scores
- generate operational alerts

The system cannot:
- complete delivery without OTP
- approve refunds without rule/admin process
- pay disputed payouts automatically