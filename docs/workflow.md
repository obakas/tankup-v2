# TankUp V2 Workflow

## Current Backend Workflow Snapshot

The current backend implements only the delivery execution core:

```txt
CREATED → ASSIGNED → LOADING → EN_ROUTE → ARRIVED → MEASURING → AWAITING_OTP → COMPLETED
```

Current backend workflow notes:

- delivery transitions are server-validated,
- each successful status transition writes a delivery event and audit log,
- OTP generation is allowed in `ARRIVED` and `MEASURING`,
- OTP verification is allowed in `AWAITING_OTP`,
- OTP verification does not automatically complete the delivery,
- `COMPLETED`, `FAILED`, and `SKIPPED` are terminal states.

The broader workflows below describe product direction and include features not implemented yet.

---

# Customer Workflow

## 1. Account Registration
- create account
- verify phone number
- create customer identity

## 2. Site Registration
- add delivery site
- provide address/location
- provide tank information
- provide accessibility information
- upload optional site photos
- save one or multiple delivery sites

## 3. Delivery Request Creation
- choose registered site
- choose water quantity
- choose delivery type
    - batch
    - priority
- choose urgency/schedule
- submit request

## 4. Payment
- pay for request
- payment confirmation
- request activation

## 5. Assignment Waiting
- request enters assignment queue
- tanker/fleet assignment begins
- customer receives updates

## 6. Delivery Monitoring
- track delivery progress
- receive ETA updates
- contact support/fleet coordination if needed

## 7. Delivery Reception
- tanker arrives
- water discharge begins
- measurement occurs

## 8. OTP Confirmation
- customer confirms delivery
- OTP verification completes request

## 9. Rating / Dispute / Refund
- customer rates experience
- customer reports disputes/issues
- refund/escalation handling if necessary

---

# Driver Workflow

## 1. Driver Onboarding
- driver added by fleet head/admin
- driver identity verification
- tanker assignment
- activation approval

## 2. Tanker Verification
- tanker capacity registration
- hose capability registration
- pump condition verification
- tanker readiness validation

## 3. Availability Declaration
- available
- loading
- offline
- maintenance

## 4. Offer Reception
- receive delivery offer
- view site intelligence
- view delivery difficulty indicators
- view payout estimate

## 5. Acceptance / Rejection
- accept request
- reject request
- optional rejection reason submission

## 6. Loading
- proceed to water source/loading point
- loading confirmation
- departure confirmation

## 7. Navigation / Transit
- navigate to delivery site
- location updates
- issue reporting if needed

## 8. Arrival
- arrival confirmation
- parking/accessibility assessment

## 9. Measurement / Delivery Execution
- start water discharge
- measurement recording
- completion measurement

## 10. Site Intelligence Collection
- confirm actual tank height
- confirm hose difficulty
- confirm accessibility difficulty
- submit delivery notes
- upload optional photos/evidence
- report customer behavior/issues

## 11. OTP Confirmation
- customer provides OTP
- delivery verification completes

## 12. Incident Reporting
- failed delivery reporting
- partial delivery reporting
- pump/mechanical issues
- customer disputes
- road/accessibility incidents

## 13. Completion
- delivery completed
- payout tracking
- tanker returns available

---

# Fleet Head Workflow

## 1. Fleet Registration / Management
- register fleet
- manage fleet tankers
- manage fleet drivers

## 2. Driver Onboarding
- add drivers
- verify drivers
- activate/deactivate drivers

## 3. Tanker Supervision
- monitor tanker availability
- monitor maintenance state
- monitor loading status

## 4. Assignment Visibility
- view assigned jobs
- monitor delivery progress
- monitor driver activity

## 5. Operational Coordination
- communicate with drivers
- assist delayed deliveries
- coordinate reassignment if needed

## 6. Customer Escalation Handling
- respond to customer concerns
- provide delivery updates
- coordinate operational resolution

## 7. Dispute Coordination
- assist dispute resolution
- validate driver reports
- submit operational evidence

## 8. Operational Monitoring
- monitor fleet performance
- monitor rejection rates
- monitor incidents
- monitor delivery efficiency

---

# Admin Workflow

## 1. Platform Oversight
- monitor global operations
- monitor delivery system health
- monitor active requests

## 2. Fleet Governance
- approve/restrict fleets
- approve/restrict drivers
- monitor compliance

## 3. Fraud Detection
- suspicious customer behavior
- suspicious driver behavior
- fake delivery detection
- payout abuse detection

## 4. Dispute Resolution
- investigate escalations
- review evidence
- process refunds/interventions

## 5. Operational Alerts
- delayed deliveries
- failed deliveries
- tanker inactivity
- abnormal rejection patterns

## 6. Analytics & Intelligence
- demand heatmaps
- delivery difficulty analysis
- operational performance metrics
- pricing intelligence

## 7. Configuration
- pricing configuration
- assignment rules
- risk scoring rules
- operational policies

## 8. Emergency Intervention
- manually reassign requests
- suspend actors
- override operational failures

---

# Compliance Workflow (Future)

## 1. Driver Compliance Verification
- license verification
- identity verification
- behavioral review

## 2. Tanker Compliance Verification
- tanker ownership validation
- maintenance compliance
- operational fitness checks

## 3. Water Source Verification
- approved loading points
- water quality compliance
- source authorization checks

## 4. Risk-Based Site Verification
- high-risk site audits
- repeated dispute investigations
- fraud investigations

## 5. Operational Auditing
- audit operational incidents
- audit fleet behavior
- audit platform compliance
