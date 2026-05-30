import { View, Text, Pressable, ActivityIndicator } from "react-native";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Droplets,
  MapPin,
  Ruler,
  ShieldCheck,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useAppTheme } from "@/hooks/useAppTheme";
import { toast } from "@/lib/toast";
import type { RequestMode } from "@/types/client";

type Props = {
  mode: RequestMode;
  liveData: any;
  otp?: string;
  liveLoading?: boolean;
  liveError?: string | null;
  onConfirm: () => void;
  onReportIncident?: () => void;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

type DeliveryState = {
  headline: string;
  subtext: string;
  arrived: boolean;
  measuring: boolean;
  awaitingOtp: boolean;
  completed: boolean;
};

function getPriorityDeliveryState(liveData: any): DeliveryState {
  const status = liveData?.delivery_status;

  if (status === "delivered") return {
    headline: "Delivery completed",
    subtext: "The backend has marked this delivery as completed.",
    arrived: true, measuring: false, awaitingOtp: false, completed: true,
  };
  if (status === "awaiting_otp") return {
    headline: "OTP required",
    subtext: "Measurement is complete. Share the OTP with the driver to finish delivery.",
    arrived: true, measuring: false, awaitingOtp: true, completed: false,
  };
  if (status === "measuring") return {
    headline: "Measurement in progress",
    subtext: "The driver is currently measuring your water delivery.",
    arrived: true, measuring: true, awaitingOtp: false, completed: false,
  };
  if (status === "arrived") return {
    headline: "Tanker arrived",
    subtext: "The tanker is at your location and delivery is starting.",
    arrived: true, measuring: false, awaitingOtp: false, completed: false,
  };

  return {
    headline: liveData ? "Delivery in progress" : "Preparing delivery confirmation",
    subtext: liveData
      ? "We are waiting for the next delivery update."
      : "We are waiting for live delivery updates.",
    arrived: false, measuring: false, awaitingOtp: false, completed: false,
  };
}

function getBatchDeliveryState(liveData: any): DeliveryState {
  const status = liveData?.member_delivery_status;

  if (status === "delivered") return {
    headline: "Delivery completed",
    subtext: "Your stop has been completed successfully.",
    arrived: true, measuring: false, awaitingOtp: false, completed: true,
  };
  if (status === "awaiting_otp") return {
    headline: "OTP required",
    subtext: "Measurement is complete. Share the OTP with the driver to finish your stop.",
    arrived: true, measuring: false, awaitingOtp: true, completed: false,
  };
  if (status === "measuring") return {
    headline: "Measurement in progress",
    subtext: "The driver is currently measuring your water delivery.",
    arrived: true, measuring: true, awaitingOtp: false, completed: false,
  };
  if (status === "arrived") return {
    headline: "Tanker arrived",
    subtext: "The tanker is at your location and delivery is starting.",
    arrived: true, measuring: false, awaitingOtp: false, completed: false,
  };

  return {
    headline: liveData ? "Delivery in progress" : "Preparing delivery confirmation",
    subtext: liveData
      ? "We are waiting for the next update for your stop."
      : "We are waiting for your stop-level delivery updates.",
    arrived: false, measuring: false, awaitingOtp: false, completed: false,
  };
}

export function DeliveryStep({
  mode,
  liveData,
  otp: persistedOtp = "",
  liveLoading = false,
  liveError = null,
  onConfirm,
  onReportIncident,
}: Props) {
  const { theme } = useAppTheme();
  const isPriority = mode === "priority";

  const state = isPriority
    ? getPriorityDeliveryState(liveData)
    : getBatchDeliveryState(liveData);

  // Live data takes priority; fall back to the persisted OTP from the hook
  // so the value survives an app restart before the first poll completes.
  const otp = isPriority
    ? (liveData?.otp ?? persistedOtp)
    : (liveData?.member_delivery_code ?? liveData?.delivery_code ?? liveData?.otp ?? persistedOtp);

  const isCompleted = state.completed;

  const canConfirm = isPriority
    ? isCompleted || !!liveData?.otp_verified || liveData?.delivery_status === "delivered"
    : isCompleted || !!liveData?.otp_verified || liveData?.member_delivery_status === "delivered";

  const queuePosition = (() => {
    if (isPriority || !liveData) return null;
    const memberStatus = liveData?.member_delivery_status;
    if (!memberStatus || memberStatus === "delivered" || memberStatus === "failed" || memberStatus === "skipped") return null;
    const total: number | null = liveData?.member_count ?? null;
    if (memberStatus === "arrived" || memberStatus === "measuring" || memberStatus === "awaiting_otp") {
      return { label: "You're up now", position: 1 as number | null, total };
    }
    if (memberStatus === "en_route") {
      return { label: "Driver is on the way to you", position: 1 as number | null, total };
    }
    return { label: "In delivery queue", position: null as number | null, total };
  })();

  const deliveryStatus = isPriority ? liveData?.delivery_status : liveData?.member_delivery_status;
  const otpVerified = liveData?.otp_verified;
  const plannedLiters = liveData?.planned_liters;
  const actualLiters = liveData?.actual_liters_delivered;
  const arrivedAt = liveData?.arrived_at;
  const deliveredAt = liveData?.delivered_at;
  const measurementDone = state.measuring || !!liveData?.measurement_completed_at;
  const otpStageReached =
    state.awaitingOtp || !!otpVerified ||
    liveData?.delivery_status === "delivered" ||
    liveData?.member_delivery_status === "delivered";

  const handleCopyOtp = async () => {
    if (!otp) return;
    await Clipboard.setStringAsync(otp);
    toast.success("OTP copied");
  };

  const ICON_SIZE = 18;

  return (
    <View className="gap-4">

      {/* Queue position — batch only */}
      {queuePosition && (
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.primary + "4d" }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center shrink-0"
              style={{ backgroundColor: theme.primary }}
            >
              <Text className="text-lg font-extrabold" style={{ color: theme.primaryForeground }}>
                {queuePosition.position ?? "•"}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>
                {queuePosition.label}
              </Text>
              <Text className="text-xs mt-0.5" style={{ color: theme.mutedForeground }}>
                {queuePosition.total
                  ? `Batch of ${queuePosition.total} stop${queuePosition.total === 1 ? "" : "s"}`
                  : "The driver will reach you shortly"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Headline / status card */}
      <View
        className="rounded-2xl p-5"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="text-xl font-bold" style={{ color: theme.foreground }}>
          {state.headline}
        </Text>
        <Text className="text-sm mt-1" style={{ color: theme.mutedForeground }}>
          {state.subtext}
        </Text>
      </View>

      {/* OTP card */}
      <View
        className="rounded-2xl p-5"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="flex-row items-start justify-between gap-4 mb-4">
          <View className="flex-1">
            <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
              Delivery OTP
            </Text>
            <Text className="text-sm mt-0.5" style={{ color: theme.mutedForeground }}>
              Give this code to the driver only after measurement is complete.
            </Text>
          </View>
          {!!otp && (
            <Pressable
              onPress={handleCopyOtp}
              className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
              style={{ borderWidth: 1, borderColor: theme.border }}
            >
              <Copy size={14} color={theme.foreground} />
              <Text className="text-sm font-medium" style={{ color: theme.foreground }}>Copy</Text>
            </Pressable>
          )}
        </View>

        <View
          className="rounded-2xl p-6 items-center"
          style={{ backgroundColor: theme.muted + "4d", borderWidth: 1, borderColor: theme.border }}
        >
          <Text
            className="text-4xl font-bold"
            style={{ color: theme.foreground, letterSpacing: 12 }}
          >
            {otp || "----"}
          </Text>
        </View>
      </View>

      {/* Live status section — shown when we have live data or are in priority mode */}
      {(isPriority || !!liveData) && (
        <>
          {/* Status checklist */}
          <View
            className="rounded-2xl p-5"
            style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-base font-semibold" style={{ color: theme.foreground }}>
              Live Delivery Status
            </Text>
            <Text className="text-sm mt-1 mb-4" style={{ color: theme.mutedForeground }}>
              This section reflects the backend delivery execution state.
            </Text>

            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                {state.arrived
                  ? <CheckCircle2 size={ICON_SIZE} color={theme.primary} />
                  : <Clock3 size={ICON_SIZE} color={theme.mutedForeground} />}
                <Text className="text-sm" style={{ color: theme.foreground }}>Driver arrived</Text>
              </View>

              <View className="flex-row items-center gap-3">
                {measurementDone
                  ? <CheckCircle2 size={ICON_SIZE} color={theme.primary} />
                  : <Clock3 size={ICON_SIZE} color={theme.mutedForeground} />}
                <Text className="text-sm" style={{ color: theme.foreground }}>Measurement handled</Text>
              </View>

              <View className="flex-row items-center gap-3">
                {otpStageReached
                  ? <CheckCircle2 size={ICON_SIZE} color={theme.primary} />
                  : <Clock3 size={ICON_SIZE} color={theme.mutedForeground} />}
                <Text className="text-sm" style={{ color: theme.foreground }}>OTP stage reached</Text>
              </View>

              <View className="flex-row items-center gap-3">
                {isCompleted
                  ? <CheckCircle2 size={ICON_SIZE} color={theme.primary} />
                  : <Clock3 size={ICON_SIZE} color={theme.mutedForeground} />}
                <Text className="text-sm" style={{ color: theme.foreground }}>Delivery completed</Text>
              </View>
            </View>
          </View>

          {/* Metrics grid */}
          <View
            className="rounded-2xl p-5"
            style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
          >
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              <View
                className="rounded-xl p-4"
                style={{ flex: 1, minWidth: "45%", borderWidth: 1, borderColor: theme.border }}
              >
                <View className="flex-row items-center gap-1.5 mb-2">
                  <MapPin size={14} color={theme.foreground} />
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                    Delivery Status
                  </Text>
                </View>
                <Text className="font-semibold capitalize" style={{ color: theme.foreground }}>
                  {deliveryStatus ? deliveryStatus.replace(/_/g, " ") : "Waiting"}
                </Text>
              </View>

              <View
                className="rounded-xl p-4"
                style={{ flex: 1, minWidth: "45%", borderWidth: 1, borderColor: theme.border }}
              >
                <View className="flex-row items-center gap-1.5 mb-2">
                  <ShieldCheck size={14} color={theme.foreground} />
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                    OTP Verified
                  </Text>
                </View>
                <Text className="font-semibold" style={{ color: theme.foreground }}>
                  {otpVerified ? "Yes" : "No"}
                </Text>
              </View>

              <View
                className="rounded-xl p-4"
                style={{ flex: 1, minWidth: "45%", borderWidth: 1, borderColor: theme.border }}
              >
                <View className="flex-row items-center gap-1.5 mb-2">
                  <Droplets size={14} color={theme.foreground} />
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                    Planned Liters
                  </Text>
                </View>
                <Text className="font-semibold" style={{ color: theme.foreground }}>
                  {plannedLiters != null ? `${Number(plannedLiters).toLocaleString()}L` : "—"}
                </Text>
              </View>

              <View
                className="rounded-xl p-4"
                style={{ flex: 1, minWidth: "45%", borderWidth: 1, borderColor: theme.border }}
              >
                <View className="flex-row items-center gap-1.5 mb-2">
                  <Ruler size={14} color={theme.foreground} />
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                    Actual Delivered
                  </Text>
                </View>
                <Text className="font-semibold" style={{ color: theme.foreground }}>
                  {actualLiters != null ? `${Number(actualLiters).toLocaleString()}L` : "—"}
                </Text>
              </View>

              <View
                className="rounded-xl p-4"
                style={{ flex: 1, minWidth: "45%", borderWidth: 1, borderColor: theme.border }}
              >
                <Text
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: theme.mutedForeground }}
                >
                  Arrived At
                </Text>
                <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                  {formatDateTime(arrivedAt)}
                </Text>
              </View>

              <View
                className="rounded-xl p-4"
                style={{ flex: 1, minWidth: "45%", borderWidth: 1, borderColor: theme.border }}
              >
                <Text
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: theme.mutedForeground }}
                >
                  Delivered At
                </Text>
                <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                  {formatDateTime(deliveredAt)}
                </Text>
              </View>
            </View>
          </View>

          {/* Polling loading indicator */}
          {liveLoading && (
            <View
              className="rounded-2xl p-4 flex-row items-center gap-3"
              style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
            >
              <ActivityIndicator size="small" color={theme.mutedForeground} />
              <Text className="text-sm" style={{ color: theme.mutedForeground }}>
                Refreshing delivery status...
              </Text>
            </View>
          )}

          {/* Polling error */}
          {!!liveError && (
            <View
              className="rounded-2xl p-4 flex-row items-start gap-3"
              style={{
                backgroundColor: theme.destructiveSoft,
                borderWidth: 1,
                borderColor: theme.destructive + "33",
              }}
            >
              <View style={{ marginTop: 2 }}>
                <AlertCircle size={ICON_SIZE} color={theme.destructive} />
              </View>
              <View className="flex-1">
                <Text className="font-medium" style={{ color: theme.destructive }}>
                  Could not refresh delivery status
                </Text>
                <Text className="text-sm mt-0.5" style={{ color: theme.mutedForeground }}>
                  {liveError}
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* Important notice — batch only */}
      {!isPriority && (
        <View
          className="rounded-2xl p-4 flex-row items-start gap-3"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View style={{ marginTop: 2 }}>
            <ShieldCheck size={ICON_SIZE} color={theme.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-medium" style={{ color: theme.foreground }}>Important</Text>
            <Text className="text-sm mt-0.5" style={{ color: theme.mutedForeground }}>
              Confirm delivery only after the driver has measured the correct water quantity and you have shared the OTP.
            </Text>
          </View>
        </View>
      )}

      {/* Confirm / Continue button */}
      <Pressable
        onPress={onConfirm}
        disabled={!canConfirm}
        className="rounded-2xl p-4 items-center"
        style={{ backgroundColor: canConfirm ? theme.primary : theme.muted }}
      >
        <Text
          className="text-base font-semibold"
          style={{ color: canConfirm ? theme.primaryForeground : theme.mutedForeground }}
        >
          {isCompleted ? "Continue" : "Confirm Delivery"}
        </Text>
      </Pressable>

      {onReportIncident && (
        <Pressable onPress={onReportIncident} className="items-center py-3">
          <Text className="text-xs" style={{ color: theme.destructive }}>
            Report a problem
          </Text>
        </Pressable>
      )}
    </View>
  );
}
