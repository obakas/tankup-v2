# TankUp V2 Entities

---

# 1. User

Represents a platform identity.

A user may be:
- customer
- driver
- fleet head
- admin

## Core Responsibilities
- authentication
- identity management
- communication access

## Important Notes
- Operational data should not live directly on the User entity.
- Role-specific data should live in separate profile entities.

---

# 2. CustomerProfile

Represents customer-specific operational information.

## Responsibilities
- customer preferences
- customer contact information
- trust/reputation tracking
- dispute history

## Relationships
- belongs to a User
- owns multiple CustomerSiteProfiles
- creates DeliveryRequests

---

# 3. CustomerSiteProfile

Represents a physical delivery location.

This is one of the most important entities in TankUp V2.

## Responsibilities
- store delivery site information
- store accessibility information
- store delivery difficulty history
- store operational intelligence

## Example Information
- address
- GPS coordinates
- tank height
- hose distance
- parking accessibility
- road difficulty
- pump stress indicators

## Relationships
- belongs to CustomerProfile
- referenced by DeliveryRequests
- accumulates SiteIntelligenceReports
- accumulates IncidentReports

## Important Notes
- Site intelligence is a major operational moat.
- Multiple customers may eventually reference the same site.

---

# 4. DeliveryRequest

Represents a customer request for water delivery.

## Responsibilities
- request tracking
- assignment lifecycle
- payment linkage
- operational execution tracking

## Example Information
- requested volume
- delivery type
- urgency
- assigned tanker
- assigned driver
- request status

## Relationships
- belongs to CustomerProfile
- references CustomerSiteProfile
- references Payment
- references DeliveryRecord

---

# 5. DriverProfile

Represents operational driver information.

## Responsibilities
- operational identity
- availability tracking
- performance tracking
- incident history
- rejection history

## Relationships
- belongs to User
- belongs to Fleet
- operates Tankers
- receives DeliveryOffers

---

# 6. Tanker

Represents a physical tanker vehicle.

## Responsibilities
- delivery execution
- capacity tracking
- operational readiness
- maintenance tracking

## Example Information
- capacity
- hose capability
- pump capability
- tanker condition
- maintenance status

## Relationships
- belongs to Fleet
- operated by DriverProfile

## Important Notes
- Tankers and drivers are separate entities.
- One driver may operate multiple tankers over time.

---

# 7. Fleet

Represents a tanker operational group or organization.

## Responsibilities
- manage drivers
- manage tankers
- coordinate operations
- maintain operational accountability

## Relationships
- managed by FleetHeadProfile
- owns multiple Tankers
- manages multiple DriverProfiles

---

# 8. FleetHeadProfile

Represents the operational coordinator.

## Responsibilities
- coordinate drivers
- coordinate assignments
- handle escalations
- validate onboarding
- maintain operational discipline

## Relationships
- belongs to User
- manages Fleet

---

# 9. DeliveryOffer

Represents an assignment offer sent to a driver/tanker.

## Responsibilities
- assignment coordination
- acceptance/rejection tracking
- operational matching

## Example Information
- payout estimate
- delivery difficulty estimate
- offer expiration
- rejection reason

---

# 10. DeliveryRecord

Represents actual delivery execution.

## Responsibilities
- operational proof
- measurement tracking
- OTP confirmation
- delivery auditing

## Example Information
- arrival time
- measurement start/end
- OTP confirmation
- completion time

## Important Notes
- DeliveryRecord is one of the most important operational entities.

---

# 11. SiteIntelligenceReport

Represents field intelligence collected after delivery.

## Responsibilities
- capture operational reality
- improve assignment confidence
- improve pricing intelligence

## Example Information
- actual hose difficulty
- actual tank height
- accessibility notes
- customer behavior
- pump stress observations

## Relationships
- references CustomerSiteProfile
- submitted by DriverProfile

---

# 12. IncidentReport

Represents operational problems or disputes.

## Responsibilities
- dispute tracking
- operational auditing
- failure analysis

## Example Information
- failed delivery
- customer abuse
- road blockage
- tanker breakdown
- payment dispute

---

# 13. Payment

Represents financial transactions.

## Responsibilities
- payment tracking
- payout coordination
- refund handling

## Relationships
- references DeliveryRequest

---

# 14. Payout

Represents operational payout distribution.

## Responsibilities
- fleet payout tracking
- driver compensation tracking
- platform fee tracking

## Important Notes
- Initial MVP payouts may operate at fleet level instead of direct driver level.

---

# 15. ComplianceRecord (Future)

Represents compliance and verification information.

## Responsibilities
- document verification
- tanker verification
- water source verification
- operational audits