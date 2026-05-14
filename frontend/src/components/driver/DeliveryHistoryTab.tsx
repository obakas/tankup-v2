import { useEffect, useState } from "react";
import { fetchDriverHistory, type DriverHistoryItem } from "@/lib/history";

function formatDate(value: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleString();
}

function prettyStatus(value: string) {
    return value.replace(/_/g, " ");
}

interface Props {
    tankerId: number;
}

export default function DeliveryHistoryTab({ tankerId }: Props) {
    const [items, setItems] = useState<DriverHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                setIsLoading(true);
                setError(null);
                const data = await fetchDriverHistory(tankerId);
                if (!mounted) return;
                setItems(data.items);
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : "Failed to load history");
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        void load();
        return () => {
            mounted = false;
        };
    }, [tankerId]);

    if (isLoading) {
        return <div className="rounded-2xl border bg-card p-5">Loading delivery history...</div>;
    }

    if (error) {
        return <div className="rounded-2xl border bg-card p-5 text-sm text-red-500">{error}</div>;
    }

    if (!items.length) {
        return (
            <div className="rounded-2xl border bg-card p-5">
                <h2 className="text-lg font-bold">Delivery History</h2>
                <p className="mt-2 text-sm text-muted-foreground">No completed jobs yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {items.map((item) => (
                <div
                    key={`${item.job_type}-${item.job_id}`}
                    className="rounded-2xl border bg-card p-5 shadow-sm"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-base font-bold">
                                {item.job_type === "batch" ? "Batch Delivery" : "Priority Delivery"} #{item.job_id}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {item.total_planned_liters}L planned • {item.total_actual_liters_delivered}L delivered
                            </p>
                        </div>
                        <span className="rounded-full border px-3 py-1 text-xs capitalize">
                            {prettyStatus(item.job_status)}
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-muted-foreground">Stops</p>
                            <p>
                                {item.delivered_stops}/{item.total_stops} delivered
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Issues</p>
                            <p>
                                {item.failed_stops} failed • {item.skipped_stops} skipped
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Started</p>
                            <p>{formatDate(item.started_at)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Completed</p>
                            <p>{formatDate(item.completed_at)}</p>
                        </div>
                        {item.job_type === "priority" && (
                            <div className="col-span-2">
                                <p className="text-muted-foreground">Customer</p>
                                <p>{item.customer_name || "—"} {item.customer_phone ? `• ${item.customer_phone}` : ""}</p>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
