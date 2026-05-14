// src/lib/datetime.ts
export function parseApiDate(dateString?: string | null): Date | null {
    if (!dateString) return null;

    // If backend sends naive datetime like "2026-04-11T08:00:00",
    // treat it as UTC by appending "Z"
    const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(dateString);
    const normalized = hasTimezone ? dateString : `${dateString}Z`;

    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatNigeriaDateTime(dateString?: string | null): string {
    const date = parseApiDate(dateString);
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(date);
}

export function formatNigeriaTime(dateString?: string | null): string {
    const date = parseApiDate(dateString);
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(date);
}