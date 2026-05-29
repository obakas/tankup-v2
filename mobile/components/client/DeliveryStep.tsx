import { View, Text, Pressable, ActivityIndicator } from "react-native";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Droplets,
  MapPin,
  Ruler,
  ShieldCheck,
  AlertCircle,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useAppTheme } from "@/hooks/useAppTheme";
import { toast } from "@/lib/toast";
import type { RequestMode } from "@/types/client";
import type { CreateRequestResponse } from "@/lib/api";

type Props = {
  mode: RequestMode;
  liveData: any;
  requestResp: CreateRequestResponse;
  liveLoading?: boolean;
  liveError?: string | null;
  onConfirm: () => void;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getPriorityDeliveryState(liveData: any) {
  if (!liveData) {
    return {
      headline: "Preparing delivery confirmation",
      subtext: "We are waiting for live delivery updates.",
      arrived: false,
      measuring: false,
      awaitingOtp: false,
      completed: false,
    };
  }

  const status = liveData.delivery_status;

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

function getBatchDeliveryState(liveData: any) {
  if (!liveData) {
    return {
      headline: "Preparing delivery confirmation",
      subtext: "We are waiting for your stop-level delivery updates.",
      arrived: false,
      measuring: false,
      awaitingOtp: false,
      completed: false,
    };
  }

  const status = liveData.member_delivery_status;

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

export function DeliveryStep({
  mode,
  liveData,
  liveLoading = false,
  liveError = null,
  onConfirm,
}: Props) {
  const { theme } = useAppTheme();
  const isPriority = mode === "priority";

  const effectiveState = isPriority
    ? getPriorityDeliveryState(liveData)
    : getBatchDeliveryState(liveData);

  const effectiveOtp = isPriority
    ? liveData?.otp ?? liveData?.delivery_code
    : liveData?.member_delivery_code ?? liveData?.otp ?? liveData?.delivery_code;

  const isCompleted = effectiveState.completed;

  const canConfirm = isPriority
    ? isCompleted || !!liveData?.otp_verified || liveData?.delivery_status === "delivered"
    : isCompleted || !!liveData?.otp_verified || liveData?.member_delivery_status === "delivered";

  // Queue position for batch
  const position = liveData?.your_stop?.stop_order ?? liveData?.member?.stop_order ?? liveData?.stop_order;
  const totalStops = liveData?.total_stops ?? liveData?.member_count;

  async function copyOtp() {
    if (!effectiveOtp) return;
    await Clipboard.setStringAsync(String(effectiveOtp));
    toast.success("OTP copied");
  }

  return (
    <View className="gap-4">
      {/* Batch queue position card */}
      {!isPriority && position != null && (
        <View
          className="rounded-3xl p-5 shadow-sm"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.primary + "66" }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="items-center justify-center rounded-2xl"
              style={{ width: 48, height: 48, backgroundColor: theme.primary }}
            >
              <Text className="font-extrabold text-lg" style={{ color: theme.primaryForeground }}>
                {position ?? "•"}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>
                {position === 1 ? "You're up now" : `Stop #${position}`}
              </Text>
              <Text className="text-xs" style={{ color: theme.mutedForeground }}>
                {totalStops
                  ? `Batch of ${totalStops} stop${totalStops === 1 ? "" : "s"}`
                  : "Driver will reach you shortly"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Headline card */}
      <View
        className="rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="text-xl font-bold" style={{ color: theme.foreground }}>
          {effectiveState.headline}
        </Text>
        <Text className="mt-1 text-sm leading-5" style={{ color: theme.mutedForeground }}>
          {effectiveState.subtext}
        </Text>
      </View>

      {/* OTP card */}
      <View
        className="rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="flex-row items-start justify-between gap-4 mb-4">
          <View className="flex-1">
            <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>Delivery OTP</Text>
            <Text className="text-sm" style={{ color: theme.mutedForeground }}>
              Give this code to the driver only after measurement is complete.
            </Text>
          </View>
          <Pressable
            onPress={copyOtp}
            disabled={!effectiveOtp}
            className="flex-row items-center gap-2 rounded-xl px-3 py-2"
            style={{ borderWidth: 1, borderColor: theme.border, opacity: effectiveOtp ? 1 : 0.4 }}
          >
            <Copy color={theme.mutedForeground} size={15} />
            <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>Copy</Text>
          </Pressable>
        </View>

        <View
          className="rounded-2xl p-6 items-center"
          style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
        >
          <Text className="text-4xl font-bold tracking-widest" style={{ color: theme.foreground }}>
            {effectiveOtp || "----"}
          </Text>
        </View>
      </View>

      {/* Live delivery status checklist */}
      {(isPriority || !!liveData) && (
        <>
          <View
            className="rounded-3xl p-5 shadow-sm"
            style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-base font-semibold mb-1" style={{ color: theme.foreground }}>
              Live Delivery Status
            </Text>
            <Text className="text-sm mb-4" style={{ color: theme.mutedForeground }}>
              Reflects the backend delivery execution state.
            </Text>

            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                {effectiveState.arrived ? (
                  <CheckCircle2 color={theme.primary} size={20} />
                ) : (
                  <Clock3 color={theme.mutedForeground} size={20} />
                )}
                <Text className="text-sm" style={{ color: theme.foreground }}>Driver arrived</Text>
              </View>

              <View className="flex-row items-center gap-3">
                {effectiveState.measuring ||
                liveData?.measurement_completed_at ? (
                  <CheckCircle2 color={theme.primary} size={20} />
                ) : (
                  <Clock3 color={theme.mutedForeground} size={20} />
                )}
                <Text className="text-sm" style={{ color: theme.foreground }}>Measurement handled</Text>
              </View>

              <View className="flex-row items-center gap-3">
                {effectiveState.awaitingOtp ||
                !!liveData?.otp_verified ||
                liveData?.delivery_status === "delivered" ||
                liveData?.member_delivery_status === "delivered" ? (
                  <CheckCircle2 color={theme.primary} size={20} />
                ) : (
                  <Clock3 color={theme.mutedForeground} size={20} />
                )}
                <Text className="text-sm" style={{ color: theme.foreground }}>OTP stage reached</Text>
              </View>

              <View className="flex-row items-center gap-3">
                {isCompleted ? (
                  <CheckCircle2 color={theme.primary} size={20} />
                ) : (
                  <Clock3 color={theme.mutedForeground} size={20} />
                )}
                <Text className="text-sm" style={{ color: theme.foreground }}>Delivery completed</Text>
              </View>
            </View>
          </View>

          {/* Detail grid */}
          <View
            className="rounded-3xl p-5 shadow-sm"
            style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
          >
            <View className="flex-row gap-3 mb-3">
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <MapPin color={theme.mutedForeground} size={14} />
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>Delivery Status</Text>
                </View>
                <Text className="font-semibold capitalize" style={{ color: theme.foreground }}>
                  {(isPriority ? liveData?.delivery_status : liveData?.member_delivery_status) ?? "Waiting"}
                </Text>
              </View>

              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <ShieldCheck color={theme.mutedForeground} size={14} />
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>OTP Verified</Text>
                </View>
                <Text className="font-semibold" style={{ color: theme.foreground }}>
                  {liveData?.otp_verified ? "Yes" : "No"}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3 mb-3">
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Droplets color={theme.mutedForeground} size={14} />
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>Planned Liters</Text>
                </View>
                <Text className="font-semibold" style={{ color: theme.foreground }}>
                  {liveData?.planned_liters != null
                    ? `${Number(liveData.planned_liters).toLocaleString()}L`
                    : "—"}
                </Text>
              </View>

              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Ruler color={theme.mutedForeground} size={14} />
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>Actual Delivered</Text>
                </View>
                <Text className="font-semibold" style={{ color: theme.foreground }}>
                  {liveData?.actual_liters_delivered != null
                    ? `${Number(liveData.actual_liters_delivered).toLocaleString()}L`
                    : "—"}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
              >
                <Text className="text-[11px] uppercase tracking-widest mb-1" style={{ color: theme.mutedForeground }}>
                  Arrived At
                </Text>
                <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                  {formatDateTime(liveData?.arrived_at)}
                </Text>
              </View>

              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
              >
                <Text className="text-[11px] uppercase tracking-widest mb-1" style={{ color: theme.mutedForeground }}>
                  Delivered At
                </Text>
                <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                  {formatDateTime(liveData?.delivered_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* Loading indicator */}
          {liveLoading && (
            <View
              className="rounded-3xl p-4 shadow-sm flex-row items-center gap-3"
              style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
            >
              <ActivityIndicator color={theme.mutedForeground} />
              <Text className="text-sm" style={{ color: theme.mutedForeground }}>
                Refreshing delivery status...
              </Text>
            </View>
          )}

          {/* Error display */}
          {liveError && (
            <View
              className="rounded-3xl p-4 shadow-sm flex-row items-start gap-3"
              style={{
                backgroundColor: theme.destructiveSoft,
                borderWidth: 1,
                borderColor: theme.destructive + "66",
              }}
            >
              <AlertCircle color={theme.destructive} size={20} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="font-bold" style={{ color: theme.destructive }}>
                  Could not refresh delivery status
                </Text>
                <Text className="mt-1 text-sm" style={{ color: theme.mutedForeground }}>{liveError}</Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* Important notice (batch only) */}
      {!isPriority && (
        <View
          className="rounded-3xl p-5 shadow-sm flex-row items-start gap-3"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <ShieldCheck color={theme.primary} size={20} style={{ marginTop: 2 }} />
          <View className="flex-1">
            <Text className="font-semibold" style={{ color: theme.foreground }}>Important</Text>
            <Text className="mt-1 text-sm leading-5" style={{ color: theme.mutedForeground }}>
              Confirm delivery only after the driver has measured the correct water quantity and you
              have shared the OTP.
            </Text>
          </View>
        </View>
      )}

      {/* Confirm / Continue button */}
      <Pressable
        onPress={onConfirm}
        disabled={!canConfirm}
        className="flex-row items-center justify-center rounded-2xl py-4"
        style={{ backgroundColor: theme.primary, opacity: canConfirm ? 1 : 0.4 }}
      >
        <Text className="font-bold text-base" style={{ color: theme.primaryForeground }}>
          {isCompleted ? "Continue" : "Confirm Delivery"}
        </Text>
      </Pressable>
    </View>
  );
}
