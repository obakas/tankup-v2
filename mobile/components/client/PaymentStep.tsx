import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { CreditCard, XCircle } from "lucide-react-native";
import type { RequestMode, PriorityMode } from "@/types/client";
import { useAppTheme } from "@/hooks/useAppTheme";
import { BATCH_PRICE_PER_LITER } from "@/constants/water";

type Props = {
  price: number;
  size: number;
  mode: RequestMode;
  priorityMode: PriorityMode;
  scheduledFor: string;
  onPay: () => void;
  onCancel: () => void;
  loading: boolean;
};

export function PaymentStep({
  price,
  size,
  mode,
  priorityMode,
  scheduledFor,
  onPay,
  onCancel,
  loading,
}: Props) {
  const { theme } = useAppTheme();

  return (
    <View className="gap-6">
      {/* Summary card */}
      <View
        className="rounded-xl p-6 gap-4"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        {/* Prominent price */}
        <View className="items-center gap-2">
          <Text className="text-sm" style={{ color: theme.mutedForeground }}>
            Amount to pay
          </Text>
          <Text className="text-4xl font-extrabold" style={{ color: theme.foreground }}>
            ₦{price.toLocaleString()}
          </Text>
          <Text className="text-sm" style={{ color: theme.mutedForeground }}>
            for {size.toLocaleString()}L of water
          </Text>
        </View>

        {/* Divider */}
        <View style={{ borderTopWidth: 1, borderColor: theme.border }} className="pt-4 gap-3">
          {/* Delivery type */}
          <View className="flex-row justify-between">
            <Text className="text-sm" style={{ color: theme.mutedForeground }}>
              Delivery type
            </Text>
            <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
              {mode === "batch" ? "Batch Saver" : "Priority Delivery"}
            </Text>
          </View>

          {/* Priority timing */}
          {mode === "priority" && (
            <View className="flex-row justify-between">
              <Text className="text-sm" style={{ color: theme.mutedForeground }}>
                Priority timing
              </Text>
              <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                {priorityMode === "asap"
                  ? "ASAP"
                  : scheduledFor || "Not selected"}
              </Text>
            </View>
          )}

          {/* Batch rate OR priority full-tanker notice */}
          {mode === "batch" ? (
            <View className="flex-row justify-between">
              <Text className="text-sm" style={{ color: theme.mutedForeground }}>
                Rate
              </Text>
              <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                ₦{BATCH_PRICE_PER_LITER}/liter
              </Text>
            </View>
          ) : (
            <View
              className="rounded-lg p-3"
              style={{
                backgroundColor: theme.warningSoft,
                borderWidth: 1,
                borderColor: theme.warning + "33",
              }}
            >
              <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                Full tanker payment applies
              </Text>
              <Text className="text-xs mt-1" style={{ color: theme.mutedForeground }}>
                Priority delivery reserves the tanker for your request.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View className="gap-3">
        <Pressable
          onPress={onPay}
          disabled={loading}
          className="w-full rounded-xl items-center justify-center flex-row gap-2"
          style={{ backgroundColor: theme.primary, height: 56 }}
        >
          {loading ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <>
              <CreditCard size={20} color={theme.primaryForeground} />
              <Text className="text-base font-semibold" style={{ color: theme.primaryForeground }}>
                Pay ₦{price.toLocaleString()}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={loading}
          className="w-full rounded-xl items-center justify-center flex-row gap-2"
          style={{ borderWidth: 1, borderColor: theme.border, height: 48 }}
        >
          <XCircle size={16} color={theme.foreground} />
          <Text className="text-base font-medium" style={{ color: theme.foreground }}>
            Cancel Before Payment
          </Text>
        </Pressable>

        <View
          className="rounded-xl p-4"
          style={{
            backgroundColor: theme.warningSoft,
            borderWidth: 1,
            borderColor: theme.warning + "33",
          }}
        >
          <Text className="text-xs" style={{ color: theme.mutedForeground }}>
            Payment is held securely until delivery is confirmed. Batch orders can be cancelled
            freely before payment. Once you pay and join a batch, leaving the batch means you may
            forfeit your payment.
          </Text>
        </View>
      </View>
    </View>
  );
}
