import { Copy, Loader2, Truck, AlertCircle, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchLifecycleCard } from "@/components/client/BatchLifecycleCard";
import type { BatchLiveResponse } from "@/lib/batches";

interface BatchStepProps {
    otp: string;
    selectedSize: number | null;
    price: number;
    onCopyOtp: () => void | Promise<void>;
    onViewTanker: () => void;
    onLeaveBatch: () => void;
    batchId: number | null;
    requestId: number | null;
    paymentDeadline: string | null;
    liveBatch: BatchLiveResponse | null;
    liveBatchLoading: boolean;
    liveBatchError: string | null;
}

const formatDateTime = (value: string | null) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString();
};

const getBatchHeadline = (status?: string) => {
    switch (status) {
        case "forming":
            return "We’re building your batch";
        case "near_ready":
            return "Your batch is almost full";
        case "ready_for_assignment":
            return "Your batch is ready for tanker assignment";
        case "assigned":
            return "A tanker has been assigned";
        case "loading":
            return "Your tanker is loading water";
        case "delivering":
            return "Your delivery is on the way";
        case "arrived":
            return "Your tanker has arrived";
        case "completed":
            return "Your batch delivery is complete";
        case "partially_completed":
            return "Your batch finished with some issues";
        case "failed":
            return "This batch delivery failed";
        case "expired":
            return "This batch expired";
        default:
            return "Your batch order";
    }
};

const getBatchSubtext = (status?: string) => {
    switch (status) {
        case "forming":
            return "We’re waiting for more nearby customers to join so the tanker can dispatch efficiently.";
        case "near_ready":
            return "Good news — this batch is getting close to dispatch.";
        case "ready_for_assignment":
            return "Your batch is full enough and is waiting for the best tanker match.";
        case "assigned":
            return "A driver has been matched to your batch.";
        case "loading":
            return "The assigned tanker is currently loading for delivery.";
        case "delivering":
            return "Keep your phone close. Delivery is in progress.";
        case "arrived":
            return "Please share your OTP with the driver after water measurement is complete.";
        case "completed":
            return "This delivery has been completed successfully.";
        case "partially_completed":
            return "The batch was resolved, but not every stop completed successfully.";
        case "failed":
            return "This batch could not be completed successfully.";
        case "expired":
            return "This batch could not be completed in time.";
        default:
            return "Track your batch progress here.";
    }
};

const canViewTanker = (status?: string) => {
    return ["assigned", "loading", "delivering", "arrived", "completed", "partially_completed", "failed"].includes(
        status ?? ""
    );
};

export default function BatchStep({
    otp,
    selectedSize,
    price,
    onCopyOtp,
    onViewTanker,
    onLeaveBatch,
    batchId,
    requestId,
    paymentDeadline,
    liveBatch,
    liveBatchLoading,
    liveBatchError,
}: BatchStepProps) {
    const status = liveBatch?.status;
    const headline = getBatchHeadline(status);
    const subtext = getBatchSubtext(status);

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-foreground">{headline}</h2>
                    <p className="text-sm text-muted-foreground">{subtext}</p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Request ID
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                            {requestId ?? "—"}
                        </p>
                    </div>

                    <div className="rounded-xl border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Batch ID
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                            {batchId ?? "—"}
                        </p>
                    </div>

                    <div className="rounded-xl border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Quantity
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                            {selectedSize ? `${selectedSize.toLocaleString()}L` : "—"}
                        </p>
                    </div>

                    <div className="rounded-xl border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Amount Paid
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                            ₦{price.toLocaleString()}
                        </p>
                    </div>
                </div>

                {paymentDeadline && liveBatch?.member_payment_status !== "paid" && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="text-sm">
                            <p className="font-medium">Payment deadline</p>
                            <p>{formatDateTime(paymentDeadline)}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-foreground">Your Delivery OTP</p>
                        <p className="text-sm text-muted-foreground">
                            Share this with the driver only after measurement is complete.
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCopyOtp}
                        disabled={!otp}
                        className="gap-2"
                    >
                        <Copy className="h-4 w-4" />
                        Copy
                    </Button>
                </div>

                <div className="mt-4 rounded-2xl border bg-muted/30 p-6 text-center">
                    <p className="text-3xl font-bold tracking-[0.3em] text-foreground">
                        {otp || "----"}
                    </p>
                </div>
            </div>

            {liveBatchLoading && !liveBatch && (
                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p className="text-sm">Syncing your batch status...</p>
                    </div>
                </div>
            )}

            {liveBatchError && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                        <div>
                            <p className="font-medium text-destructive">
                                Could not refresh batch status
                            </p>
                            <p className="text-sm text-muted-foreground">{liveBatchError}</p>
                        </div>
                    </div>
                </div>
            )}

            {liveBatch && <BatchLifecycleCard batch={liveBatch} isLoading={liveBatchLoading} />}

            {liveBatch?.tanker_id && (
                <div className="rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                        <Truck className="mt-0.5 h-5 w-5 text-primary" />
                        <div>
                            <p className="font-medium text-foreground">Assigned Tanker</p>
                            <p className="text-sm text-muted-foreground">
                                Tanker #{liveBatch.tanker_id}
                                {liveBatch.driver_name ? ` • Driver: ${liveBatch.driver_name}` : ""}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <Button
                    type="button"
                    className="w-full"
                    onClick={onViewTanker}
                    disabled={!canViewTanker(status)}
                >
                    View Tanker Status
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
                    onClick={onLeaveBatch}
                >
                    Leave Batch
                </Button>
            </div>
        </div>
    );
}