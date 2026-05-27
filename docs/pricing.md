# TankUp V2 Pricing Model

---

# Pricing Philosophy

TankUp pricing is based on operational delivery cost, not just water volume.

The major operational cost drivers are:
- diesel
- delivery distance
- tanker utilization
- delivery difficulty
- waiting time
- pump stress
- urgency

The platform should avoid unrealistic flat pricing that ignores operational reality.

---

# Core Pricing Components

## 1. Base Water Cost

Represents the cost of the water itself.

### Influenced By
- water source
- water quantity
- seasonal scarcity

### Notes
- Water cost is usually smaller than logistics cost.
- Water source pricing may vary by area and season.

---

## 2. Logistics / Diesel Cost

Represents transportation and fuel cost.

### Influenced By
- delivery distance
- traffic conditions
- tanker size
- fuel price
- route difficulty

### Notes
- This is one of the most important pricing components.
- Diesel cost may fluctuate frequently.

---

## 3. Delivery Difficulty Cost

Represents operational stress caused by difficult sites.

### Influenced By
- tank height
- hose distance
- road accessibility
- parking difficulty
- estate restrictions
- steep terrain

### Notes
- Difficult sites create pump strain and operational delay.
- Repeated difficult sites may accumulate higher risk scores.

---

## 4. Priority Delivery Fee

Represents urgency-based pricing.

### Applies To
- immediate delivery
- same-day delivery
- fast-track requests

### Notes
- Priority requests may bypass batching logic.
- Priority pricing should compensate operational disruption.

---

## 5. Batch Delivery Discount

Represents reduced pricing from grouped deliveries.

### Influenced By
- nearby customers
- shared tanker route
- grouped operational efficiency

### Notes
- Batch pricing improves tanker utilization.
- Batch requests may have longer waiting periods.

---

## 6. Waiting Time Penalty

Represents operational delay caused after tanker arrival.

### Examples
- customer unavailable
- gate delays
- delayed OTP confirmation
- delayed parking access

### Notes
- Prevents excessive operational waste.
- Should only activate after grace period.

---

## 7. Platform Service Fee

Represents TankUp operational revenue.

### Covers
- platform maintenance
- dispatch coordination
- operational monitoring
- customer support
- infrastructure cost

### Notes
- Service fees should remain transparent.
- Hidden fees reduce trust.

---

# Future Pricing Intelligence

TankUp pricing may eventually become dynamic.

Future factors may include:
- dry season demand
- area demand intensity
- tanker scarcity
- historical delivery difficulty
- historical driver rejection rates
- peak-hour congestion
- emergency delivery conditions

---

# Site Intelligence Impact on Pricing

CustomerSiteProfiles may eventually influence pricing through:
- pump stress score
- accessibility score
- risk score
- waiting history
- dispute history

### Example

High-risk sites may:
- require higher delivery fees
- require experienced drivers
- reduce batching eligibility

---

# Driver / Fleet Compensation Philosophy

TankUp should ensure drivers and fleets are compensated fairly for operational difficulty.

Hard deliveries should not receive the same payout as easy deliveries.

### Influencing Factors
- delivery complexity
- delivery distance
- waiting time
- site difficulty
- urgency
- tanker utilization

---

# MVP Pricing Strategy

For MVP:
- keep pricing understandable
- avoid over-complicated dynamic pricing
- maintain operational fairness
- prioritize transparency

Initial pricing may use:
- fixed area pricing
- fixed tanker size pricing
- simple difficulty adjustments
- fixed service fee percentages

---

# Important Operational Principle

Pricing should discourage hidden difficulty.

Customers should be incentivized to:
- provide accurate site information
- report accurate tank height
- report accurate accessibility conditions

Repeated false reporting may:
- increase future pricing
- reduce trust score
- trigger verification review

---

# Refund Philosophy

Refunds should consider operational cost already incurred.

Example:
- tanker already dispatched
- diesel already consumed
- loading already completed

Partial operational execution may justify:
- partial refund instead of full refund

---

# Future Payout Model

Initial MVP payouts may operate at fleet level.

Future versions may support:
- direct driver payouts
- split payouts
- incentive bonuses
- performance rewards
- escrow systems