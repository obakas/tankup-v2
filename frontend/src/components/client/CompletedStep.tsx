import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatScheduledDateTime } from "@/lib/utils";
import type { RequestMode } from "@/types/client";

interface CompletedStepProps {
  selectedSize: number | null;
  requestMode: RequestMode;
  priorityMode: "asap" | "scheduled";
  scheduledFor: string;
  price: number;
  otp: string;
  onBackHome: () => void;
}

const CompletedStep = ({
  selectedSize,
  requestMode,
  priorityMode,
  scheduledFor,
  price,
  otp,
  onBackHome,
}: CompletedStepProps) => {
  return (
    <div className="space-y-6 text-center py-10">
      <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-12 w-12 text-success" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">Water Delivered!</h2>
        <p className="text-muted-foreground mt-2">
          {selectedSize?.toLocaleString()}L has been delivered to your tank
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 text-left">
        <h3 className="font-semibold text-foreground mb-3">Summary</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery type</span>
            <span className="text-foreground font-medium">
              {requestMode === "batch" ? "Batch Saver" : "Priority Delivery"}
            </span>
          </div>

          {requestMode === "priority" && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Priority timing</span>
              <span className="text-foreground font-medium text-right">
                {priorityMode === "asap"
                  ? "ASAP (earliest available dispatch)"
                  : scheduledFor
                  ? formatScheduledDateTime(scheduledFor)
                  : "Not selected"}
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Water delivered</span>
            <span className="text-foreground font-medium">
              {selectedSize?.toLocaleString()}L
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount paid</span>
            <span className="text-foreground font-medium">
              ₦{price.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery OTP</span>
            <span className="text-foreground font-medium">{otp}</span>
          </div>
        </div>
      </div>

      <Button
        variant="hero"
        className="w-full h-14 rounded-xl text-base"
        onClick={onBackHome}
      >
        Back to Home
      </Button>
    </div>
  );
};

export default CompletedStep;