import { cn } from "@/lib/utils";

export const statusTone = (status?: string | null) => {
  const s = (status || "").toLowerCase();
  if (["completed", "delivered", "paid", "available"].includes(s))
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["failed", "expired", "cancelled", "skipped", "refunded"].includes(s))
    return "bg-red-500/10 text-red-700 dark:text-red-300";
  if (["assigned", "loading", "en_route", "delivering", "arrived", "awaiting_otp", "measuring"].includes(s))
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
};

export const severityTone = (severity?: string | null) => {
  const s = (severity || "").toLowerCase();
  if (s === "high") return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30";
  if (s === "medium") return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (s === "info") return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
};

export const severityAccent = (severity?: string | null) => {
  const s = (severity || "").toLowerCase();
  if (s === "high") return "border-l-red-500";
  if (s === "medium") return "border-l-amber-500";
  if (s === "info") return "border-l-blue-500";
  return "border-l-slate-400 dark:border-l-slate-600";
};

export const formatNumber = (value?: number | null) =>
  new Intl.NumberFormat("en-NG").format(Number(value || 0));

export function StatusPill({ status }: { status?: string | null }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        statusTone(status),
      )}
    >
      {status || "unknown"}
    </span>
  );
}

export function SeverityPill({ severity }: { severity?: string | null }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
        severityTone(severity),
      )}
    >
      {severity || "unknown"}
    </span>
  );
}
