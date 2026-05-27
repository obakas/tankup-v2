# TankUp V2 Actors

## 1. Customer

The customer is the person or organization requesting water delivery.

### Responsibilities
- Create an account
- Register delivery sites
- Create delivery requests
- Make payments
- Receive delivery
- Confirm delivery with OTP
- Report disputes or issues

### Important Notes
- A customer can have multiple delivery sites.
- Customer identity is separate from site intelligence.
- The customer is not responsible for tanker operations.

---

## 2. Driver

The driver is the field operator responsible for executing water delivery.

### Responsibilities
- Declare availability
- Receive delivery offers
- Accept or reject offers
- Load water
- Navigate to the customer site
- Deliver water
- Record measurement
- Collect OTP confirmation
- Report incidents
- Submit site intelligence after delivery

### Important Notes
- Drivers help collect real-world site intelligence.
- Drivers do not manage platform pricing.
- Drivers should not be the main customer support channel.

---

## 3. Fleet Head

The fleet head is the operational coordinator responsible for managing drivers and tankers.

### Responsibilities
- Onboard drivers
- Register/manage tankers
- Monitor tanker readiness
- Monitor active assignments
- Coordinate drivers
- Handle customer escalation
- Assist dispute resolution
- Validate operational reports

### Important Notes
- Fleet heads are not useless middlemen.
- They are operational coordinators.
- They help preserve trust, accountability, and field discipline.

---

## 4. Admin

The admin governs the platform and handles high-level oversight.

### Responsibilities
- Monitor platform operations
- Approve or restrict fleet heads
- Monitor fraud and abuse
- Resolve serious disputes
- Configure pricing rules
- Configure assignment rules
- Monitor analytics
- Perform emergency interventions

### Important Notes
- Admins should not manually control every delivery.
- Admins intervene when the system needs governance or correction.

---

## 5. Compliance Officer / Inspector Future Role

This is a future role, not required for MVP.

### Responsibilities
- Verify driver documents
- Verify tanker documents
- Verify water sources
- Audit high-risk sites
- Investigate repeated disputes
- Perform compliance checks

### Important Notes
- For MVP, site verification can be partially handled by drivers after delivery.
- Fleet heads may handle early driver/tanker validation.
- A separate inspector role should only be introduced when operational volume justifies it.