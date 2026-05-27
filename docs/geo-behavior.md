# TankUp V2 — Geo Behavior

## Purpose

Geo behavior defines how TankUp uses location data.

Location should improve dispatch, trust, and operational awareness.

But location is not magic.

GPS can be wrong.
Drivers can spoof.
Networks can fail.
Addresses can be vague.

TankUp should use geo as evidence, not as unquestionable truth.

---

# 1. Geo Data Types

TankUp may store:

```txt
customer_site_location
driver_current_location
tanker_last_location
loading_point_location
delivery_arrival_location
incident_location
photo_capture_location
```

---

# 2. Customer Site Location

Customer site profile should include:

```txt
address_text
landmark
latitude
longitude
area
city
state
location_accuracy
verification_status
```

## MVP Rule

Do not rely only on pin location.

Also collect:

- address,
- landmark,
- site description,
- phone contact,
- parking/access notes.

Nigeria will humble pure GPS optimism.

---

# 3. Driver Location

Driver app may send location pings:

```txt
driver_id
latitude
longitude
accuracy
speed
heading
timestamp
delivery_id
```

## Uses

- dispatch proximity,
- arrival confidence,
- delay detection,
- route progress,
- dispute support.

---

# 4. Tanker Location

Tanker location may initially be inferred from driver location.

Future:

- tanker GPS devices,
- fleet tracking devices,
- loading point check-ins.

MVP does not need hardware tracking.

---

# 5. Arrival Detection

Arrival can be detected by:

```txt
driver_manual_arrival
gps_near_site
customer_confirmation
admin_override
```

## Recommended MVP Rule

Use manual arrival plus optional GPS confidence.

Do not block arrival only because GPS is imperfect.

---

# 6. Geo Fence Logic

A driver may be considered near site if within:

```txt
100m - high confidence
250m - medium confidence
500m - low confidence
```

Exact threshold should depend on Abuja road/address realities.

---

# 7. Dispatch Geo Logic

Dispatch should consider:

```txt
distance_to_site
distance_to_loading_point
site_difficulty
road/access risk
driver_area_familiarity
fleet_area_strength
diesel economics
```

Important:

Nearest driver is not always the best driver.

A farther tanker with better site compatibility may be better.

---

# 8. Difficult Area Handling

Some locations may become difficult due to:

- bad road,
- long distance,
- traffic,
- security risk,
- poor access,
- low delivery profitability,
- frequent disputes.

System should store area intelligence over time.

---

# 9. Geo Evidence In Disputes

Geo data can help answer:

- Did driver approach site?
- Was driver near location at arrival time?
- Was incident reported at correct area?
- Did delivery path make sense?

But geo alone should not settle disputes.

It should support human/admin judgment.

---

# 10. Location Spoofing Risk

Drivers or users may fake location.

Fraud signals:

```txt
impossible_speed
location_jumps
arrival_far_from_site
repeated_gps_mismatch
same_location_for_many_drivers
```

MVP should log these as warnings.

Do not over-automate punishment early.

---

# 11. Geo Privacy Rules

Only collect what is operationally necessary.

Do not expose driver live location unnecessarily.

Customer should see limited operational location, not full surveillance.

Fleet head sees fleet-related activity.

Admin sees full operational view.

---

# 12. MVP Geo Scope

## Must Have

- customer site address,
- landmark,
- optional coordinates,
- driver manual arrival,
- delivery area,
- location attached to incidents if available.

## Should Have

- driver location heartbeat,
- arrival distance check,
- map preview for admin.

## Later

- live customer tracking,
- route optimization,
- demand heatmaps,
- tanker hardware GPS,
- predictive dispatch.

---

# 13. Geo Anti-Pattern

Do not build a beautiful live map before the operation works.

A map showing broken logistics is just expensive decoration.

First make the delivery truth reliable.

Then make it visible.
