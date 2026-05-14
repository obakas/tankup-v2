import { Text, View } from "react-native";
import { Truck } from "lucide-react-native";

export function DriverOfflineStep() {
  return (
    <View className="bg-card border border-border rounded-2xl p-6 items-center">
      <Truck color="#7c8aa6" size={48} />
      <Text className="text-foreground font-semibold text-lg mt-4">You're offline</Text>
      <Text className="text-muted-foreground text-center mt-2">
        Toggle online above to start receiving delivery offers.
      </Text>
    </View>
  );
}
