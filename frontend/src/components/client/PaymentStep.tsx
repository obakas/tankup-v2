import { CreditCard, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BATCH_PRICE_PER_LITER } from "@/constants/water";
import type { RequestMode } from "@/types/client";
import { formatScheduledDateTime } from "@/lib/utils";

interface PaymentStepProps {
    price: number;
    selectedSize: number | null;
    requestMode: RequestMode;
    priorityMode: "asap" | "scheduled";
    scheduledFor: string;
    onPay: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

const PaymentStep = ({
    price,
    selectedSize,
    requestMode,
    priorityMode,
    scheduledFor,
    onPay,
    onCancel,
    isLoading = false,
}: PaymentStepProps) => {
    return (
        <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Amount to pay</p>
                    <p className="text-4xl font-extrabold text-foreground">
                        ₦{price.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        for {selectedSize?.toLocaleString()}L of water
                    </p>
                </div>

                <div className="border-t border-border pt-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery type</span>
                        <span className="font-medium text-foreground">
                            {requestMode === "batch" ? "Batch Saver" : "Priority Delivery"}
                        </span>
                    </div>

                    {requestMode === "priority" && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Priority timing</span>
                            <span className="font-medium text-foreground">
                                {priorityMode === "asap"
                                    ? "ASAP"
                                    : scheduledFor
                                        ? formatScheduledDateTime(scheduledFor)
                                        : "Not selected"}
                            </span>
                        </div>
                    )}

                    {requestMode === "batch" ? (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Rate</span>
                            <span className="font-medium text-foreground">
                                ₦{BATCH_PRICE_PER_LITER}/liter
                            </span>
                        </div>
                    ) : (
                        <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
                            <p className="text-sm font-medium text-foreground">
                                Full tanker payment applies
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Priority delivery reserves the tanker for your request.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <Button
                    variant="hero"
                    className="w-full h-14 rounded-xl text-base"
                    onClick={onPay}
                    disabled={isLoading}
                >
                    <CreditCard className="h-5 w-5 mr-2" />
                    {isLoading ? "Processing..." : `Pay ₦${price.toLocaleString()}`}
                </Button>

                <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl text-base"
                    onClick={onCancel}
                    disabled={isLoading}
                >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Before Payment
                </Button>

                <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground">
                        Payment is held securely until delivery is confirmed. Batch orders can be
                        cancelled freely before payment. Once you pay and join a batch, leaving the
                        batch means you may forfeit your payment.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentStep;