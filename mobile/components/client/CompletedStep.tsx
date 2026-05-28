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
        <Text className="text-foreground text-2xl font-bold">Water Delivered!</Text>
        <Text className="text-muted-foreground text-center text-sm leading-5">
          {size.toLocaleString()}L has been delivered to your tank successfully.
        </Text>
      </View>

      <View className="w-full bg-card border border-border rounded-2xl p-5">
        <Row label="Volume" value={`${size.toLocaleString()} L`} />
        <Row label="Amount Paid" value={`₦${price.toLocaleString()}`} />
      </View>

      <Pressable
        onPress={onHome}
        className="w-full bg-primary rounded-xl py-4 items-center"
      >
        <Text className="text-white font-semibold">Back to Home</Text>
      </Pressable>
    </View>
  );
}