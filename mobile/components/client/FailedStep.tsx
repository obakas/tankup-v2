import { View, Text, Pressable } from "react-native";
import { XCircle } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export function FailedStep({ onHome }: { onHome: () => void }) {
  const { theme } = useAppTheme();
  return (
    <View className="gap-5 items-center py-8">
      <View
        className="w-24 h-24 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.destructiveSoft }}
      >
        <XCircle color={theme.destructive} size={48} />
      </View>

      <View className="items-center gap-2">
        <Text className="text-2xl font-bold" style={{ color: theme.foreground }}>Delivery Failed</Text>
        <Text className="text-center text-sm leading-5" style={{ color: theme.mutedForeground }}>
          Your delivery could not be completed. If you were charged, a refund will be processed. Contact support if you need help.
        </Text>
      </View>

      <Pressable
        onPress={onHome}
        className="w-full rounded-xl py-4 items-center"
        style={{ backgroundColor: theme.primary }}
      >
        <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Try Again</Text>
      </Pressable>
    </View>
  );
}
