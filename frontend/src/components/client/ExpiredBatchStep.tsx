import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft, BadgeCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BatchLiveResponse } from "@/lib/batches";
import { requestBatchMemberRefund } from "@/lib/refunds";
import { toast } from "sonner";

interface ExpiredBatchStepProps {
  liveBatch: BatchLiveResponse | null;
  memberId: number | null;
  onBackHome: () => void;
  refreshLiveBatch: () => Promise<void> | void;
}

function formatMoney(amount?: number | null) {
  if (amount === null || amount === undefined) return "—";
  return `₦${Number(amount).toLocaleString()}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function getRefundMessage(liveBatch: BatchLiveResponse | null) {
  if (!liveBatch) {
    return "This batch expired before dispatch.";
  }

  if (liveBatch.refund_status === "refunded") {
    return "Your refund has already been processed.";
  }

  if (liveBatch.refund_status === "processing") {
    return "Your refund is currently being processed.";
  }

  if (liveBatch.refund_eligible) {
    return "This batch expired before dispatch. You appear eligible for a refund.";
  }

  return "This batch expired before dispatch. Refund may not be available for this membership.";
}

export default function ExpiredBatchStep({
  liveBatch,
  memberId,
  onBackHome,
  refreshLiveBatch,
}: ExpiredBatchStepProps) {
  const [isRequestingRefund, setIsRequestingRefund] = useState(false);

  const refundEligible = !!liveBatch?.refund_eligible;
  const refundStatus = liveBatch?.refund_status ?? null;
  const refundAmount = liveBatch?.refund_amount ?? null;
  const refundedAt = liveBatch?.refunded_at ?? null;
  const refundReference = liveBatch?.refund_reference ?? null;

  const canRequestRefund = useMemo(() => {
    if (!memberId) return false;
    if (!refundEligible) return false;
    if (refundStatus === "refunded") return false;
    if (refundStatus === "processing") return false;
    return true;
  }, [memberId, refundEligible, refundStatus]);

  const handleRefundRequest = async () => {
    if (!memberId) {
      toast.error("No batch membership found for refund");
      return;
    }

    try {
      setIsRequestingRefund(true);

      const response = await requestBatchMemberRefund(memberId);

      toast.success(
        (response as { message?: string })?.message || "Refund request submitted successfully"
      );

      await Promise.resolve(refreshLiveBatch());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to request refund";
      toast.error(message);
    } finally {
      setIsRequestingRefund(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Batch Expired</h2>
            <p className="text-sm text-muted-foreground">
              {getRefundMessage(liveBatch)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            What this means
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your batch did not reach dispatch successfully, so this delivery could
            not continue under the shared tanker flow.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Batch Status
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {liveBatch?.status ?? "expired"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Refund Eligible
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {refundEligible ? "Yes" : "No"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Refund Status
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {refundStatus ?? "Not requested"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Refund Amount
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {formatMoney(refundAmount)}
            </p>
          </div>
        </div>

        {(refundReference || refundedAt) && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Refund Reference
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {refundReference ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Refunded At
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDateTime(refundedAt)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {refundStatus === "refunded" && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Refund completed</p>
              <p className="text-sm text-muted-foreground">
                Your refund has already been processed. You can return home and
                start a new request anytime.
              </p>
            </div>
          </div>
        </div>
      )}

      {refundStatus === "processing" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300 animate-spin" />
            <div>
              <p className="font-medium text-foreground">Refund in progress</p>
              <p className="text-sm text-muted-foreground">
                Your refund request is being processed. Refreshing the batch state
                should show the latest update.
              </p>
            </div>
          </div>
        </div>
      )}

      {!refundEligible && refundStatus !== "refunded" && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Refund unavailable</p>
              <p className="text-sm text-muted-foreground">
                This membership is currently not marked as refund-eligible by the backend.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Button
          type="button"
          className="w-full"
          onClick={handleRefundRequest}
          disabled={!canRequestRefund || isRequestingRefund}
        >
          {isRequestingRefund ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Requesting Refund...
            </>
          ) : (
            "Request Refund"
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => Promise.resolve(refreshLiveBatch())}
          disabled={isRequestingRefund}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Status
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onBackHome}
          disabled={isRequestingRefund}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back Home
        </Button>
      </div>
    </div>
  );
}