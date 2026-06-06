import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Phone, User } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SiteCard } from "@/components/driver/SiteCard";
import { SafeMapView, SafeMultiMapView } from "@/components/ui/SafeMapView";

type Props = {
  job: any;
  onStartLoading: () => void;
  onLoaded: () => void;
  loading: boolean;
  driverLat?: number | null;
  driverLon?: number | null;
};

export function DriverLoadingStep({ job, onStartLoading, onLoaded, loading, driverLat, driverLon }: Props) {
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

  const firstStopLat: number | null =
    jobType === "priority"
      ? (priorityCustomer?.latitude ?? null)
      : (members[0]?.latitude ?? null);
  const firstStopLon: number | null =
    jobType === "priority"
      ? (priorityCustomer?.longitude ?? null)
      : (members[0]?.longitude ?? null);

  const stopMarkers = (jobType === "priority" && firstStopLat != null && firstStopLon != null)
    ? [{
        id: 0,
        lat: firstStopLat,
        lon: firstStopLon,
        title: priorityCustomer?.name ?? "Customer",
        description: priorityCustomer?.address ?? priorityCustomer?.site?.address ?? undefined,
        pinColor: "#16a34a",
      }]
    : members
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m, i) => ({
          id: m.id ?? i,
          lat: m.latitude,
          lon: m.longitude,
          title: m.name ?? `Stop ${i + 1}`,
          description: m.address ?? m.site?.address ?? undefined,
          pinColor: "#16a34a",
        }));

  const hasDriverLocation = driverLat != null && driverLon != null;
  const hasStopLocations = stopMarkers.length > 0;

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

      {/* Map — driver location + first delivery stop */}
      {hasDriverLocation && hasStopLocations && (
        <SafeMapView
          driver={{ lat: driverLat!, lon: driverLon!, label: "Your tanker" }}
          customer={{
            lat: firstStopLat!,
            lon: firstStopLon!,
            label: jobType === "priority" ? (priorityCustomer?.name ?? "Customer") : (members[0]?.name ?? "First stop"),
            pinColor: "#16a34a",
          }}
          navigateTo={{
            lat: firstStopLat!,
            lon: firstStopLon!,
            label: jobType === "priority" ? (priorityCustomer?.name ?? "Customer") : "First stop",
          }}
          height={220}
          showPolyline={false}
        />
      )}
      {!hasDriverLocation && hasStopLocations && (
        <SafeMultiMapView
          markers={stopMarkers}
          initialLat={stopMarkers[0].lat}
          initialLon={stopMarkers[0].lon}
          height={220}
        />
      )}

      {/* Priority — single customer site */}
      {jobType === "priority" && priorityCustomer && (
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View className="flex-row items-center gap-2">
            <User color={theme.success} size={15} />
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
          {!priorityCustomer.site && priorityCustomer.address && (
            <Text className="text-sm mt-2" style={{ color: theme.mutedForeground }}>{priorityCustomer.address}</Text>
          )}
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
              style={{ backgroundColor: theme.success }}
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
          {!member.site && member.address && (
            <Text className="text-sm mt-2" style={{ color: theme.mutedForeground }}>{member.address}</Text>
          )}
        </View>
      ))}

      {!isLoading ? (
        <Pressable
          onPress={onStartLoading}
          disabled={loading}
          className="rounded-xl py-4 items-center"
          style={{ backgroundColor: theme.success }}
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
          style={{ backgroundColor: theme.success }}
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
