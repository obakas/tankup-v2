import {
  CheckCircle2,
  Circle,
  Clock3,
  Droplets,
  Loader2,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import type { BatchLiveResponse } from "@/lib/batches";

interface BatchLifecycleCardProps {
  batch: BatchLiveResponse;
  isLoading?: boolean;
}

const orderedSteps = [
  "forming",
  "near_ready",
  "ready_for_assignment",
  "assigned",
  "queued",
  "loading",
  "delivering",
  "completed",
] as const;

const stepLabels: Record<string, string> = {
  forming: "Forming",
  near_ready: "Near Ready",
  ready_for_assignment: "Ready for Assignment",
  assigned: "Assigned",
  queued: "Queued",
  loading: "Loading",
  delivering: "Delivering",
  arrived: "Arrived",
  completed: "Completed",
  expired: "Expired",
};

function getCurrentIndex(status: string) {
  if (status === "arrived") {
    return orderedSteps.indexOf("delivering");
  }

  if (status === "expired") {
    return -1;
  }

  return orderedSteps.indexOf(status as (typeof orderedSteps)[number]);
}

function getHint(batch: BatchLiveResponse) {
  const remaining = Math.max(0, batch.target_volume - batch.current_volume);

  switch (batch.status) {
    case "forming":
      return `Waiting for more nearby members. ${remaining.toLocaleString()}L still needed.`;
    case "near_ready":
      return `Almost there. Only ${remaining.toLocaleString()}L left before dispatch.`;
    case "ready_for_assignment":
      return "This batch is ready and waiting for tanker assignment.";
    case "assigned":
      return "A tanker has been assigned to this batch.";
    case "queued":
      return "The tanker is queued to load water.";
    case "loading":
      return "The tanker is currently loading water.";
    case "delivering":
      return "Your tanker is on the way.";
    case "arrived":
      return "The tanker has arrived. Share OTP only after measurement is complete.";
    case "completed":
      return "All required stops in this batch have been resolved.";
    case "expired":
      return "This batch expired before dispatch and may be eligible for refund.";
    default:
      return "Batch status updated.";
  }
}

function getStatusBadge(status: string) {
  if (status === "expired") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-3 py-1 text-xs font-medium text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        Expired
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Completed
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
      <Clock3 className="h-3.5 w-3.5" />
      {stepLabels[status] ?? status}
    </div>
  );
}

export function BatchLifecycleCard({
  batch,
  isLoading = false,
}: BatchLifecycleCardProps) {
  const currentIndex = getCurrentIndex(batch.status);
  const remaining = Math.max(0, batch.target_volume - batch.current_volume);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground">Batch Progress</h3>
          <p className="text-sm text-muted-foreground">{getHint(batch)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {getStatusBadge(batch.status)}
        </div>
      </div>

      {batch.status !== "expired" && (
        <div className="space-y-3">
          {orderedSteps.map((step, index) => {
            const isComplete = currentIndex >= index;
            const isCurrent =
              batch.status === step ||
              (batch.status === "arrived" && step === "delivering");

            return (
              <div key={step} className="flex items-center gap-3">
                <div className="shrink-0">
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${isCurrent
                      ? "font-semibold text-foreground"
                      : isComplete
                        ? "text-foreground"
                        : "text-muted-foreground"
                      }`}
                  >
                    {stepLabels[step]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {batch.status === "expired" && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            This batch expired before a tanker was dispatched.
          </p>

          {batch.refund_eligible && (
            <p className="mt-2 text-sm text-muted-foreground">
              Your membership appears eligible for refund.
            </p>
          )}

          {batch.refund_status && (
            <p className="mt-2 text-sm text-muted-foreground">
              Refund status: <span className="font-medium">{batch.refund_status}</span>
            </p>
          )}
        </div>
      )}

    
      <div className="grid gap-3 sm:grid-cols-2">
        {/* 1. Volume */}
        <div className="rounded-xl border p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Droplets className="h-4 w-4" />
            Volume
          </div>

          <p className="text-2xl font-bold text-foreground">
            {Math.round(batch.progress_percent)}%
          </p>

          <p className="text-sm text-muted-foreground">
            {batch.current_volume.toLocaleString()}L /{" "}
            {batch.target_volume.toLocaleString()}L filled
          </p>

          <p className="text-sm text-muted-foreground">
            {remaining.toLocaleString()}L remaining
          </p>
        </div>

        {/* 2. Tanker */}
        <div className="rounded-xl border p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Truck className="h-4 w-4" />
            Tanker
          </div>

          {batch.tanker_id ? (
            <>
              <p className="font-semibold text-foreground">
                Tanker #{batch.tanker_id}
              </p>
              <p className="text-sm text-muted-foreground">
                Driver: {batch.driver_name ?? "Assigned"}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tanker assigned yet
            </p>
          )}
        </div>

        {/* 3. Members */}
        <div className="rounded-xl border p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4" />
            Members
          </div>

          <p className="text-2xl font-bold text-foreground">
            {batch.member_count}
          </p>

          <p className="text-sm text-muted-foreground">
            {batch.member_count === 1
              ? "Active paid member currently in this batch"
              : "Active paid members currently in this batch"}
          </p>
        </div>

        {/* 4. Your Membership */}
        <div className="rounded-xl border p-4">
          <div className="mb-2 text-sm font-medium text-foreground">
            Your Membership
          </div>

          <p className="text-sm text-muted-foreground">
            Status:{" "}
            <span className="font-medium">
              {batch.member_status ?? "Unknown"}
            </span>
          </p>

          <p className="text-sm text-muted-foreground">
            Payment:{" "}
            <span className="font-medium">
              {batch.member_payment_status ?? "Unknown"}
            </span>
          </p>

          {typeof batch.refund_eligible === "boolean" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Refund eligible:{" "}
              <span className="font-medium">
                {batch.refund_eligible ? "Yes" : "No"}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}