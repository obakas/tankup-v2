# Site Intelligence System

## Purpose

The Site Intelligence System exists to reduce delivery uncertainty before dispatch.

TankUp is not only transporting water.

TankUp is coordinating operational risk.

The platform must continuously learn:

- which delivery sites are easy,
- which sites damage pumping equipment,
- which sites create delays,
- which customers are reliable,
- which locations frequently generate disputes,
- which deliveries drivers avoid.

The goal is:

# operational predictability.

---

# Core Philosophy

A customer account is NOT the same as a delivery site.

One customer may own:

- multiple houses,
- offices,
- estates,
- construction sites,
- temporary projects.

Operational difficulty belongs to the:

# site itself.

Therefore:

# site intelligence persists independently.

Even if ownership changes.

---

# Major Operational Problem

Drivers currently suffer from hidden delivery difficulty.

Examples:

- tank located on very high elevation,
- long hose distance,
- poor parking access,
- steep compounds,
- difficult roads,
- aggressive customers,
- misleading tank size,
- unstable pumping conditions.

These problems create:

- pump strain,
- diesel waste,
- delivery delays,
- driver frustration,
- tanker rejection behavior,
- operational inefficiency.

TankUp must reduce this uncertainty.

---

# CustomerSiteProfile Entity

Every delivery location creates or updates a:

# CustomerSiteProfile

This becomes the permanent operational memory of the site.

---

# CustomerSiteProfile Fields

## Identity Information

- site_id
- customer_id
- site_name
- address
- gps_coordinates
- landmark_description
- site_images

---

## Tank Information

- tank_capacity_liters
- tank_type
- estimated_tank_height (eg. ground floor, 1st storey, 2nd storey,...,overhead etc)
- actual_verified_tank_height (eg. ground floor, 1st storey, 2nd storey,...,overhead etc)
- number_of_tanks
- pipe_connection_type

---

## Accessibility Information

- road_accessibility
- parking_distance
- hose_distance_estimate
- terrain_type
- turning_space_availability
- gate_accessibility

---

## Operational Risk Information

- pump_stress_level
- historical_driver_rejections
- average_delivery_duration
- average_waiting_time
- incident_history_count
- dispute_history_count

---

## Trust Information

- customer_truthfulness_score
- payment_reliability_score
- operational_cooperation_score
- fleet_feedback_score

---

## Verification Information

- verification_status
- verified_by_driver
- verified_by_fleet_head
- admin_review_status
- last_verified_at

---

# Site Verification Statuses

## unverified

Site has not yet been operationally confirmed.

System relies primarily on customer-submitted information.

Higher uncertainty exists.

---

## partially_verified

At least one successful delivery occurred.

Some operational data has been confirmed.

---

## verified

Multiple successful deliveries confirm:

- tank height,
- accessibility,
- operational conditions.

System confidence becomes high.

---

## high_risk

Site repeatedly causes:

- delivery incidents,
- disputes,
- hidden difficulty,
- excessive pump stress,
- repeated driver rejection.

Operational intervention may be required.

---

## restricted

Site may be temporarily blocked due to:

- fraud,
- abuse,
- severe disputes,
- operational danger,
- payment abuse.

Admin review required.

---

# Driver Intelligence Collection

Drivers are operational intelligence collectors.

During or after delivery,
drivers submit operational observations.

---

# Driver Verification Inputs

Drivers may provide:

## Tank Verification

- actual tank height
- actual tank size estimate
- actual pump strain level

---

## Accessibility Verification

- actual hose distance
- parking difficulty
- road difficulty
- turning difficulty

---

## Operational Experience

- customer cooperation
- waiting delays
- loading complications
- safety concerns

---

## Evidence

Drivers may upload:

- photos,
- short videos,
- incident evidence.

---

# Site Risk Scoring

Every site receives a dynamic:

# Site Risk Score

The score influences:

- dispatch confidence,
- driver acceptance rates,
- pricing,
- assignment priority.

---

# Example Risk Factors

## Physical Difficulty

- high tank elevation
- poor accessibility
- long hose distance
- bad terrain

---

## Behavioral Risk

- customer aggression
- delayed OTP cooperation
- repeated complaints
- false reporting

---

## Operational Risk

- high historical rejection rate
- excessive delivery time
- repeated incidents
- repeated disputes

---

# Risk Levels

## Low Risk

Easy predictable delivery.

Preferred for batching.

---

## Medium Risk

Some operational caution required.

May slightly affect pricing.

---

## High Risk

Operationally difficult.

May require:

- experienced drivers,
- special equipment,
- adjusted pricing,
- manual review.

---

## Critical Risk

Site may be temporarily restricted.

Requires admin or fleet review.

---

# Customer Misreporting Policy

A major operational issue is:

# hidden delivery difficulty.

Customers may intentionally underreport:

- tank height,
- hose distance,
- accessibility problems.

This creates:

- unfair driver burden,
- diesel waste,
- equipment strain.

---

# Misreporting Detection

The system compares:

## Customer Submitted Data

vs

## Driver Verified Data

Repeated mismatch patterns reduce:

- truthfulness score,
- operational trust score.

---

# Consequences of Repeated Misreporting

Customers may experience:

- higher delivery pricing,
- verification requirements,
- reduced batching eligibility,
- manual review,
- temporary restrictions.

---

# Dispatch Intelligence Usage

Site intelligence directly affects dispatch.

---

# Assignment Logic Inputs

Dispatch engine may consider:

- site risk level,
- tanker suitability,
- driver experience,
- historical success rate,
- terrain compatibility,
- estimated operational duration.

---

# Example

High tank elevation may require:

- stronger pumping capability,
- experienced drivers,
- adjusted tanker selection.

---

# Pricing Intelligence Usage

Pricing should reflect operational reality.

Customers are not paying only for water.

They are paying for:

- operational difficulty,
- diesel,
- delivery complexity,
- time burden,
- equipment stress.

---

# Example Pricing Adjustments

## Higher Pricing Factors

- difficult terrain
- high tank elevation
- long hose distance
- excessive waiting time
- difficult access

---

## Lower Pricing Factors

- repeat verified site
- easy accessibility
- predictable delivery conditions
- cooperative customer history

---

# Fleet Head Visibility

Fleet heads may view:

- site operational summaries,
- driver feedback,
- recurring site problems,
- delivery risk patterns.

Fleet heads help:

- reduce failed deliveries,
- coordinate suitable tanker assignments,
- prepare drivers operationally.

---

# Admin Oversight

Admins may:

- review incidents,
- override site statuses,
- investigate abuse,
- handle disputes,
- freeze dangerous sites.

All administrative actions must generate:

# audit logs.

---

# Long-Term Strategic Advantage

Most competitors may only know:

- customer names,
- phone numbers,
- addresses.

TankUp aims to know:

# operational delivery reality.

That operational memory becomes:

- dispatch intelligence,
- pricing intelligence,
- operational trust infrastructure.

This is the beginning of:

# infrastructure-level logistics software,
not merely a delivery app.