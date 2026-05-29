import { Pressable, Text, View } from "react-native";
import { RefreshCw, Wifi } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export function DriverAvailableStep({ onRefresh }: { onRefresh: () => void }) {
  const { theme } = useAppTheme();
  return (
    <View className="gap-4">
      <View
        className="rounded-2xl p-8 items-center gap-4"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <View
          className="w-20 h-20 rounded-full items-center justify-center"
          style={{ backgroundColor: theme.successSoft }}
        >
          <Wifi color={theme.success} size={36} />
        </View>
        <View className="items-center gap-1">
          <Text className="font-bold text-xl" style={{ color: theme.foreground }}>You're online</Text>
          <Text className="text-center text-sm leading-5" style={{ color: theme.mutedForeground }}>
            Listening for job offers. You'll be notified the moment one is ready for you.
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.success }} />
          <Text className="text-xs font-semibold" style={{ color: theme.success }}>
            Active
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onRefresh}
        className="flex-row items-center justify-center gap-2 rounded-xl py-3"
        style={{ borderWidth: 1, borderColor: theme.border }}
      >
        <RefreshCw color={theme.mutedForeground} size={16} />
        <Text className="font-medium" style={{ color: theme.mutedForeground }}>Check for Offers</Text>
      </Pressable>
    </View>
  );
}
