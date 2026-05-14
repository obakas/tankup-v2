import { View, Text, Pressable, ActivityIndicator } from "react-native";
import type { RequestMode } from "@/types/client";
import type { CreateRequestResponse } from "@/lib/api";
import { Row } from "@/components/ui/Row";

type Props = {
  price: number;
  size: number;
  mode: RequestMode;
  requestResp: CreateRequestResponse;
  onPay: () => void;
  onCancel: () => void;
  loading: boolean;
};

export function PaymentStep({
  price,
  size,
  mode,
  requestResp,
  onPay,
  onCancel,
  loading,
}: Props) {
  return (
    <View className="gap-4">
      <View className="bg-card border border-border rounded-2xl p-5">
        <Row label="Mode" value={mode === "batch" ? "Batch Saver" : "Priority"} />
        <Row label="Volume" value={`${size.toLocaleString()} L`} />
        <Row label="Total" value={`₦${price.toLocaleString()}`} bold />

        {requestResp.batch_id && (
          <Row label="Batch #" value={String(requestResp.batch_id)} />
        )}

        {requestResp.payment_deadline && (
          <Row
            label="Pay before"
            value={new Date(requestResp.payment_deadline).toLocaleTimeString()}
          />
        )}
      </View>

      <View className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
        <Text className="text-amber-400 text-sm">
          Payment is currently manual. Confirm once you've transferred the amount.
        </Text>
      </View>

      <Pressable
        onPress={onPay}
        disabled={loading}
        className="bg-primary rounded-xl py-4 items-center"
      >
        {loading ? <ActivityIndicator color="#fff" /> : (
          <Text className="text-white font-semibold">
            Confirm Payment — ₦{price.toLocaleString()}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={onCancel}
        className="border border-border rounded-xl py-4 items-center"
      >
        <Text className="text-foreground font-medium">Cancel</Text>
      </Pressable>
    </View>
  );
}