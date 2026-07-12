import { Text, View } from "react-native";
import { Truck } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export function DriverOfflineStep() {
  const { theme } = useAppTheme();
  return (
    <View
      className="rounded-2xl p-8 items-center gap-4"
      style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
    >
      <View
        className="w-20 h-20 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.cardSoft }}
      >
        <Truck color={theme.mutedForeground} size={36} />
      </View>
      <View className="items-center gap-1">
        <Text className="font-bold text-xl" style={{ color: theme.foreground }}>You&apos;re offline</Text>
        <Text className="text-center text-sm leading-5" style={{ color: theme.mutedForeground }}>
          Toggle online using the switch above to start receiving delivery offers.
        </Text>
      </View>
    </View>
  );
}
