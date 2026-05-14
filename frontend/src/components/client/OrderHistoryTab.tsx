import { useEffect, useState } from "react";
import { fetchClientHistory, type ClientHistoryItem } from "@/lib/history";
import { formatNigeriaDateTime, formatNigeriaTime } from "@/lib/datetime";

// function formatDate(value: string | null) {
//     if (!value) return "—";
//     return new Date(value).toLocaleString();
// }

function prettyStatus(value: string | null | undefined) {
    if (!value) return "—";
    return value.replace(/_/g, " ");
}

function statusLabel(item: ClientHistoryItem) {
    if (item.request_status === "partially_completed") {
        return "Partially completed";
    }

    if (item.request_status === "failed" || item.delivery_status === "failed") {
        return "Failed";
    }

    if (item.delivery_status === "skipped") {
        return "Skipped";
    }

    if (item.delivery_status === "delivered" || item.request_status === "completed") {
        return "Delivered";
    }

    if (item.request_status === "expired") {
        return "Expired";
    }

    if (
        ["assigned", "loading", "delivering", "arrived"].includes(item.request_status) ||
        ["pending", "en_route", "arrived", "measuring", "awaiting_otp"].includes(item.delivery_status || "")
    ) {
        return "In progress";
    }

    if (item.delivery_type === "batch" && item.batch_status) {
        return prettyStatus(item.batch_status);
    }

    return prettyStatus(item.request_status);
}

interface Props {
    userId: number;
}

export default function OrderHistoryTab({ userId }: Props) {
    const [items, setItems] = useState<ClientHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                setIsLoading(true);
                setError(null);
                const data = await fetchClientHistory(userId);
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
    }, [userId]);

    if (isLoading) {
        return <div className="rounded-2xl border bg-card p-5">Loading order history...</div>;
    }

    if (error) {
        return <div className="rounded-2xl border bg-card p-5 text-sm text-red-500">{error}</div>;
    }

    if (!items.length) {
        return (
            <div className="rounded-2xl border bg-card p-5">
                <h2 className="text-lg font-bold">Order History</h2>
                <p className="mt-2 text-sm text-muted-foreground">No past orders yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {items.map((item) => (
                <div key={item.request_id} className="rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-base font-bold">
                                {item.delivery_type === "batch" ? "Batch Order" : "Priority Order"} #{item.request_id}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {item.volume_liters}L • {statusLabel(item)}
                            </p>
                        </div>
                        <span className="rounded-full border px-3 py-1 text-xs capitalize">
                            {item.delivery_type}
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-muted-foreground">Created</p>
                            <p>{formatNigeriaDateTime(item.created_at)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Completed</p>
                            <p>{formatNigeriaDateTime(item.completed_at || item.delivered_at)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Driver</p>
                            <p>{item.driver_name || "—"}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Delivered</p>
                            <p>{item.actual_liters_delivered ?? item.planned_liters ?? "—"}L</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Request Status</p>
                            <p>{prettyStatus(item.request_status)}</p>
                        </div>
                        {/* <div>
                            <p className="text-muted-foreground">Delivery Status</p>
                            <p>{prettyStatus(item.delivery_status)}</p>
                        </div> */}
                        <div>
                            <p className="text-muted-foreground">Delivery Status</p>
                            <p>{prettyStatus(item.delivery_status || item.batch_status || item.request_status)}</p>
                        </div>
                        {item.delivery_type === "batch" && (
                            <>
                                <div>
                                    <p className="text-muted-foreground">Payment</p>
                                    <p>{prettyStatus(item.payment_status)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Refund</p>
                                    <p>{prettyStatus(item.refund_status)}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
