import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, Wallet } from "lucide-react";
import { getAdminFinancials } from "@/lib/admin";
import { formatNumber, StatusPill } from "./shared";
import { PLATFORM_BATCH_COMMISSION_RATE } from "@/constants/water";

const POLL_MS = 30_000;

type Props = {
  canLoad: boolean;
};

export function FinancialsTab({ canLoad }: Props) {
  const query = useQuery({
    queryKey: ["admin", "financials"],
    queryFn: getAdminFinancials,
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const data = query.data;
  const estDriverPayouts = data ? data.net_revenue * (1 - PLATFORM_BATCH_COMMISSION_RATE) : 0;
  const estPlatformCommission = data ? data.net_revenue * PLATFORM_BATCH_COMMISSION_RATE : 0;

  const kpiCards = [
    {
      label: "Total Revenue",
      value: data?.total_revenue ?? 0,
      icon: ArrowDownCircle,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Total Refunded",
      value: data?.total_refunded ?? 0,
      icon: ArrowUpCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Net Revenue",
      value: data?.net_revenue ?? 0,
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Est. Driver Payouts",
      value: estDriverPayouts,
      icon: Wallet,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  if (query.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 shadow-sm animate-pulse">
            <div className="h-4 w-24 rounded bg-muted mb-3" />
            <div className="h-8 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300 text-sm">
        Failed to load financial data. Try refreshing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <div className={`rounded-lg p-1.5 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-foreground">
                ₦{formatNumber(card.value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Est. platform commission note */}
      <p className="text-xs text-muted-foreground">
        Est. platform commission ({Math.round(PLATFORM_BATCH_COMMISSION_RATE * 100)}% of net): ₦{formatNumber(estPlatformCommission)}.
        Driver payout estimate uses the batch commission rate — actual splits may vary for priority jobs.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Payment status breakdown */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-foreground">Payment Status</p>
          {data && Object.keys(data.payment_counts).length > 0 ? (
            <div className="space-y-2.5">
              {Object.entries(data.payment_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusPill status={status} />
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          )}
        </div>

        {/* Refund status breakdown */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-foreground">Refund Status</p>
          {data && Object.keys(data.refund_counts).length > 0 ? (
            <div className="space-y-2.5">
              {Object.entries(data.refund_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusPill status={status} />
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No refunds issued yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
