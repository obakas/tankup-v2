import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Archive, ChevronDown, ChevronUp, CircleAlert, Droplets, RefreshCw, Truck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNigeriaDateTime } from "@/lib/datetime";
import {
  adminDismissOperationAlert,
  adminReassignOperationAlert,
  getAdminOperationAlerts,
  getAdminOverview,
} from "@/lib/admin";
import { formatNumber, severityAccent, SeverityPill, StatusPill } from "./shared";

const POLL_MS = 10_000;

type Props = {
  canLoad: boolean;
  isActionLoading: boolean;
  runAction: (action: () => Promise<unknown>, msg: string) => Promise<void>;
};

export function OverviewTab({ canLoad, isActionLoading, runAction }: Props) {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getAdminOverview,
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const alertsQuery = useQuery({
    queryKey: ["admin", "alerts"],
    queryFn: () => getAdminOperationAlerts({ limit: 50, status: "open" }),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const archivedAlertsQuery = useQuery({
    queryKey: ["admin", "alerts", "archived"],
    queryFn: () => getAdminOperationAlerts({ limit: 50, status: "resolved" }),
    enabled: canLoad && showArchived,
  });

  const totals = overviewQuery.data?.totals || {};
  const paymentValue = overviewQuery.data?.payment_value || {};
  const breakdown = overviewQuery.data?.status_breakdown || {};
  const alerts = alertsQuery.data?.items || [];
  const archivedAlerts = archivedAlertsQuery.data?.items || [];

  const metricCards = [
    { label: "Active batches", value: totals.active_batches ?? 0, icon: Droplets },
    { label: "Active deliveries", value: totals.active_deliveries ?? 0, icon: Activity },
    { label: "Online tankers", value: totals.online_tankers ?? 0, icon: Truck },
    { label: "Paid value", value: paymentValue.paid ?? 0, icon: Wallet, currency: true },
  ];

  const handleDismiss = (alertId: number) => {
    runAction(
      () => adminDismissOperationAlert(alertId),
      "Alert archived",
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] });
      if (showArchived) {
        queryClient.invalidateQueries({ queryKey: ["admin", "alerts", "archived"] });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-extrabold text-foreground">
                {item.currency ? `₦${formatNumber(item.value)}` : formatNumber(item.value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Status breakdowns */}
      {Object.keys(breakdown).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(breakdown).map(([category, counts]) => (
            <div key={category} className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold capitalize text-foreground">{category}</p>
              <div className="space-y-2">
                {Object.entries(counts as Record<string, number>).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusPill status={status} />
                    <span className="text-sm font-medium text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Operation alerts */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Operation Alerts</h2>
            <p className="text-sm text-muted-foreground">
              Timeout and failure signals from the backend scheduler.
              {alerts.length > 0 && (
                <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">
                  {alerts.length} open
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {alerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No open alerts — beautiful silence.
          </p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border border-l-4 bg-card p-4 ${severityAccent(alert.severity)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CircleAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{alert.alert_type}</span>
                      <SeverityPill severity={alert.severity} />
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.job_type} #{alert.job_id}
                      {alert.tanker_id ? ` • Tanker #${alert.tanker_id}` : ""}
                      {" • "}
                      {formatNigeriaDateTime(alert.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {["loading_timeout", "offer_expiry_repeated_failure"].includes(alert.alert_type) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActionLoading}
                        onClick={() =>
                          runAction(
                            () => adminReassignOperationAlert(alert.id),
                            "Manual reassignment triggered",
                          )
                        }
                      >
                        Reassign
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isActionLoading}
                      title="Archive alert"
                      onClick={() => handleDismiss(alert.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Archived section */}
        <div className="mt-4 border-t pt-4">
          <button
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive className="h-4 w-4" />
            {showArchived ? "Hide archived" : "Show archived alerts"}
            {!showArchived && archivedAlertsQuery.data && archivedAlerts.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {archivedAlerts.length}
              </span>
            )}
            {showArchived ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showArchived && (
            <div className="mt-3 space-y-2">
              {archivedAlerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No archived alerts.</p>
              ) : (
                archivedAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl border border-l-4 bg-card p-4 opacity-50 ${severityAccent(alert.severity)}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CircleAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{alert.alert_type}</span>
                        <SeverityPill severity={alert.severity} />
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.job_type} #{alert.job_id}
                        {alert.tanker_id ? ` • Tanker #${alert.tanker_id}` : ""}
                        {" • Archived "}
                        {formatNigeriaDateTime(alert.resolved_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
