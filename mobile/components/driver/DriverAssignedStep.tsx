import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Truck } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  job: any;
  onJoinQueue: () => void;
  loading: boolean;
};

export function DriverAssignedStep({ job, onJoinQueue, loading }: Props) {
  const { theme } = useAppTheme();
  const jobId = job?.active_job?.batch_id ?? job?.active_job?.request_id ?? job?.id ?? "—";
  const jobType = job?.assignment_type ?? "batch";

  return (
    <View className="gap-4">
      <View className="items-center py-4 gap-3">
        <View
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ backgroundColor: theme.warningSoft }}
        >
          <Truck size={32} color={theme.warning} />
        </View>
        <Text className="text-xl font-bold" style={{ color: theme.foreground }}>
          Join the Loading Queue
        </Text>
        <Text className="text-sm text-center" style={{ color: theme.mutedForeground }}>
          You already accepted this offer. Tap below once you&apos;re at the loading
          point to join the queue.
        </Text>
      </View>

      <View
        className="rounded-2xl p-5 gap-3"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="flex-row justify-between">
          <Text className="text-sm" style={{ color: theme.mutedForeground }}>Job</Text>
          <Text className="text-sm font-medium" style={{ color: theme.foreground }}>#{jobId}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm" style={{ color: theme.mutedForeground }}>Type</Text>
          <Text className="text-sm font-medium capitalize" style={{ color: theme.foreground }}>{jobType}</Text>
        </View>
      </View>

      <Pressable
        onPress={onJoinQueue}
        disabled={loading}
        className="rounded-xl py-4 items-center"
        style={{ backgroundColor: theme.success }}
      >
        {loading ? (
          <ActivityIndicator color={theme.primaryForeground} />
        ) : (
          <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
            I&apos;m in the Queue
          </Text>
        )}
      </Pressable>
    </View>
  );
}
