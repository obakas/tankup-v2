import { View, Text, Pressable } from "react-native";
import { Row } from "@/components/ui/Row";

type Props = {
  size: number;
  price: number;
  liveData: any;
  onHome: () => void;
};

export function CompletedStep({ size, price, onHome }: Props) {
  return (
    <View className="gap-4 items-center py-8">
      <View className="w-20 h-20 rounded-full bg-success/20 items-center justify-center">
        <Text className="text-success text-3xl">✓</Text>
      </View>

      <Text className="text-foreground text-2xl font-bold">Water Delivered!</Text>

      <Text className="text-muted-foreground">
        {size.toLocaleString()}L delivered to your tank
      </Text>

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