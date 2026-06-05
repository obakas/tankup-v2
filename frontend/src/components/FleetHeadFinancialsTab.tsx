import { ArrowDownCircle, ArrowUpCircle, TrendingUp, Wallet } from "lucide-react";
import { type FinancialSummary } from "@/lib/fleetHeadApi";
import { PLATFORM_BATCH_COMMISSION_RATE } from "@/constants/water";

const formatNGN = (value: number) =>
  `₦${new Intl.NumberFormat("en-NG").format(value)}`;

function KpiCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`rounded-lg p-1.5 ${bgClass}`}>
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-foreground">{formatNGN(value)}</p>
    </div>
  );
}

export function FleetHeadFinancialsTab({ data }: { data: FinancialSummary | null }) {
  if (!data) {
    return <p className="text-sm text-muted-foreground">No financial data available. Refresh to try again.</p>;
  }

  const estDriverPayouts = data.net_revenue * (1 - PLATFORM_BATCH_COMMISSION_RATE);
  const estPlatformCommission = data.net_revenue * PLATFORM_BATCH_COMMISSION_RATE;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total Revenue" value={data.total_revenue} icon={ArrowDownCircle} colorClass="text-emerald-600 dark:text-emerald-400" bgClass="bg-emerald-500/10" />
        <KpiCard label="Total Refunded" value={data.total_refunded} icon={ArrowUpCircle} colorClass="text-red-600 dark:text-red-400" bgClass="bg-red-500/10" />
        <KpiCard label="Net Revenue" value={data.net_revenue} icon={TrendingUp} colorClass="text-blue-600 dark:text-blue-400" bgClass="bg-blue-500/10" />
        <KpiCard label="Est. Driver Payouts" value={estDriverPayouts} icon={Wallet} colorClass="text-amber-600 dark:text-amber-400" bgClass="bg-amber-500/10" />
      </div>

      <p className="text-xs text-muted-foreground">
        Est. platform commission ({Math.round(PLATFORM_BATCH_COMMISSION_RATE * 100)}% of net): {formatNGN(estPlatformCommission)}.
        Driver payout estimate uses the batch commission rate.
      </p>

      <div className="space-y-4">
        {/* Payment status breakdown */}
        {Object.keys(data.payment_counts).length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Payment Status</p>
            <div className="space-y-2">
              {Object.entries(data.payment_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Refund status breakdown */}
        {Object.keys(data.refund_counts).length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Refund Status</p>
            <div className="space-y-2">
              {Object.entries(data.refund_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
