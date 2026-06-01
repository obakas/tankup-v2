import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Phone, User } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SiteCard } from "@/components/driver/SiteCard";

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

  const members: any[] = job?.active_job?.members ?? [];
  const priorityCustomer = job?.active_job?.customer ?? null;

  return (
    <View className="gap-4">
      {/* Summary */}
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

      {/* Priority — single customer site */}
      {jobType === "priority" && priorityCustomer && (
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View className="flex-row items-center gap-2">
            <User color={theme.primary} size={15} />
            <Text className="font-semibold flex-1" style={{ color: theme.foreground }}>
              {priorityCustomer.name ?? "Customer"}
            </Text>
            {priorityCustomer.phone && (
              <View className="flex-row items-center gap-1">
                <Phone color={theme.mutedForeground} size={13} />
                <Text className="text-xs" style={{ color: theme.mutedForeground }}>{priorityCustomer.phone}</Text>
              </View>
            )}
          </View>
          <SiteCard site={priorityCustomer.site} volume={priorityCustomer.volume_liters} />
        </View>
      )}

      {/* Batch — per-stop breakdown */}
      {jobType !== "priority" && members.map((member: any, idx: number) => (
        <View
          key={member.id ?? idx}
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View className="flex-row items-center gap-2">
            <View
              className="w-6 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: theme.primary }}
            >
              <Text className="text-xs font-bold" style={{ color: theme.primaryForeground }}>
                {idx + 1}
              </Text>
            </View>
            <Text className="font-semibold flex-1" style={{ color: theme.foreground }}>
              {member.name ?? `Stop ${idx + 1}`}
            </Text>
            {member.phone && (
              <View className="flex-row items-center gap-1">
                <Phone color={theme.mutedForeground} size={12} />
                <Text className="text-xs" style={{ color: theme.mutedForeground }}>{member.phone}</Text>
              </View>
            )}
          </View>
          <SiteCard site={member.site} volume={member.volume_liters} />
        </View>
      ))}

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
