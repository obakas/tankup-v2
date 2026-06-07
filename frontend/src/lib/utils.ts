import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseApiDate } from "./datetime";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
