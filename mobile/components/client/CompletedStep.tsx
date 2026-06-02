import { View, Text, Pressable } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Row } from "@/components/ui/Row";
import { formatScheduledDateTime } from "@/lib/utils";
import type { RequestMode, PriorityMode } from "@/types/client";

type Props = {
  size: number;
  requestMode: RequestMode;
  priorityMode: PriorityMode;
  scheduledFor: string;
  price: number;
  otp: string;
  onHome: () => void;
};

export function CompletedStep({ size, requestMode, priorityMode, scheduledFor, price, otp, onHome }: Props) {
  const { theme } = useAppTheme();
  return (
    <View className="gap-5 items-center py-8">
      <View
        className="w-24 h-24 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.successSoft }}
      >
        <CheckCircle2 color={theme.success} size={48} />
      </View>

      <View className="items-center gap-2">
        <Text className="text-2xl font-bold" style={{ color: theme.foreground }}>Water Delivered!</Text>
        <Text className="text-center text-sm leading-5" style={{ color: theme.mutedForeground }}>
          {size.toLocaleString()}L has been delivered to your tank
        </Text>
      </View>

      <View
        className="w-full rounded-2xl p-5 gap-2"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="font-semibold mb-1" style={{ color: theme.foreground }}>Summary</Text>

        <Row
          label="Delivery type"
          value={requestMode === "batch" ? "Batch Saver" : "Priority Delivery"}
        />

        {requestMode === "priority" && (
          <Row
            label="Priority timing"
            value={
              priorityMode === "asap"
                ? "ASAP (earliest available dispatch)"
                : scheduledFor
                ? formatScheduledDateTime(scheduledFor)
                : "Not selected"
            }
          />
        )}

        <Row label="Water delivered" value={`${size.toLocaleString()} L`} />
        <Row label="Amount paid" value={`₦${price.toLocaleString()}`} />
        {otp ? <Row label="Delivery OTP" value={otp} /> : null}
      </View>

      <Pressable
        onPress={onHome}
        className="w-full rounded-xl py-4 items-center"
        style={{ backgroundColor: theme.primary }}
      >
        <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Request Again</Text>
      </Pressable>
    </View>
  );
}
