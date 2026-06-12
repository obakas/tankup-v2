import { useEffect, useState } from "react";
import {
  fetchDriverEarnings,
  type DriverEarningsResponse,
  type DriverEarningJobGroup,
} from "@/lib/driverApi";

type Period = "today" | "week" | "month" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

function naira(amount: number) {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

function JobCard({ group }: { group: DriverEarningJobGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-base">
            {group.job_type === "batch" ? "Batch Job" : "Priority Job"} #{group.job_id}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {group.stop_count} stop{group.stop_count !== 1 ? "s" : ""} •{" "}
            {group.total_volume_liters}L delivered
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-success">{naira(group.total_earnings)}</p>
          <p className="text-xs text-muted-foreground">{group.job_status?.replace(/_/g, " ")}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Volume</p>
          <p className="font-semibold">{naira(group.volume_earnings)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Stop bonus</p>
          <p className="font-semibold">{naira(group.stop_bonuses)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Site bonus</p>
          <p className="font-semibold text-success">{naira(group.site_bonuses)}</p>
        </div>
      </div>

      {group.stop_count > 1 && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Hide stops" : "Show stop breakdown"}
        </button>
      )}

      {(expanded || group.stop_count === 1) && (
        <div className="space-y-2 pt-1">
          {group.stops.map((stop, i) => (
            <div
              key={stop.id}
              className="flex items-center justify-between text-sm border-t pt-2"
            >
              <div className="text-muted-foreground">
                Stop {stop.stop_order ?? i + 1} •{" "}
                {stop.actual_liters_delivered ?? 0}L
              </div>
              <div className="text-right space-y-0.5">
                <p>{naira(stop.volume_earnings + stop.stop_bonus)}</p>
                {stop.site_bonus !== null ? (
                  <p className="text-xs text-success">
                    +{naira(stop.site_bonus)} site bonus
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">site bonus pending</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  tankerId: number;
}

export default function EarningsTab({ tankerId }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<DriverEarningsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const result = await fetchDriverEarnings(tankerId, period);
        if (!mounted) return;
        setData(result);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load earnings");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [tankerId, period]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 rounded-2xl border bg-card p-1">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`rounded-xl px-2 py-2 text-xs font-medium transition ${
              period === key
                ? "bg-success text-success-foreground"
                : "text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          Loading earnings...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border bg-card p-5 text-sm text-red-500">{error}</div>
      )}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-success">{naira(data.summary.total)}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="text-lg font-bold">{naira(data.summary.volume_earnings)}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Bonuses</p>
              <p className="text-lg font-bold">
                {naira(data.summary.stop_bonuses + data.summary.site_bonuses)}
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {data.summary.job_count} job{data.summary.job_count !== 1 ? "s" : ""},{" "}
            {data.summary.stop_count} stop{data.summary.stop_count !== 1 ? "s" : ""}
          </div>

          {data.jobs.length === 0 ? (
            <div className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">No earnings for this period yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.jobs.map((group) => (
                <JobCard key={`${group.job_type}-${group.job_id}`} group={group} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
