import { useQuery } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { formatNigeriaDateTime, formatNigeriaTime } from "@/lib/datetime";
import { getAdminLive } from "@/lib/admin";
import { formatNumber, StatusPill } from "./shared";

const POLL_MS = 10_000;

type Props = { canLoad: boolean };

export function LiveTab({ canLoad }: Props) {
  const liveQuery = useQuery({
    queryKey: ["admin", "live"],
    queryFn: () => getAdminLive(20),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const batches = liveQuery.data?.batches || [];
  const tankers = liveQuery.data?.tankers || [];
  const deliveries = liveQuery.data?.deliveries || [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Updated {formatNigeriaDateTime(liveQuery.data?.generated_at)}
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active batches */}
        <section className="space-y-3">
          <h3 className="font-semibold text-foreground">
            Active batches
            <span className="ml-2 text-sm font-normal text-muted-foreground">({batches.length})</span>
          </h3>
          {batches.length === 0 ? (
            <EmptyCard message="No active batches" />
          ) : (
            batches.map((batch) => (
              <div key={batch.id} className="rounded-xl border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">Batch #{batch.id}</span>
                  <StatusPill status={batch.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(batch.current_volume)}L / {formatNumber(batch.target_volume)}L •{" "}
                  {batch.fill_percent}% full
                </p>
                <p className="text-sm text-muted-foreground">
                  Members: {batch.member_count} • Paid: {batch.paid_member_count}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tanker: {batch.tanker_id ? `#${batch.tanker_id}` : "Unassigned"}
                </p>
              </div>
            ))
          )}
        </section>

        {/* Active tankers */}
        <section className="space-y-3">
          <h3 className="font-semibold text-foreground">
            Active tankers
            <span className="ml-2 text-sm font-normal text-muted-foreground">({tankers.length})</span>
          </h3>
          {tankers.length === 0 ? (
            <EmptyCard message="No active tankers" />
          ) : (
            tankers.map((tanker) => {
              const isPunished = !!tanker.paused_until && new Date(tanker.paused_until) > new Date();
              return (
                <div key={tanker.id} className={`rounded-xl border p-3 space-y-1.5 ${isPunished ? "border-destructive" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{tanker.driver_name}</span>
                    <StatusPill status={tanker.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">Plate: {tanker.tank_plate_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Online: {tanker.is_online ? "Yes" : "No"} • Available:{" "}
                    {tanker.is_available ? "Yes" : "No"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last location: {formatNigeriaTime(tanker.last_location_update_at)}
                  </p>
                  {isPunished && (
                    <p className="text-xs font-medium text-destructive">⛔ Suspended until {formatNigeriaTime(tanker.paused_until)}</p>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Active deliveries */}
        <section className="space-y-3">
          <h3 className="font-semibold text-foreground">
            Active deliveries
            <span className="ml-2 text-sm font-normal text-muted-foreground">({deliveries.length})</span>
          </h3>
          {deliveries.length === 0 ? (
            <EmptyCard message="No active deliveries" />
          ) : (
            deliveries.map((delivery) => (
              <div key={delivery.id} className="rounded-xl border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">Delivery #{delivery.id}</span>
                  <StatusPill status={delivery.delivery_status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {delivery.job_type} • Tanker #{delivery.tanker_id} • Stop{" "}
                  {delivery.stop_order ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Planned: {formatNumber(delivery.planned_liters)}L • OTP:{" "}
                  {delivery.otp_verified ? "Verified" : "Pending"}
                </p>
                {delivery.anomaly_flagged && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    Anomaly flagged
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
