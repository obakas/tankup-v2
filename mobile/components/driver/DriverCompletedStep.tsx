import { Pressable, Text, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export function DriverCompletedStep({ onBackOnline }: { onBackOnline: () => void }) {
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
        <Text className="text-2xl font-bold" style={{ color: theme.foreground }}>Job Complete!</Text>
        <Text className="text-center text-sm leading-5" style={{ color: theme.mutedForeground }}>
          All stops have been delivered. Great work — go back online when you're ready for your next job.
        </Text>
      </View>
      <Pressable
        onPress={onBackOnline}
        className="w-full rounded-xl py-4 items-center"
        style={{ backgroundColor: theme.primary }}
      >
        <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Back Online</Text>
      </Pressable>
    </View>
  );
}
