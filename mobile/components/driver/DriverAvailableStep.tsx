import { Pressable, Text, View } from "react-native";
import { RefreshCw, Wifi } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export function DriverAvailableStep({ onRefresh }: { onRefresh: () => void }) {
  const { theme } = useAppTheme();
  return (
    <View className="gap-4">
      <View className="bg-card border border-border rounded-2xl p-8 items-center gap-4">
        <View
          className="w-20 h-20 rounded-full items-center justify-center"
          style={{ backgroundColor: theme.successSoft }}
        >
          <Wifi color={theme.success} size={36} />
        </View>
        <View className="items-center gap-1">
          <Text className="text-foreground font-bold text-xl">You're online</Text>
          <Text className="text-muted-foreground text-center text-sm leading-5">
            Listening for job offers. You'll be notified the moment one is ready for you.
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-success" />
          <Text style={{ color: theme.success }} className="text-xs font-semibold">
            Active
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onRefresh}
        className="flex-row items-center justify-center gap-2 border border-border rounded-xl py-3"
      >
        <RefreshCw color={theme.mutedForeground} size={16} />
        <Text className="text-muted-foreground font-medium">Check for Offers</Text>
      </Pressable>
    </View>
  );
}
