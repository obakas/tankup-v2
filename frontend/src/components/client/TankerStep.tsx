import {
  Loader2,
  Truck,
  Phone,
  MapPin,
  Clock3,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveDeliveryMap from "@/components/shared/LiveDeliveryMap";
import type { BatchLiveResponse } from "@/lib/batches";
import type { PriorityLiveResponse } from "@/lib/requests";

interface TankerStepProps {
  requestMode: "batch" | "priority";
  priorityMode: "asap" | "scheduled";
  scheduledFor: string;
  selectedSize: number;
  onArrived: () => void;

  liveBatch?: BatchLiveResponse | null;
  liveBatchLoading?: boolean;
  liveBatchError?: string | null;

  livePriorityRequest?: PriorityLiveResponse | null;
  livePriorityLoading?: boolean;
  livePriorityError?: string | null;
  refreshLivePriorityRequest?: () => Promise<void> | void;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function getBatchTankerState(batch?: BatchLiveResponse | null) {
  if (!batch) {
    return {
      headline: "Waiting for tanker assignment",
      subtext: "We are still matching your batch with the best available tanker.",
      tankerId: null,
      driverName: null,
      driverPhone: null,
      tankerStatus: null,
      deliveryStatus: null,
      arrived: false,
    };
  }

  const stopStatus = batch.member_delivery_status;

  if (["arrived", "measuring", "awaiting_otp", "delivered"].includes(stopStatus ?? "")) {
    return {
      headline: stopStatus === "delivered" ? "Delivery completed" : "Tanker arrived",
      subtext:
        stopStatus === "delivered"
          ? "Your stop has already been completed."
          : stopStatus === "awaiting_otp"
            ? "Measurement is done. Share your OTP with the driver to finish this stop."
            : stopStatus === "measuring"
              ? "The driver is measuring your water delivery right now."
              : "The tanker has arrived at your stop.",
      tankerId: batch.tanker_id ?? null,
      driverName: batch.driver_name ?? null,
      driverPhone: batch.tanker_phone ?? null,
      tankerStatus: batch.tanker_status ?? batch.status ?? null,
      deliveryStatus: stopStatus ?? null,
      arrived: true,
    };
  }

  if (batch.status === "assigned") {
    return {
      headline: "Tanker assigned",
      subtext: "A tanker has been assigned to your batch.",
      tankerId: batch.tanker_id ?? null,
      driverName: batch.driver_name ?? null,
      driverPhone: batch.tanker_phone ?? null,
      tankerStatus: "assigned",
      deliveryStatus: stopStatus ?? null,
      arrived: false,
    };
  }

  if (batch.status === "loading") {
    return {
      headline: "Tanker loading",
      subtext: "The tanker is currently loading water for delivery.",
      tankerId: batch.tanker_id ?? null,
      driverName: batch.driver_name ?? null,
      driverPhone: batch.tanker_phone ?? null,
      tankerStatus: "loading",
      deliveryStatus: stopStatus ?? null,
      arrived: false,
    };
  }

  if (batch.status === "delivering" || stopStatus === "en_route" || stopStatus === "pending") {
    return {
      headline: "Tanker en route",
      subtext: "Your delivery is on the way.",
      tankerId: batch.tanker_id ?? null,
      driverName: batch.driver_name ?? null,
      driverPhone: batch.tanker_phone ?? null,
      tankerStatus: batch.tanker_status ?? "delivering",
      deliveryStatus: stopStatus ?? "en route",
      arrived: false,
    };
  }

  if (batch.status === "completed") {
    return {
      headline: "Delivery completed",
      subtext: "This batch delivery has already been completed.",
      tankerId: batch.tanker_id ?? null,
      driverName: batch.driver_name ?? null,
      driverPhone: batch.tanker_phone ?? null,
      tankerStatus: "completed",
      deliveryStatus: "delivered",
      arrived: true,
    };
  }

  return {
    headline: "Waiting for tanker update",
    subtext: "We are syncing the latest tanker status.",
    tankerId: batch.tanker_id ?? null,
    driverName: batch.driver_name ?? null,
    driverPhone: batch.tanker_phone ?? null,
    tankerStatus: batch.tanker_status ?? batch.status ?? null,
    deliveryStatus: stopStatus ?? null,
    arrived: false,
  };
}

function getPriorityTankerState(priority?: PriorityLiveResponse | null) {
  if (!priority) {
    return {
      headline: "Preparing your priority delivery",
      subtext: "We are waiting for tanker assignment.",
      tankerId: null,
      driverName: null,
      driverPhone: null,
      tankerStatus: null,
      deliveryStatus: null,
      arrived: false,
    };
  }

  const deliveryStatus = priority.delivery_status;
  const tankerStatus = priority.tanker_status;

  if (
    deliveryStatus === "arrived" ||
    deliveryStatus === "measuring" ||
    deliveryStatus === "awaiting_otp"
  ) {
    return {
      headline: "Tanker arrived",
      subtext: "Your tanker is at the delivery point.",
      tankerId: priority.tanker_id,
      driverName: priority.driver_name,
      driverPhone: priority.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: true,
    };
  }

  if (deliveryStatus === "delivered") {
    return {
      headline: "Delivery completed",
      subtext: "Your priority delivery has been completed.",
      tankerId: priority.tanker_id,
      driverName: priority.driver_name,
      driverPhone: priority.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: true,
    };
  }

  if (deliveryStatus === "en_route" || tankerStatus === "delivering") {
    return {
      headline: "Tanker en route",
      subtext: "Your priority delivery is on the way.",
      tankerId: priority.tanker_id,
      driverName: priority.driver_name,
      driverPhone: priority.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: false,
    };
  }

  if (tankerStatus === "loading") {
    return {
      headline: "Tanker loading",
      subtext: "The tanker is loading water for your priority request.",
      tankerId: priority.tanker_id,
      driverName: priority.driver_name,
      driverPhone: priority.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: false,
    };
  }

  if (tankerStatus === "assigned" || priority.tanker_id) {
    return {
      headline: "Tanker assigned",
      subtext: "A tanker has been assigned to your request.",
      tankerId: priority.tanker_id,
      driverName: priority.driver_name,
      driverPhone: priority.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: false,
    };
  }

  return {
    headline: "Waiting for tanker assignment",
    subtext: "We are still matching your priority request to a tanker.",
    tankerId: null,
    driverName: null,
    driverPhone: null,
    tankerStatus,
    deliveryStatus,
    arrived: false,
  };
}

export default function TankerStep({
  requestMode,
  priorityMode,
  scheduledFor,
  selectedSize,
  onArrived,

  liveBatch,
  liveBatchLoading = false,
  liveBatchError = null,

  livePriorityRequest,
  livePriorityLoading = false,
  livePriorityError = null,
  refreshLivePriorityRequest,
}: TankerStepProps) {
  const isPriority = requestMode === "priority";

  const loading = isPriority ? livePriorityLoading : liveBatchLoading;
  const error = isPriority ? livePriorityError : liveBatchError;

  const state = isPriority
    ? getPriorityTankerState(livePriorityRequest)
    : getBatchTankerState(liveBatch);

  const canContinue =
    state.arrived ||
    state.deliveryStatus === "measuring" ||
    state.deliveryStatus === "awaiting_otp" ||
    state.deliveryStatus === "delivered";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">{state.headline}</h2>
          <p className="text-sm text-muted-foreground">{state.subtext}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Delivery Type
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {requestMode === "priority" ? "Priority Delivery" : "Batch Saver"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Quantity
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {selectedSize.toLocaleString()}L
            </p>
          </div>

          {requestMode === "priority" && (
            <>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Priority Mode
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {priorityMode === "asap" ? "ASAP" : "Scheduled"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Scheduled For
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {priorityMode === "scheduled"
                    ? formatDateTime(scheduledFor)
                    : "Immediate dispatch"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Truck className="mt-0.5 h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Tanker Details</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tanker ID
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {state.tankerId ? `#${state.tankerId}` : "Not assigned yet"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tanker Status
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {state.tankerStatus ?? "Waiting"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Driver Name
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {state.driverName ?? "Pending assignment"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Delivery Status
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {state.deliveryStatus ?? "Preparing"}
                </p>
              </div>
            </div>

            {state.driverPhone && (
              <div className="mt-4 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Driver Contact</p>
                    <p className="text-sm text-muted-foreground">{state.driverPhone}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          {loading ? (
            <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-muted-foreground" />
          ) : canContinue ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
          ) : (
            <Clock3 className="mt-0.5 h-5 w-5 text-muted-foreground" />
          )}

          <div>
            <p className="font-medium text-foreground">Live Status</p>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Refreshing tanker status..."
                : canContinue
                ? "The tanker has reached the stage where you can continue to delivery."
                : "We are still waiting for the next live update."}
            </p>
          </div>
        </div>

        {state.arrived && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Tanker has arrived</p>
                <p className="text-sm text-muted-foreground">
                  You can now continue to the delivery step.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  Could not refresh tanker status
                </p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Button type="button" className="w-full" onClick={onArrived} disabled={!canContinue}>
          Continue to Delivery
        </Button>

        {isPriority && refreshLivePriorityRequest && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => Promise.resolve(refreshLivePriorityRequest())}
            disabled={loading}
          >
            Refresh Status
          </Button>
        )}
      </div>
    </div>
  );
}