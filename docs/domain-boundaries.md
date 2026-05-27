# TankUp V2 — Domain Boundaries

## Purpose

This document defines what each domain owns, what it can change, what events it emits, and what it must never directly touch.

The goal is to prevent spaghetti architecture.

TankUp V2 is an operational logistics system. Each domain must have clear authority.

---

# Core Rule

A domain should only directly modify data it owns.

If another domain needs to react, use:

- service calls
- workflow engine actions
- domain events
- audit logs
- operational events

Do not let every module update every table.

That is how good systems become village wiring.

---

# Domain List

```txt
auth
customers
sites
dispatch
deliveries
payments
disputes
incidents
fleets
drivers
notifications
audit
geo