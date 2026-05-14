import { AlertTriangle, CheckCircle2, RefreshCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RequestMode } from "@/types/client";

interface DeliveryOutcomeStepProps {
  status: "failed" | "partial";
  requestMode: RequestMode;
  selectedSize: number | null;
  price: number;
  failureReason?: string | null;
  refundEligible?: boolean | null;
  refundStatus?: string | null;
  actualLitersDelivered?: number | null;
  plannedLiters?: number | null;
  onBackHome: () => void;
}

function titleFor(status: "failed" | "partial") {
  return status === "partial" ? "Delivery Resolved with Issues" : "Delivery Failed";
}

function bodyFor(status: "failed" | "partial", requestMode: RequestMode) {
  if (status === "partial") {
    return requestMode === "batch"
      ? "Some stops in this batch were delivered and some were not. The job has been closed so it does not hang forever."
      : "Part of this delivery was completed, but it did not finish cleanly. The job has still been resolved."
  }

  return requestMode === "batch"
    ? "This batch delivery could not be completed successfully."
    : "This priority delivery could not be completed successfully.";
}

export default function DeliveryOutcomeStep({
  status,
  requestMode,
  selectedSize,
  price,
  failureReason,
  refundEligible,
  refundStatus,
  actualLitersDelivered,
  plannedLiters,
  onBackHome,
}: DeliveryOutcomeStepProps) {
  const isPartial = status === "partial";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isPartial ? "bg-amber-500/10" : "bg-destructive/10"}`}>
          {isPartial ? (
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          ) : (
            <RefreshCcw className="h-8 w-8 text-destructive" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-foreground">{titleFor(status)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{bodyFor(status, requestMode)}</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivery Type</p>
            <p className="mt-1 font-semibold text-foreground capitalize">{requestMode}</p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Amount</p>
            <p className="mt-1 font-semibold text-foreground">₦{price.toLocaleString()}</p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Requested Volume</p>
            <p className="mt-1 font-semibold text-foreground">
              {selectedSize ? `${selectedSize.toLocaleString()}L` : plannedLiters ? `${Number(plannedLiters).toLocaleString()}L` : "—"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivered Volume</p>
            <p className="mt-1 font-semibold text-foreground">
              {actualLitersDelivered !== null && actualLitersDelivered !== undefined
                ? `${Number(actualLitersDelivered).toLocaleString()}L`
                : "—"}
            </p>
          </div>
        </div>

        {failureReason ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-foreground">Why this happened</p>
                <p className="text-sm text-muted-foreground">{failureReason}</p>
              </div>
            </div>
          </div>
        ) : null}

        {(refundEligible !== null && refundEligible !== undefined) || refundStatus ? (
          <div className="rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Refund status</p>
                <p className="text-sm text-muted-foreground">
                  {refundStatus
                    ? refundStatus.replace(/_/g, " ")
                    : refundEligible
                      ? "This order looks eligible for refund handling."
                      : "No automatic refund is currently attached to this outcome."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-dashed p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">What next?</p>
              <p className="text-sm text-muted-foreground">
                Go back home, check your order history, and contact support if this outcome needs manual review.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Button className="w-full" onClick={onBackHome}>Back Home</Button>
    </div>
  );
}
