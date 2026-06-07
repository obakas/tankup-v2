export function parseApiDate(dateString?: string | null): Date | null {
  if (!dateString) return null;
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(dateString);
  const normalized = hasTimezone ? dateString : `${dateString}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatScheduledDateTime(value?: string) {
  if (!value) return "";

  const date = parseApiDate(value);

  if (!date) return value;

  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
