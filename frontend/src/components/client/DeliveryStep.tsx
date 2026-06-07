import {
  CheckCircle2,
  Copy,
  Droplets,
  Loader2,
  MapPin,
  Ruler,
  ShieldCheck,
  AlertCircle,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveDeliveryMap from "@/components/shared/LiveDeliveryMap";
import type { PriorityLiveResponse } from "@/lib/requests";
import type { BatchLiveResponse } from "@/lib/batches";
import { parseApiDate } from "@/lib/datetime";

interface DeliveryStepProps {
  requestMode: "batch" | "priority";
  otp: string;
  onConfirm: () => void;

  livePriorityRequest?: PriorityLiveResponse | null;
  livePriorityLoading?: boolean;
  livePriorityError?: string | null;
  liveBatch?: BatchLiveResponse | null;
  liveBatchLoading?: boolean;
  liveBatchError?: string | null;
  onCopyOtp?: () => void | Promise<void>;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = parseApiDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPriorityDeliveryState(priority?: PriorityLiveResponse | null) {
  if (!priority) {
    return {
      headline: "Preparing delivery confirmation",
      subtext: "We are waiting for live delivery updates.",
      arrived: false,
      measuring: false,
      awaitingOtp: false,
      completed: false,
    };
  }

  const status = priority.delivery_status;

  if (status === "delivered") {
    return {
      headline: "Delivery completed",
      subtext: "The backend has marked this delivery as completed.",
      arrived: true,
      measuring: false,
      awaitingOtp: false,
      completed: true,
    };
  }

  if (status === "awaiting_otp") {
    return {
      headline: "OTP required",
      subtext: "Measurement is complete. Share the OTP with the driver to finish delivery.",
      arrived: true,
      measuring: false,
      awaitingOtp: true,
      completed: false,
    };
  }

  if (status === "measuring") {
    return {
      headline: "Measurement in progress",
      subtext: "The driver is currently measuring your water delivery.",
      arrived: true,
      measuring: true,
      awaitingOtp: false,
      completed: false,
    };
  }

  if (status === "arrived") {
    return {
      headline: "Tanker arrived",
      subtext: "The tanker is at your location and delivery is starting.",
      arrived: true,
      measuring: false,
      awaitingOtp: false,
      completed: false,
    };
  }

  return {
    headline: "Delivery in progress",
    subtext: "We are waiting for the next delivery update.",
    arrived: false,
    measuring: false,
    awaitingOtp: false,
    completed: false,
  };
}


function getBatchDeliveryState(batch?: BatchLiveResponse | null) {
  if (!batch) {
    return {
      headline: "Preparing delivery confirmation",
      subtext: "We are waiting for your stop-level delivery updates.",
      arrived: false,
      measuring: false,
      awaitingOtp: false,
      completed: false,
    };
  }

  const status = batch.member_delivery_status;

  if (status === "delivered") {
    return {
      headline: "Delivery completed",
      subtext: "Your stop has been completed successfully.",
      arrived: true,
      measuring: false,
      awaitingOtp: false,
      completed: true,
    };
  }

  if (status === "awaiting_otp") {
    return {
      headline: "OTP required",
      subtext: "Measurement is complete. Share the OTP with the driver to finish your stop.",
      arrived: true,
      measuring: false,
      awaitingOtp: true,
      completed: false,
    };
  }

  if (status === "measuring") {
    return {
      headline: "Measurement in progress",
      subtext: "The driver is currently measuring your water delivery.",
      arrived: true,
      measuring: true,
      awaitingOtp: false,
      completed: false,
    };
  }

  if (status === "arrived") {
    return {
      headline: "Tanker arrived",
      subtext: "The tanker is at your location and delivery is starting.",
      arrived: true,
      measuring: false,
      awaitingOtp: false,
      completed: false,
    };
  }

  return {
    headline: "Delivery in progress",
    subtext: "We are waiting for the next update for your stop.",
    arrived: false,
    measuring: false,
    awaitingOtp: false,
    completed: false,
  };
}

export default function DeliveryStep({
  requestMode,
  otp,
  onConfirm,
  livePriorityRequest,
  livePriorityLoading = false,
  livePriorityError = null,
  liveBatch,
  liveBatchLoading = false,
  liveBatchError = null,
  onCopyOtp,
}: DeliveryStepProps) {
  const isPriority = requestMode === "priority";
  const priorityState = getPriorityDeliveryState(livePriorityRequest);
  const batchState = getBatchDeliveryState(liveBatch);
  const effectiveState = isPriority ? priorityState : batchState;

  const effectiveOtp = isPriority
    ? livePriorityRequest?.otp ?? otp
    : liveBatch?.member_delivery_code ?? liveBatch?.otp ?? otp;

  const isCompleted = isPriority
    ? effectiveState.completed
    : batchState.completed;

  const canConfirm = isPriority
    ? isCompleted || !!livePriorityRequest?.otp_verified || livePriorityRequest?.delivery_status === "delivered"
    : isCompleted || !!liveBatch?.otp_verified || liveBatch?.member_delivery_status === "delivered";

  const queuePosition = (() => {
    if (isPriority || !liveBatch) return null;
    const myStatus = liveBatch.member_delivery_status;
    if (!myStatus || myStatus === "delivered" || myStatus === "failed" || myStatus === "skipped") return null;
    const total = liveBatch.member_count ?? null;
    const position = liveBatch.stop_order ?? null;
    const stopsAhead = liveBatch.stops_ahead ?? null;
    if (myStatus === "arrived" || myStatus === "measuring" || myStatus === "awaiting_otp") {
      return { label: "You're up now", sublabel: null, position, total };
    }
    if (myStatus === "en_route") {
      return { label: "Driver is on the way to you", sublabel: null, position, total };
    }
    const sublabel = stopsAhead != null && stopsAhead > 0
      ? `${stopsAhead} stop${stopsAhead === 1 ? "" : "s"} ahead of you`
      : stopsAhead === 0
        ? "You're next"
        : null;
    return { label: "In delivery queue", sublabel, position, total };
  })();

  return (
    <div className="space-y-6">
      {queuePosition && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-lg">
              {queuePosition.position ?? "•"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{queuePosition.label}</p>
              <p className="text-xs text-muted-foreground">
                {queuePosition.sublabel
                  ? queuePosition.sublabel
                  : queuePosition.total
                    ? `Batch of ${queuePosition.total} stop${queuePosition.total === 1 ? "" : "s"}`
                    : "The driver will reach you shortly"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">
            {effectiveState.headline}
          </h2>
          <p className="text-sm text-muted-foreground">
            {effectiveState.subtext}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Delivery OTP</p>
            <p className="text-sm text-muted-foreground">
              Give this code to the driver only after measurement is complete.
            </p>
          </div>

          {onCopyOtp && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopyOtp}
              disabled={!effectiveOtp}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          )}
        </div>

        <div className="rounded-2xl border bg-muted/30 p-6 text-center">
          <p className="text-3xl font-bold tracking-[0.3em] text-foreground">
            {effectiveOtp || "----"}
          </p>
        </div>
      </div>

      {(isPriority || !!liveBatch) && (
        <>
          <LiveDeliveryMap
            title="Tanker location"
            subtitle="Shows where the driver is relative to your stop."
            driver={{
              label: isPriority
                ? (livePriorityRequest?.driver_name ?? "Tanker")
                : "Tanker",
              latitude: isPriority
                ? livePriorityRequest?.tanker_latitude
                : liveBatch?.tanker_latitude,
              longitude: isPriority
                ? livePriorityRequest?.tanker_longitude
                : liveBatch?.tanker_longitude,
              kind: "driver",
            }}
            customer={{
              label: "Your location",
              latitude: isPriority
                ? livePriorityRequest?.customer_latitude
                : liveBatch?.customer_latitude,
              longitude: isPriority
                ? livePriorityRequest?.customer_longitude
                : liveBatch?.customer_longitude,
              kind: "customer",
            }}
            lastUpdatedAt={
              isPriority
                ? livePriorityRequest?.last_location_update_at
                : liveBatch?.last_location_update_at
            }
          />
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">
                Live Delivery Status
              </h3>
              <p className="text-sm text-muted-foreground">
                This section reflects the backend delivery execution state.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {effectiveState.arrived ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                )}
                <p className="text-sm text-foreground">Driver arrived</p>
              </div>

              <div className="flex items-center gap-3">
                {effectiveState.measuring ||
                livePriorityRequest?.measurement_completed_at ||
                liveBatch?.measurement_completed_at ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                )}
                <p className="text-sm text-foreground">Measurement handled</p>
              </div>

              <div className="flex items-center gap-3">
                {effectiveState.awaitingOtp ||
                !!livePriorityRequest?.otp_verified ||
                !!liveBatch?.otp_verified ||
                livePriorityRequest?.delivery_status === "delivered" ||
                liveBatch?.member_delivery_status === "delivered" ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                )}
                <p className="text-sm text-foreground">OTP stage reached</p>
              </div>

              <div className="flex items-center gap-3">
                {effectiveState.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                )}
                <p className="text-sm text-foreground">Delivery completed</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4" />
                  Delivery Status
                </div>
                <p className="font-semibold text-foreground">
                  {isPriority ? (livePriorityRequest?.delivery_status ?? "Waiting") : (liveBatch?.member_delivery_status ?? "Waiting")}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  OTP Verified
                </div>
                <p className="font-semibold text-foreground">
                  {(isPriority ? livePriorityRequest?.otp_verified : liveBatch?.otp_verified) ? "Yes" : "No"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Droplets className="h-4 w-4" />
                  Planned Liters
                </div>
                <p className="font-semibold text-foreground">
                  {(isPriority ? livePriorityRequest?.planned_liters : liveBatch?.planned_liters) != null
                    ? `${Number(isPriority ? livePriorityRequest?.planned_liters : liveBatch?.planned_liters).toLocaleString()}L`
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Ruler className="h-4 w-4" />
                  Actual Delivered
                </div>
                <p className="font-semibold text-foreground">
                  {(isPriority ? livePriorityRequest?.actual_liters_delivered : liveBatch?.actual_liters_delivered) != null
                    ? `${Number(
                        isPriority
                          ? livePriorityRequest?.actual_liters_delivered
                          : liveBatch?.actual_liters_delivered
                      ).toLocaleString()}L`
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Arrived At
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDateTime(isPriority ? livePriorityRequest?.arrived_at : liveBatch?.arrived_at)}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Delivered At
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDateTime(isPriority ? livePriorityRequest?.delivered_at : liveBatch?.delivered_at)}
                </p>
              </div>
            </div>
          </div>

          {(isPriority ? livePriorityLoading : liveBatchLoading) && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm">Refreshing delivery status...</p>
              </div>
            </div>
          )}

          {(isPriority ? livePriorityError : liveBatchError) && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Could not refresh delivery status
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isPriority ? livePriorityError : liveBatchError}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!isPriority && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Important</p>
              <p className="text-sm text-muted-foreground">
                Confirm delivery only after the driver has measured the correct
                water quantity and you have shared the OTP.
              </p>
            </div>
          </div>
        </div>
      )}

      <Button
        type="button"
        className="w-full"
        onClick={onConfirm}
        disabled={!canConfirm}
      >
        {isCompleted ? "Continue" : "Confirm Delivery"}
      </Button>
    </div>
  );
}