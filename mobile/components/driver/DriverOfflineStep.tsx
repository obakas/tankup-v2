import { Text, View } from "react-native";
import { Truck } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export function DriverOfflineStep() {
  const { theme } = useAppTheme();
  return (
    <View className="bg-card border border-border rounded-2xl p-8 items-center gap-4">
      <View
        className="w-20 h-20 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.cardSoft }}
      >
        <Truck color={theme.mutedForeground} size={36} />
      </View>
      <View className="items-center gap-1">
        <Text className="text-foreground font-bold text-xl">You're offline</Text>
        <Text className="text-muted-foreground text-center text-sm leading-5">
          Toggle online using the switch above to start receiving delivery offers.
        </Text>
      </View>
    </View>
  );
}
