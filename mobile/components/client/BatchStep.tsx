import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { AlertCircle, Copy, RefreshCw, Truck } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import * as Clipboard from "expo-clipboard";

import type { BatchLiveResponse, CreateRequestResponse } from "@/lib/api";
import { Row } from "@/components/ui/Row";
import {
  BatchProgressCard,
  type BatchProgressData,
} from "@/components/client/BatchProgressCard";
import { BatchLifecycleCard } from "@/components/client/BatchLifecycleCard";

type Props = {
  requestResp: CreateRequestResponse;
  liveData: BatchLiveResponse | any | null;
  liveLoading?: boolean;
  liveError?: string | null;
  size: number;
  price: number;
  onLeave: () => void;
  onRefresh: () => void | Promise<void>;
  onViewTanker?: () => void;
};

function normalizeBatchData(liveData: any): BatchProgressData | null {
  if (!liveData) return null;

  const batch = liveData.batch ?? liveData;
  const member = liveData.member ?? {};
  const tanker = liveData.tanker ?? {};

  return {
    ...batch,
    ...liveData,
    batch_id: liveData.batch_id ?? batch.batch_id ?? batch.id,
    status: batch.status ?? liveData.status,
    current_volume: liveData.current_volume ?? batch.current_volume,
    target_volume: liveData.target_volume ?? batch.target_volume,
    progress_percent:
      liveData.progress_percent ?? liveData.fill_percentage ?? batch.progress_percent,
    fill_percentage: liveData.fill_percentage ?? batch.fill_percentage,
    member_count: liveData.member_count ?? batch.member_count,
    tanker_id: liveData.tanker_id ?? batch.tanker_id ?? tanker.id,
    tanker_status: liveData.tanker_status ?? batch.tanker_status ?? tanker.status,
    driver_name: liveData.driver_name ?? batch.driver_name ?? tanker.driver_name,
    member_status: liveData.member_status ?? member.status,
    member_payment_status: liveData.member_payment_status ?? member.payment_status,
    refund_eligible: liveData.refund_eligible ?? member.refund_eligible,
    refund_status: liveData.refund_status ?? member.refund_status,
  };
}

function getBatchHeadline(status?: string | null) {
  switch (status) {
    case "forming": return "We're building your batch";
    case "near_ready": return "Your batch is almost full";
    case "ready_for_assignment": return "Your batch is ready for tanker assignment";
    case "assigned": return "A tanker has been assigned";
    case "loading": return "Your tanker is loading water";
    case "delivering": return "Your delivery is on the way";
    case "arrived": return "Your tanker has arrived";
    case "completed": return "Your batch delivery is complete";
    case "partially_completed": return "Your batch finished with some issues";
    case "assignment_failed": return "No tanker could be secured yet";
    case "failed": return "This batch delivery failed";
    case "expired": return "This batch expired";
    default: return "Your batch order";
  }
}

function getBatchSubtext(status?: string | null) {
  switch (status) {
    case "forming": return "We're waiting for more nearby customers to join so the tanker can dispatch efficiently.";
    case "near_ready": return "Good news — this batch is getting close to dispatch.";
    case "ready_for_assignment": return "Your batch is full enough and waiting for the best tanker match.";
    case "assigned": return "A driver has been matched to your batch.";
    case "loading": return "The assigned tanker is currently loading for delivery.";
    case "delivering": return "Keep your phone close. Delivery is in progress.";
    case "arrived": return "Share your OTP only after water measurement is complete.";
    case "completed": return "This delivery has been completed successfully.";
    case "expired": return "This batch could not be completed in time.";
    case "assignment_failed": return "The system tried to assign a tanker but could not secure one. Operations/admin should retry or intervene.";
    default: return "Track your batch progress here.";
  }
}

function canViewTanker(status?: string | null) {
  return ["assigned", "loading", "delivering", "arrived", "completed", "partially_completed", "failed"].includes(status ?? "");
}

export function BatchStep({ requestResp, liveData, liveLoading = false, liveError = null, size, price, onLeave, onRefresh, onViewTanker }: Props) {
  const { theme } = useAppTheme();
  const batch = normalizeBatchData(liveData);
  const status = batch?.status ?? "forming";
  const otp =
    liveData?.otp ||
    liveData?.member?.otp ||
    liveData?.delivery?.otp;

  async function copyOtp() {
    if (!otp) return;
    await Clipboard.setStringAsync(String(otp));
  }

  return (
    <View className="gap-5">
      <View
        className="rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="text-xl font-bold" style={{ color: theme.foreground }}>{getBatchHeadline(status)}</Text>
        <Text className="mt-1 text-sm leading-5" style={{ color: theme.mutedForeground }}>{getBatchSubtext(status)}</Text>

        <View className="mt-4 flex-row gap-3">
          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>Request ID</Text>
            <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>{requestResp.request_id ?? "—"}</Text>
          </View>
          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>Batch ID</Text>
            <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>{requestResp.batch_id ?? batch?.batch_id ?? "—"}</Text>
          </View>
        </View>

        <View className="mt-3 flex-row gap-3">
          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>Quantity</Text>
            <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>{size.toLocaleString()}L</Text>
          </View>
          <View
            className="flex-1 rounded-2xl p-4"
            style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>Amount Paid</Text>
            <Text className="mt-1 font-bold" style={{ color: theme.foreground }}>₦{price.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <View
        className="rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-base font-bold" style={{ color: theme.foreground }}>Your Delivery OTP</Text>
            <Text className="mt-1 text-sm leading-5" style={{ color: theme.mutedForeground }}>
              Share this with the driver only after measurement is complete.
            </Text>
          </View>
          <Pressable
            onPress={copyOtp}
            disabled={!otp}
            className="flex-row items-center gap-2 rounded-xl px-3 py-2"
            style={{ borderWidth: 1, borderColor: theme.border, opacity: otp ? 1 : 0.4 }}
          >
            <Copy color={theme.mutedForeground} size={15} />
            <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>Copy</Text>
          </Pressable>
        </View>
        <View
          className="mt-4 rounded-2xl p-6 items-center"
          style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
        >
          <Text className="text-4xl font-extrabold tracking-widest" style={{ color: theme.foreground }}>
            {otp || "----"}
          </Text>
        </View>
      </View>

      {liveLoading && !batch && (
        <View
          className="rounded-3xl p-5 shadow-sm flex-row items-center gap-3"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <ActivityIndicator />
          <Text className="text-sm" style={{ color: theme.mutedForeground }}>Syncing your batch status...</Text>
        </View>
      )}

      {liveError && (
        <View
          className="rounded-3xl p-4 shadow-sm flex-row items-start gap-3"
          style={{ backgroundColor: theme.destructiveSoft, borderWidth: 1, borderColor: theme.destructive + "66" }}
        >
          <AlertCircle color={theme.destructive} size={20} />
          <View className="flex-1">
            <Text className="font-bold" style={{ color: theme.destructive }}>Could not refresh batch status</Text>
            <Text className="mt-1 text-sm" style={{ color: theme.mutedForeground }}>{liveError}</Text>
          </View>
        </View>
      )}

      <BatchProgressCard batch={batch} requestedLiters={size} amountPaid={price} />
      {batch && <BatchLifecycleCard batch={batch as any} isLoading={liveLoading} />}

      {batch?.tanker_id && (
        <View
          className="rounded-3xl p-5 shadow-sm flex-row items-start gap-3"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <Truck color={theme.primary} size={20} />
          <View className="flex-1">
            <Text className="font-bold" style={{ color: theme.foreground }}>Assigned Tanker</Text>
            <Text className="mt-1 text-sm" style={{ color: theme.mutedForeground }}>
              Tanker #{batch.tanker_id}{batch.driver_name ? ` • Driver: ${batch.driver_name}` : ""}
            </Text>
          </View>
        </View>
      )}

      <View
        className="rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Row label="Volume" value={`${size.toLocaleString()} L`} />
        <Row label="Paid" value={`₦${price.toLocaleString()}`} />
        <Row label="Batch #" value={String(requestResp.batch_id ?? batch?.batch_id ?? "—")} />
        <Row label="Members" value={String(batch?.member_count ?? "—")} />
        <Row label="Status" value={String(status).replace(/_/g, " ")} />
      </View>

      <Pressable
        onPress={onRefresh}
        className="flex-row items-center justify-center gap-2 rounded-xl py-3"
        style={{ borderWidth: 1, borderColor: theme.border }}
      >
        <RefreshCw color={theme.mutedForeground} size={16} />
        <Text className="font-medium" style={{ color: theme.mutedForeground }}>
          {liveLoading ? "Refreshing..." : "Refresh Status"}
        </Text>
      </Pressable>

      <Pressable
        onPress={onViewTanker}
        disabled={!canViewTanker(status) || !onViewTanker}
        className="flex-row items-center justify-center gap-2 rounded-xl py-3"
        style={{ backgroundColor: theme.primary, opacity: canViewTanker(status) && onViewTanker ? 1 : 0.4 }}
      >
        <Truck color={theme.primaryForeground} size={16} />
        <Text className="font-bold" style={{ color: theme.primaryForeground }}>View Tanker Status</Text>
      </Pressable>

      <Pressable
        onPress={onLeave}
        className="rounded-xl py-3 items-center"
        style={{ borderWidth: 1, borderColor: theme.destructive + "66" }}
      >
        <Text className="font-medium" style={{ color: theme.destructive }}>Leave Batch</Text>
      </Pressable>
    </View>
  );
}
