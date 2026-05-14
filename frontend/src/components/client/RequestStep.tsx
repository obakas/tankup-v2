import { Droplets, Users, Zap, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TANK_SIZES,
  BATCH_PRICE_PER_LITER,
  PRIORITY_FULL_TANKER_PRICE,
  PLATFORM_BATCH_COMMISSION_RATE,
  PLATFORM_PRIORITY_COMMISSION_RATE,
} from "@/constants/water";
import type { RequestMode } from "@/types/client";
import { formatScheduledDateTime } from "@/lib/utils";

interface RequestStepProps {
  requestMode: RequestMode;
  selectedSize: number | null;
  canContinueToPayment: boolean;
  onSelectMode: (mode: RequestMode) => void;
  onSelectSize: (size: number) => void;
  onContinue: () => void;
  onCancel: () => void;

  priorityMode: "asap" | "scheduled";
  scheduledFor: string;
  onSelectPriorityMode: (mode: "asap" | "scheduled") => void;
  onSetScheduledFor: (value: string) => void;
}

const RequestStep = ({
  requestMode,
  selectedSize,
  canContinueToPayment,
  onSelectMode,
  onSelectSize,
  onContinue,
  onCancel,
  priorityMode,
  scheduledFor,
  onSelectPriorityMode,
  onSetScheduledFor,
}: RequestStepProps) => {
  const price =
    requestMode === "priority"
      ? PRIORITY_FULL_TANKER_PRICE * PLATFORM_PRIORITY_COMMISSION_RATE +
      PRIORITY_FULL_TANKER_PRICE
      : selectedSize
        ? selectedSize * BATCH_PRICE_PER_LITER * PLATFORM_BATCH_COMMISSION_RATE +
        selectedSize * BATCH_PRICE_PER_LITER
        : 0;

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Droplets className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Choose your delivery option
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick the plan that works best for you
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => onSelectMode("batch")}
          className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-200 ${requestMode === "batch"
            ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
            : "border-border bg-card hover:border-primary/30"
            }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Batch Saver</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  Lower Cost
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Join nearby customers in your area and pay less. Delivery starts
                when the batch is filled.
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onSelectMode("priority")}
          className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-200 ${requestMode === "priority"
            ? "border-warning bg-warning/5 shadow-md"
            : "border-border bg-card hover:border-warning/30"
            }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-warning" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  Priority Delivery
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
                  Premium
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Get faster delivery with ASAP dispatch or choose an exact delivery
                time. Full tanker payment required.
              </p>
            </div>
          </div>
        </button>
      </div>

      {requestMode === "priority" && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">
              Choose delivery timing
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Priority delivery requires either ASAP dispatch or an exact delivery
              time.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                onSelectPriorityMode("asap");
                onSetScheduledFor("");
              }}
              className={`rounded-lg border p-3 text-left text-sm transition-all ${priorityMode === "asap"
                ? "border-warning bg-warning/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-warning/30"
                }`}
            >
              <div className="font-medium">ASAP</div>
              <p className="mt-1 text-xs text-muted-foreground">
                We calculate the earliest realistic delivery time after loading
                and dispatch.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSelectPriorityMode("scheduled")}
              className={`rounded-lg border p-3 text-left text-sm transition-all ${priorityMode === "scheduled"
                ? "border-warning bg-warning/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-warning/30"
                }`}
            >
              <div className="font-medium">Schedule Time</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose an exact date and time for delivery.
              </p>
            </button>
          </div>

          {priorityMode === "asap" && (
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
              <p className="text-sm font-medium text-foreground">
                ASAP includes a realistic loading and dispatch buffer
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tankers usually load after a request is placed, so the system
                calculates the earliest realistic delivery time.
              </p>
            </div>
          )}

          {priorityMode === "scheduled" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Select exact delivery date and time
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => onSetScheduledFor(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-warning"
              />
              <p className="text-xs text-muted-foreground">
                Choose a realistic time that gives enough room for loading and
                movement.
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="mb-3">
          <h3 className="font-semibold text-foreground">
            How much water do you need?
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select your tank size
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {TANK_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => onSelectSize(size)}
              className={`rounded-xl border-2 p-4 text-center transition-all duration-200 active:scale-95 ${selectedSize === size
                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                : "border-border bg-card hover:border-primary/30"
                }`}
            >
              <span className="text-2xl font-bold text-foreground">
                {Number(size / 1000).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                k
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {size.toLocaleString()} Liters
              </p>
            </button>
          ))}
        </div>
      </div>

      {selectedSize && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery type</span>
            <span className="font-medium text-foreground">
              {requestMode === "batch" ? "Batch Saver" : "Priority Delivery"}
            </span>
          </div>

          {requestMode === "priority" && (
            <div className="flex justify-between text-sm">
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

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Water quantity</span>
            <span className="font-medium text-foreground">
              {selectedSize.toLocaleString()}L
            </span>
          </div>

          {requestMode === "batch" ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Platform Commission Rate
              </span>
              <span className="font-medium text-foreground">
                {PLATFORM_BATCH_COMMISSION_RATE}%
              </span>
            </div>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Platform Commission Rate
              </span>
              <span className="font-medium text-foreground">
                {PLATFORM_PRIORITY_COMMISSION_RATE}%
              </span>
            </div>
          )}

          {requestMode === "batch" ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-medium text-foreground">
                ₦{BATCH_PRICE_PER_LITER}/liter
              </span>
            </div>
          ) : (
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
              <p className="text-sm font-medium text-foreground">
                Priority reserves the whole tanker
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You pay the full tanker fee even if your tank size is smaller.
              </p>
            </div>
          )}

          <div className="border-t border-border pt-3 flex justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-foreground text-xl">
              ₦{price.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Button
          variant="hero"
          className="w-full h-14 rounded-xl text-base"
          disabled={!canContinueToPayment}
          onClick={onContinue}
        >
          Continue to Payment
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl text-base"
          onClick={onCancel}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Cancel Request
        </Button>
      </div>
    </div>
  );
};

export default RequestStep;