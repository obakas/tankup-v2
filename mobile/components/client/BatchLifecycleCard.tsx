import { View, Text } from "react-native";
import {
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export type BatchLiveResponse = {
  batch_id?: number | null;
  status?: string | null;
  current_volume?: number | null;
  target_volume?: number | null;
  progress_percent?: number | null;
  member_count?: number | null;

  tanker_id?: number | null;
  driver_name?: string | null;
  tanker_plate_number?: string | null;

  tanker_status?: string | null;
  tanker_phone?: string | null;
  tanker_latitude?: number | null;
  tanker_longitude?: number | null;
  last_location_update_at?: string | null;

  customer_latitude?: number | null;
  customer_longitude?: number | null;

  member_status?: string | null;
  member_payment_status?: string | null;
  member_delivery_code?: string | null;
  delivery_code?: string | null;
  otp?: string | null;
  refund_eligible?: boolean | null;
  refund_status?: string | null;
};

type Props = {
  batch: BatchLiveResponse;
  isLoading?: boolean;
};

const orderedSteps = [
  "forming",
  "near_ready",
  "ready_for_assignment",
  "assigned",
  "loading",
  "delivering",
  "completed",
] as const;

const stepLabels: Record<string, string> = {
  forming: "Forming",
  near_ready: "Near Ready",
  ready_for_assignment: "Ready for Assignment",
  assigned: "Assigned",
  loading: "Loading",
  delivering: "Delivering",
  arrived: "Arrived",
  completed: "Completed",
  expired: "Expired",
  failed: "Failed",
  partially_completed: "Partially Completed",
};

function n(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getCurrentIndex(status?: string | null) {
  if (status === "arrived") return orderedSteps.indexOf("delivering");
  if (status === "expired" || status === "failed") return -1;
  return orderedSteps.indexOf(status as (typeof orderedSteps)[number]);
}

function getHint(batch: BatchLiveResponse) {
  const status = batch.status ?? "forming";
  const remaining = Math.max(0, n(batch.target_volume) - n(batch.current_volume));

  switch (status) {
    case "forming":
      return `Waiting for more nearby members. ${remaining.toLocaleString()}L still needed.`;
    case "near_ready":
      return `Almost there. Only ${remaining.toLocaleString()}L left before dispatch.`;
    case "ready_for_assignment":
      return "This batch is ready and waiting for tanker assignment.";
    case "assigned":
      return "A tanker has been assigned to this batch.";
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

function StatusBadge({ status }: { status?: string | null }) {
  const { theme } = useAppTheme();

  if (status === "expired" || status === "failed") {
    return (
      <View
        className="flex-row items-center gap-2 rounded-full px-3 py-1"
        style={{ backgroundColor: theme.destructiveSoft, borderWidth: 1, borderColor: theme.destructive + "66" }}
      >
        <XCircle color={theme.destructive} size={14} />
        <Text className="text-xs font-semibold" style={{ color: theme.destructive }}>
          {stepLabels[status] ?? "Expired"}
        </Text>
      </View>
    );
  }

  if (status === "completed") {
    return (
      <View
        className="flex-row items-center gap-2 rounded-full px-3 py-1"
        style={{ backgroundColor: theme.primarySoft, borderWidth: 1, borderColor: theme.primary + "4d" }}
      >
        <CheckCircle2 color={theme.primary} size={14} />
        <Text className="text-xs font-semibold" style={{ color: theme.primary }}>Completed</Text>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center gap-2 rounded-full px-3 py-1"
      style={{ backgroundColor: theme.muted, borderWidth: 1, borderColor: theme.border }}
    >
      <Clock3 color={theme.mutedForeground} size={14} />
      <Text className="text-xs font-semibold" style={{ color: theme.foreground }}>
        {stepLabels[status ?? "forming"] ?? status ?? "Forming"}
      </Text>
    </View>
  );
}

export function BatchLifecycleCard({ batch, isLoading = false }: Props) {
  const { theme } = useAppTheme();
  const status = batch.status ?? "forming";
  const currentIndex = getCurrentIndex(status);

  return (
    <View
      className="rounded-2xl p-5 gap-5"
      style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-2">
          <Text className="text-lg font-bold" style={{ color: theme.foreground }}>Batch Lifecycle</Text>
          <Text className="text-sm leading-5" style={{ color: theme.mutedForeground }}>{getHint(batch)}</Text>
        </View>

        <View className="items-end gap-2">
          {isLoading && <Loader2 color={theme.mutedForeground} size={16} />}
          <StatusBadge status={status} />
        </View>
      </View>

      {status !== "expired" && status !== "failed" && (
        <View className="gap-3">
          {orderedSteps.map((step, index) => {
            const isComplete = currentIndex >= index;
            const isCurrent = status === step || (status === "arrived" && step === "delivering");

            return (
              <View key={step} className="flex-row items-center gap-3">
                {isComplete ? (
                  <CheckCircle2 color={theme.primary} size={20} />
                ) : (
                  <Circle color={theme.mutedForeground} size={20} />
                )}

                <Text
                  className="flex-1 text-sm"
                  style={{
                    color: isCurrent || isComplete ? theme.foreground : theme.mutedForeground,
                    fontWeight: isCurrent ? "700" : "400",
                  }}
                >
                  {stepLabels[step]}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {(status === "expired" || status === "failed") && (
        <View
          className="rounded-xl p-4"
          style={{ backgroundColor: theme.destructiveSoft, borderWidth: 1, borderColor: theme.destructive + "66" }}
        >
          <Text className="text-sm font-semibold" style={{ color: theme.destructive }}>
            {status === "failed"
              ? "This batch could not be completed successfully."
              : "This batch expired before a tanker was dispatched."}
          </Text>
          {batch.refund_eligible && (
            <Text className="mt-2 text-sm" style={{ color: theme.mutedForeground }}>
              Your membership appears eligible for refund.
            </Text>
          )}
          {batch.refund_status && (
            <Text className="mt-2 text-sm" style={{ color: theme.mutedForeground }}>
              Refund status:{" "}
              <Text className="font-semibold" style={{ color: theme.foreground }}>{batch.refund_status}</Text>
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
