// Mirrors backend/app/utils/time_policy.py — keep in sync when backend changes.
export const BATCH_FILL_TIMEOUT_MINUTES = 90;
export const LOADING_TIMEOUT_MINUTES = 45;
export const PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES = 20;
export const DELIVERY_TIMEOUT_HOURS = 6;

// Customer-facing "typical duration" estimates — field-observed, distinct from
// the SLA timeouts above (which drive operational alerting, not display copy).
export const EXPECTED_QUEUE_MINUTES = 13;
export const EXPECTED_LOADING_MINUTES = 13;
