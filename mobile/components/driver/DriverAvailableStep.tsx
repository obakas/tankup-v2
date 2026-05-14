import { Pressable, Text, View } from "react-native";
import { RefreshCw } from "lucide-react-native";

export function DriverAvailableStep({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View className="gap-4">
      <View className="bg-card border border-border rounded-2xl p-6 items-center">
        <View className="w-3 h-3 rounded-full bg-success mb-3" />
        <Text className="text-foreground font-semibold text-lg">Waiting for offers...</Text>
        <Text className="text-muted-foreground text-center mt-2">
          You'll receive a job offer when one is assigned to you.
        </Text>
      </View>

      <Pressable onPress={onRefresh} className="flex-row items-center justify-center gap-2 border border-border rounded-xl py-3">
        <RefreshCw color="#7c8aa6" size={16} />
        <Text className="text-muted-foreground font-medium">Check for Offers</Text>
      </Pressable>
    </View>
  );
}
