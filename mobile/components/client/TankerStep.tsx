import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeMapView } from "@/components/ui/SafeMapView";
import {
  Truck,
  Phone,
  MapPin,
  Clock3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Navigation,
} from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { RequestMode } from "@/types/client";
import type { CreateRequestResponse } from "@/lib/api";
import { parseApiDate } from "@/lib/utils";

type Props = {
  mode: RequestMode;
  liveData: any;
  requestResp: CreateRequestResponse | null;
  liveLoading?: boolean;
  liveError?: string | null;
  size?: number | null;
  onArrived: () => void;
  onRefresh?: () => void;
  onCancelPriority?: () => void;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = parseApiDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short", hour12: true }).format(date);
}

function getBatchTankerState(liveData: any) {
  if (!liveData) {
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

  const stopStatus = liveData.member_delivery_status;

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
      tankerId: liveData.tanker_id ?? null,
      driverName: liveData.driver_name ?? null,
      driverPhone: liveData.tanker_phone ?? null,
      tankerStatus: liveData.tanker_status ?? liveData.status ?? null,
      deliveryStatus: stopStatus ?? null,
      arrived: true,
    };
  }

  if (liveData.status === "assigned") {
    return {
      headline: "Tanker assigned",
      subtext: "A tanker has been assigned to your batch.",
      tankerId: liveData.tanker_id ?? null,
      driverName: liveData.driver_name ?? null,
      driverPhone: liveData.tanker_phone ?? null,
      tankerStatus: "assigned",
      deliveryStatus: stopStatus ?? null,
      arrived: false,
    };
  }

  if (liveData.status === "loading") {
    return {
      headline: "Tanker loading",
      subtext: "The tanker is currently loading water for delivery.",
      tankerId: liveData.tanker_id ?? null,
      driverName: liveData.driver_name ?? null,
      driverPhone: liveData.tanker_phone ?? null,
      tankerStatus: "loading",
      deliveryStatus: stopStatus ?? null,
      arrived: false,
    };
  }

  if (liveData.status === "delivering" || stopStatus === "en_route" || stopStatus === "pending") {
    return {
      headline: "Tanker en route",
      subtext: "Your delivery is on the way.",
      tankerId: liveData.tanker_id ?? null,
      driverName: liveData.driver_name ?? null,
      driverPhone: liveData.tanker_phone ?? null,
      tankerStatus: liveData.tanker_status ?? "delivering",
      deliveryStatus: stopStatus ?? "en route",
      arrived: false,
    };
  }

  if (liveData.status === "completed") {
    return {
      headline: "Delivery completed",
      subtext: "This batch delivery has already been completed.",
      tankerId: liveData.tanker_id ?? null,
      driverName: liveData.driver_name ?? null,
      driverPhone: liveData.tanker_phone ?? null,
      tankerStatus: "completed",
      deliveryStatus: "delivered",
      arrived: true,
    };
  }

  return {
    headline: "Waiting for tanker update",
    subtext: "We are syncing the latest tanker status.",
    tankerId: liveData.tanker_id ?? null,
    driverName: liveData.driver_name ?? null,
    driverPhone: liveData.tanker_phone ?? null,
    tankerStatus: liveData.tanker_status ?? liveData.status ?? null,
    deliveryStatus: stopStatus ?? null,
    arrived: false,
  };
}

function getPriorityTankerState(liveData: any) {
  if (!liveData) {
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

  const deliveryStatus = liveData.delivery_status;
  const tankerStatus = liveData.tanker_status;

  if (
    deliveryStatus === "arrived" ||
    deliveryStatus === "measuring" ||
    deliveryStatus === "awaiting_otp"
  ) {
    return {
      headline: "Tanker arrived",
      subtext: "Your tanker is at the delivery point.",
      tankerId: liveData.tanker_id,
      driverName: liveData.driver_name,
      driverPhone: liveData.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: true,
    };
  }

  if (deliveryStatus === "delivered") {
    return {
      headline: "Delivery completed",
      subtext: "Your priority delivery has been completed.",
      tankerId: liveData.tanker_id,
      driverName: liveData.driver_name,
      driverPhone: liveData.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: true,
    };
  }

  if (deliveryStatus === "en_route" || tankerStatus === "delivering") {
    return {
      headline: "Tanker en route",
      subtext: "Your priority delivery is on the way.",
      tankerId: liveData.tanker_id,
      driverName: liveData.driver_name,
      driverPhone: liveData.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: false,
    };
  }

  if (tankerStatus === "loading") {
    return {
      headline: "Tanker loading",
      subtext: "The tanker is loading water for your priority request.",
      tankerId: liveData.tanker_id,
      driverName: liveData.driver_name,
      driverPhone: liveData.tanker_phone,
      tankerStatus,
      deliveryStatus,
      arrived: false,
    };
  }

  if (tankerStatus === "assigned" || liveData.tanker_id) {
    return {
      headline: "Tanker assigned",
      subtext: "A tanker has been assigned to your request.",
      tankerId: liveData.tanker_id,
      driverName: liveData.driver_name,
      driverPhone: liveData.tanker_phone,
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

export function TankerStep({
  mode,
  liveData,
  requestResp,
  liveLoading = false,
  liveError = null,
  size,
  onArrived,
  onRefresh,
  onCancelPriority,
}: Props) {
  const { theme } = useAppTheme();
  const isPriority = mode === "priority";

  const state = isPriority
    ? getPriorityTankerState(liveData)
    : getBatchTankerState(liveData);

  const canContinue =
    state.arrived ||
    state.deliveryStatus === "measuring" ||
    state.deliveryStatus === "awaiting_otp" ||
    state.deliveryStatus === "delivered";

  const priorityMode = requestResp?.is_asap === false ? "scheduled" : "asap";
  const scheduledFor = requestResp?.scheduled_for ?? null;

  const myStop = liveData?.your_stop ?? liveData?.member;

  const tankerLat: number | null = liveData?.tanker_latitude ?? null;
  const tankerLon: number | null = liveData?.tanker_longitude ?? null;
  const customerLat: number | null = liveData?.customer_latitude ?? null;
  const customerLon: number | null = liveData?.customer_longitude ?? null;
  const etaMinutes: number | null = liveData?.eta_minutes ?? null;
  const hasMap = state.tankerId != null && tankerLat != null && tankerLon != null;

  return (
    <View className="gap-4">
      {/* Summary card */}
      <View
        className="rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="text-xl font-bold" style={{ color: theme.foreground }}>
          {state.headline}
        </Text>
        <Text className="mt-1 text-sm leading-5" style={{ color: theme.mutedForeground }}>
          {state.subtext}
        </Text>

        <View className="mt-4 flex-row gap-3">
          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
              Delivery Type
            </Text>
            <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>
              {isPriority ? "Exclusive Delivery" : "Standard Delivery"}
            </Text>
          </View>

          {size != null && (
            <View
              className="flex-1 rounded-2xl p-4"
              style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
            >
              <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
                Quantity
              </Text>
              <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>
                {size.toLocaleString()}L
              </Text>
            </View>
          )}
        </View>

        {isPriority && (
          <View className="mt-3 flex-row gap-3">
            <View
              className="flex-1 rounded-2xl p-4"
              style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
            >
              <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
                Priority Mode
              </Text>
              <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>
                {priorityMode === "asap" ? "ASAP" : "Scheduled"}
              </Text>
            </View>

            <View
              className="flex-1 rounded-2xl p-4"
              style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
            >
              <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
                Scheduled For
              </Text>
              <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>
                {priorityMode === "scheduled" ? formatDateTime(scheduledFor) : "Immediate dispatch"}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ETA pill */}
      {etaMinutes != null && (state.tankerStatus === "delivering" || state.tankerStatus === "loading") && (
        <View
          className="flex-row items-center gap-3 rounded-2xl px-4 py-3"
          style={{ backgroundColor: theme.successSoft, borderWidth: 1, borderColor: theme.success + "66" }}
        >
          <Navigation color={theme.success} size={16} />
          <Text className="font-semibold text-sm" style={{ color: theme.success }}>
            Arriving in ~{etaMinutes} min
          </Text>
        </View>
      )}

      {/* Live map */}
      {hasMap && (
        <SafeMapView
          driver={{ lat: tankerLat!, lon: tankerLon!, label: state.driverName ?? "Tanker" }}
          customer={customerLat != null && customerLon != null ? {
            lat: customerLat,
            lon: customerLon,
            label: "Your location",
            pinColor: "#16a34a",
          } : null}
          height={220}
        />
      )}

      {/* Tanker details card */}
      <View
        className="rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="flex-row items-center gap-2 mb-3">
          <Truck color={theme.primary} size={18} />
          <Text className="font-bold" style={{ color: theme.foreground }}>Tanker Details</Text>
        </View>

        <View className="flex-row gap-3">
          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
              Tanker ID
            </Text>
            <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>
              {state.tankerId ? `#${state.tankerId}` : "Not assigned yet"}
            </Text>
          </View>

          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
              Tanker Status
            </Text>
            <Text className="mt-1 font-bold capitalize" style={{ color: theme.foreground }}>
              {state.tankerStatus ?? "Waiting"}
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row gap-3">
          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
              Driver Name
            </Text>
            <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>
              {state.driverName ?? "Pending assignment"}
            </Text>
          </View>

          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
              Delivery Status
            </Text>
            <Text className="mt-1 font-bold capitalize" style={{ color: theme.foreground }}>
              {state.deliveryStatus ?? "Preparing"}
            </Text>
          </View>
        </View>

        {state.driverPhone && (
          <View
            className="mt-3 flex-row items-center gap-3 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Phone color={theme.mutedForeground} size={16} />
            <View>
              <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>Driver Contact</Text>
              <Text className="text-sm" style={{ color: theme.mutedForeground }}>{state.driverPhone}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Batch stop + OTP card (mobile-specific) */}
      {mode === "batch" && myStop && (
        <View
          className="rounded-3xl p-5 shadow-sm"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.primary + "66" }}
        >
          <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
            Your Stop
          </Text>
          <Text className="text-lg font-bold mt-1" style={{ color: theme.foreground }}>
            Stop #{myStop.stop_order ?? "—"}
          </Text>
          <Text className="text-sm mt-1" style={{ color: theme.mutedForeground }}>
            OTP: {myStop.delivery_code ?? "—"}
          </Text>
        </View>
      )}

      {/* Live status card */}
      <View
        className="rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="flex-row items-start gap-3">
          {liveLoading ? (
            <ActivityIndicator size={18} color={theme.mutedForeground} style={{ marginTop: 2 }} />
          ) : canContinue ? (
            <CheckCircle2 color={theme.primary} size={18} style={{ marginTop: 2 }} />
          ) : (
            <Clock3 color={theme.mutedForeground} size={18} style={{ marginTop: 2 }} />
          )}
          <View className="flex-1">
            <Text className="font-bold" style={{ color: theme.foreground }}>Live Status</Text>
            <Text className="mt-1 text-sm leading-5" style={{ color: theme.mutedForeground }}>
              {liveLoading
                ? "Refreshing tanker status..."
                : canContinue
                  ? "The tanker has reached the stage where you can continue to delivery."
                  : "We are still waiting for the next live update."}
            </Text>
          </View>
        </View>

        {state.arrived && (
          <View
            className="mt-4 flex-row items-start gap-3 rounded-2xl p-4"
            style={{ backgroundColor: theme.successSoft, borderWidth: 1, borderColor: theme.success + "66" }}
          >
            <MapPin color={theme.success} size={18} style={{ marginTop: 2 }} />
            <View>
              <Text className="font-bold" style={{ color: theme.success }}>Tanker has arrived</Text>
              <Text className="mt-1 text-sm" style={{ color: theme.mutedForeground }}>
                You can now continue to the delivery step.
              </Text>
            </View>
          </View>
        )}

        {liveError && (
          <View
            className="mt-4 flex-row items-start gap-3 rounded-2xl p-4"
            style={{ backgroundColor: theme.destructiveSoft, borderWidth: 1, borderColor: theme.destructive + "66" }}
          >
            <AlertCircle color={theme.destructive} size={18} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="font-bold" style={{ color: theme.destructive }}>
                Could not refresh tanker status
              </Text>
              <Text className="mt-1 text-sm" style={{ color: theme.mutedForeground }}>{liveError}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Continue to Delivery button */}
      <Pressable
        onPress={onArrived}
        disabled={!canContinue}
        className="flex-row items-center justify-center gap-2 rounded-2xl py-4"
        style={{ backgroundColor: theme.primary, opacity: canContinue ? 1 : 0.4 }}
      >
        <Text className="font-bold text-base" style={{ color: theme.primaryForeground }}>
          Continue to Delivery
        </Text>
      </Pressable>

      {/* Refresh Status button */}
      {onRefresh && (
        <Pressable
          onPress={onRefresh}
          disabled={liveLoading}
          className="flex-row items-center justify-center gap-2 rounded-2xl py-3"
          style={{ borderWidth: 1, borderColor: theme.border, opacity: liveLoading ? 0.5 : 1 }}
        >
          <RefreshCw color={theme.mutedForeground} size={16} />
          <Text className="font-medium" style={{ color: theme.mutedForeground }}>
            {liveLoading ? "Refreshing..." : "Refresh Status"}
          </Text>
        </Pressable>
      )}

      {/* Cancel priority delivery button — hidden once water is pumped */}
      {isPriority && onCancelPriority && (() => {
        const drStatus = liveData?.delivery_status ?? null;
        const canCancel = drStatus !== "awaiting_otp" && drStatus !== "delivered";
        return canCancel ? (
          <Pressable
            onPress={onCancelPriority}
            className="items-center py-3"
          >
            <Text className="font-medium text-sm" style={{ color: theme.destructive }}>
              Cancel Delivery
            </Text>
          </Pressable>
        ) : null;
      })()}
    </View>
  );
}
