import { ActivityIndicator, Pressable, Text, View } from "react-native";

type Props = {
  job: any;
  onLoaded: () => void;
  loading: boolean;
};

export function DriverLoadingStep({ job, onLoaded, loading }: Props) {
  const totalVol =
    job?.active_job?.total_volume_liters ??
    job?.total_volume_liters ??
    job?.volume_liters ??
    "—";

  const jobType = job?.active_job?.job_type ?? job?.job_type ?? "batch";

  return (
    <View className="gap-4">
      <View className="bg-card border border-border rounded-2xl p-5">
        <Text className="text-foreground font-semibold capitalize">{jobType} job — Load tanker</Text>
        <Text className="text-muted-foreground mt-2">
          Fill {typeof totalVol === "number" ? totalVol.toLocaleString() : totalVol}L at the depot before heading out.
        </Text>
      </View>

      <Pressable onPress={onLoaded} disabled={loading} className="bg-primary rounded-xl py-4 items-center">
        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Loaded — Start Delivery</Text>}
      </Pressable>
    </View>
  );
}
