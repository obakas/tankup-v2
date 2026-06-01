import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  job: any;
  onStartLoading: () => void;
  onLoaded: () => void;
  loading: boolean;
};

export function DriverLoadingStep({ job, onStartLoading, onLoaded, loading }: Props) {
  const { theme } = useAppTheme();
  const totalVol =
    job?.active_job?.total_volume_liters ??
    job?.total_volume_liters ??
    job?.volume_liters ??
    "—";

  const jobType = job?.active_job?.job_type ?? job?.job_type ?? "batch";
  const tankerStatus = job?.tanker_status ?? "assigned";
  const isLoading = tankerStatus === "loading";

  return (
    <View className="gap-4">
      <View
        className="rounded-2xl p-5"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="font-semibold capitalize" style={{ color: theme.foreground }}>
          {jobType} job — Load tanker
        </Text>
        <Text className="mt-2" style={{ color: theme.mutedForeground }}>
          Fill {typeof totalVol === "number" ? totalVol.toLocaleString() : totalVol}L at the depot before heading out.
        </Text>
      </View>

      {!isLoading ? (
        <Pressable
          onPress={onStartLoading}
          disabled={loading}
          className="rounded-xl py-4 items-center"
          style={{ backgroundColor: theme.primary }}
        >
          {loading ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
              Start Loading
            </Text>
          )}
        </Pressable>
      ) : (
        <Pressable
          onPress={onLoaded}
          disabled={loading}
          className="rounded-xl py-4 items-center"
          style={{ backgroundColor: theme.primary }}
        >
          {loading ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
              Loaded — Start Delivery
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
