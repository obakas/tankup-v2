import { View, Text, Pressable } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Row } from "@/components/ui/Row";

type Props = {
  size: number;
  price: number;
  liveData: any;
  onHome: () => void;
};

export function CompletedStep({ size, price, onHome }: Props) {
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
          {size.toLocaleString()}L has been delivered to your tank successfully.
        </Text>
      </View>

      <View
        className="w-full rounded-2xl p-5"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Row label="Volume" value={`${size.toLocaleString()} L`} />
        <Row label="Amount Paid" value={`₦${price.toLocaleString()}`} />
      </View>

      <Pressable
        onPress={onHome}
        className="w-full rounded-xl py-4 items-center"
        style={{ backgroundColor: theme.primary }}
      >
        <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Back to Home</Text>
      </Pressable>
    </View>
  );
}
