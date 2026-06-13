---
name: project-pre-prod-reactivations
description: Features deliberately softened for the demo that must be restored before production ship
metadata:
  type: project
---

Two demo-only relaxations must be restored before production:

**1. Driver abandonment punishment (`set_driver_online` in `backend/app/api/routes/tankers.py`)**

Currently: `tanker.paused_until = None` is set unconditionally when `payload.online = True`, letting any driver immediately override their blacklist by toggling back online.

**Why softened:** The stale `paused_until` (from a mid-job offline event in an earlier test session) was blocking all auto-assignment and the demo can't afford that.

**Restore for prod:** Remove (or gate) the `tanker.paused_until = None` line so drivers who abandon mid-job actually serve their 2h/24h/48h cooldown before becoming eligible again.

**How to apply:** Find the comment `# Driver is actively signalling readiness — clear any stale blacklist.` block added to `set_driver_online`, around line 1155. Remove or wrap it so it only clears the 5-min offer-timeout blacklist (short durations), not the multi-hour abandonment penalties.

---

**2. Batch assignment radius (`backend/app/services/assignment_service.py`)**

Currently: `MIN_BATCH_ASSIGNMENT_RADIUS_KM = 5.0` (widened from 2.0 for dev/demo so the single test tanker always falls within range).

**Why softened:** In dev, tanker and customer are often at different test coordinates that exceed 2 km, so batch assignment never found an eligible tanker.

**Restore for prod:** Change `MIN_BATCH_ASSIGNMENT_RADIUS_KM` back to `2.0` (the original commented-out `MAX_BATCH_ASSIGNMENT_RADIUS_KM = 2.0` was the intended value). The batch radius expansion logic (up to 5 km over time) can stay.

**How to apply:** `assignment_service.py` line 33 — set `MIN_BATCH_ASSIGNMENT_RADIUS_KM = 2.0`.
