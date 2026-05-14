import { CheckCircle2 } from "lucide-react";
import type { DriverStop } from "@/types/driver";

interface DeliveryListProps {
  deliveries: DriverStop[];
  activeDeliveryIdx: number;
}

export const DeliveryList = ({
  deliveries,
  activeDeliveryIdx,
}: DeliveryListProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 font-semibold text-foreground">All Deliveries</h3>

      <div className="space-y-3">
        {deliveries.map((d, i) => (
          <div
            key={d.id}
            className={`flex items-center justify-between rounded-lg p-2 text-sm ${
              i === activeDeliveryIdx && !d.delivered ? "bg-primary/5" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  d.delivered
                    ? "bg-success"
                    : i === activeDeliveryIdx
                    ? "bg-primary"
                    : "bg-secondary"
                }`}
              >
                {d.delivered ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success-foreground" />
                ) : (
                  <span
                    className={`text-xs font-bold ${
                      i === activeDeliveryIdx
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
              </div>

              <div>
                <span className="font-medium text-foreground">{d.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {d.volumeLiters.toLocaleString()}L
                </span>
              </div>
            </div>

            <span
              className={`text-xs font-medium ${
                d.delivered ? "text-success" : "text-muted-foreground"
              }`}
            >
              {d.delivered
                ? "Done"
                : i === activeDeliveryIdx
                ? "Active"
                : "Pending"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


