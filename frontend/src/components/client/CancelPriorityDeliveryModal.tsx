import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIORITY_FULL_TANKER_PRICE } from "@/constants/water";

interface CancelPriorityDeliveryModalProps {
  stage: "pre_loading" | "en_route" | "arrived" | "partial_delivery" | null;
  refundPct: number | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function stageLabel(stage: string | null): string {
  switch (stage) {
    case "pre_loading":
      return "Tanker assigned but not yet loaded";
    case "en_route":
      return "Tanker en route to your location";
    case "arrived":
      return "Tanker has arrived at your location";
    case "partial_delivery":
      return "Water partially pumped";
    default:
      return "Active delivery";
  }
}

function refundDescription(stage: string | null, refundPct: number | null): string {
  if (stage === "pre_loading") {
    return "Because the tanker hasn't loaded yet, you will receive a 50% refund.";
  }
  if (stage === "partial_delivery" && refundPct != null && refundPct > 0) {
    const pct = Math.round(refundPct * 100);
    return `Water was partially pumped. You will receive a ${pct}% refund proportional to the undelivered volume.`;
  }
  return "The tanker has already committed to your trip. No refund will be issued.";
}

export default function CancelPriorityDeliveryModal({
  stage,
  refundPct,
  isLoading,
  onClose,
  onConfirm,
}: CancelPriorityDeliveryModalProps) {
  const refundAmount =
    refundPct != null && refundPct > 0
      ? Math.round(PRIORITY_FULL_TANKER_PRICE * refundPct)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Cancel Priority Delivery?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {stageLabel(stage)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-foreground">Refund</p>
            <p className="text-sm font-bold text-foreground">
              {refundAmount > 0 ? `₦${refundAmount.toLocaleString()}` : "None"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {refundDescription(stage, refundPct)}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={onClose}
            disabled={isLoading}
          >
            Keep Delivery
          </Button>
          <Button
            variant="destructive"
            className="flex-1 h-12 rounded-xl"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Cancelling..." : "Cancel Delivery"}
          </Button>
        </div>
      </div>
    </div>
  );
}
