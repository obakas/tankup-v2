import { View, Text, Pressable, ActivityIndicator } from "react-native";
import type { RequestMode } from "@/types/client";
import type { CreateRequestResponse } from "@/lib/api";
import { Row } from "@/components/ui/Row";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  price: number;
  size: number;
  mode: RequestMode;
  requestResp: CreateRequestResponse;
  onPay: () => void;
  onCancel: () => void;
  loading: boolean;
};

export function PaymentStep({ price, size, mode, requestResp, onPay, onCancel, loading }: Props) {
  const { theme } = useAppTheme();
  return (
    <View className="gap-4">
      <View
        className="rounded-2xl p-5"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
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

      <View
        className="rounded-xl p-4"
        style={{ backgroundColor: theme.warningSoft, borderWidth: 1, borderColor: theme.warning + "4d" }}
      >
        <Text className="text-sm" style={{ color: theme.warning }}>
          Payment is currently manual. Confirm once you've transferred the amount.
        </Text>
      </View>

      <Pressable
        onPress={onPay}
        disabled={loading}
        className="rounded-xl py-4 items-center"
        style={{ backgroundColor: theme.primary }}
      >
        {loading ? (
          <ActivityIndicator color={theme.primaryForeground} />
        ) : (
          <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
            Confirm Payment — ₦{price.toLocaleString()}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={onCancel}
        className="rounded-xl py-4 items-center"
        style={{ borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="font-medium" style={{ color: theme.foreground }}>Cancel</Text>
      </Pressable>
    </View>
  );
}
