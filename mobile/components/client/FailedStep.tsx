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
        <Text className="text-foreground text-2xl font-bold">Delivery Failed</Text>
        <Text className="text-muted-foreground text-center text-sm leading-5">
          Your delivery could not be completed. If you were charged, a refund will be processed. Contact support if you need help.
        </Text>
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