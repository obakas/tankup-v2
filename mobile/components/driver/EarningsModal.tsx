import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Banknote, X } from "lucide-react-native";

import {
  fetchDriverEarnings,
  type DriverEarningsResponse,
  type DriverEarningJobGroup,
} from "@/lib/api";
import { useAppTheme } from "@/hooks/useAppTheme";
import { parseApiDate } from "@/lib/utils";

type Period = "today" | "week" | "month" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = parseApiDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    hour12: true,
  }).format(date);
}

function JobCard({
  group,
  theme,
}: {
  group: DriverEarningJobGroup;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      style={{ backgroundColor: theme.card, borderColor: theme.border }}
      className="rounded-2xl border p-4 gap-3"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={{ color: theme.foreground }} className="font-bold">
            {group.job_type === "batch" ? "Batch Job" : "Priority Job"} #{group.job_id}
          </Text>
          <Text style={{ color: theme.mutedForeground }} className="text-xs mt-0.5">
            {group.stop_count} stop{group.stop_count !== 1 ? "s" : ""} •{" "}
            {group.total_volume_liters}L • {formatDate(group.completed_at)}
          </Text>
        </View>
        <Text style={{ color: theme.success }} className="text-lg font-bold">
          {naira(group.total_earnings)}
        </Text>
      </View>

      {/* Breakdown row */}
      <View className="flex-row gap-2">
        <View
          style={{ backgroundColor: theme.cardSoft, flex: 1 }}
          className="rounded-xl p-2.5"
        >
          <Text style={{ color: theme.mutedForeground }} className="text-xs">Volume</Text>
          <Text style={{ color: theme.foreground }} className="font-semibold text-sm">
            {naira(group.volume_earnings)}
          </Text>
        </View>
        <View
          style={{ backgroundColor: theme.cardSoft, flex: 1 }}
          className="rounded-xl p-2.5"
        >
          <Text style={{ color: theme.mutedForeground }} className="text-xs">Stop</Text>
          <Text style={{ color: theme.foreground }} className="font-semibold text-sm">
            {naira(group.stop_bonuses)}
          </Text>
        </View>
        <View
          style={{ backgroundColor: theme.successSoft, flex: 1 }}
          className="rounded-xl p-2.5"
        >
          <Text style={{ color: theme.success }} className="text-xs">Site</Text>
          <Text style={{ color: theme.success }} className="font-semibold text-sm">
            {naira(group.site_bonuses)}
          </Text>
        </View>
      </View>

      {group.stop_count > 1 && (
        <Pressable onPress={() => setExpanded((p) => !p)}>
          <Text style={{ color: theme.mutedForeground }} className="text-xs">
            {expanded ? "Hide stops" : "Show stop breakdown"}
          </Text>
        </Pressable>
      )}

      {(expanded || group.stop_count === 1) &&
        group.stops.map((stop, i) => (
          <View
            key={stop.id}
            style={{ borderTopColor: theme.border }}
            className="flex-row justify-between pt-2 border-t"
          >
            <Text style={{ color: theme.mutedForeground }} className="text-xs">
              Stop {stop.stop_order ?? i + 1} • {stop.actual_liters_delivered ?? 0}L
            </Text>
            <View className="items-end">
              <Text style={{ color: theme.foreground }} className="text-xs font-semibold">
                {naira(stop.volume_earnings + stop.stop_bonus)}
              </Text>
              {stop.site_bonus !== null ? (
                <Text style={{ color: theme.success }} className="text-xs">
                  +{naira(stop.site_bonus)} site
                </Text>
              ) : (
                <Text style={{ color: theme.mutedForeground }} className="text-xs">
                  site pending
                </Text>
              )}
            </View>
          </View>
        ))}
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  tankerId: number | null;
};

export function EarningsModal({ visible, onClose, tankerId }: Props) {
  const { theme } = useAppTheme();
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<DriverEarningsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible || !tankerId) return;

    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await fetchDriverEarnings(tankerId!, period);
        if (!mounted) return;
        setData(result);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load earnings");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [visible, tankerId, period]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View
          style={{ backgroundColor: theme.card, borderBottomColor: theme.border }}
          className="px-4 py-4 border-b flex-row items-center justify-between"
        >
          <View>
            <Text style={{ color: theme.foreground }} className="text-lg font-bold">
              Earnings
            </Text>
            <Text style={{ color: theme.mutedForeground }} className="text-xs">
              Your earnings by job
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={{ backgroundColor: theme.background }}
            className="h-10 w-10 rounded-full items-center justify-center"
          >
            <X color={theme.foreground} size={20} />
          </Pressable>
        </View>

        {/* Period tabs */}
        <View
          style={{ backgroundColor: theme.card, borderBottomColor: theme.border }}
          className="px-4 py-3 border-b flex-row gap-2"
        >
          {PERIODS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setPeriod(key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: period === key ? theme.success : theme.cardSoft,
              }}
            >
              <Text
                style={{
                  color: period === key ? theme.primaryForeground : theme.mutedForeground,
                  fontWeight: period === key ? "700" : "400",
                  fontSize: 13,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {loading && (
            <View className="py-10 items-center">
              <ActivityIndicator />
              <Text style={{ color: theme.mutedForeground }} className="mt-3">
                Loading earnings...
              </Text>
            </View>
          )}

          {!!error && (
            <View
              style={{ backgroundColor: theme.card, borderColor: theme.border }}
              className="rounded-2xl border p-4"
            >
              <Text className="text-red-500">{error}</Text>
            </View>
          )}

          {!loading && !error && data && (
            <>
              {/* Summary cards */}
              <View className="flex-row gap-3">
                <View
                  style={{ backgroundColor: theme.successSoft, flex: 1 }}
                  className="rounded-2xl p-4"
                >
                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Total
                  </Text>
                  <Text style={{ color: theme.success }} className="text-xl font-bold">
                    {naira(data.summary.total)}
                  </Text>
                </View>
                <View
                  style={{ backgroundColor: theme.cardSoft, flex: 1 }}
                  className="rounded-2xl p-4"
                >
                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Bonuses
                  </Text>
                  <Text style={{ color: theme.foreground }} className="text-xl font-bold">
                    {naira(data.summary.stop_bonuses + data.summary.site_bonuses)}
                  </Text>
                </View>
              </View>

              <Text style={{ color: theme.mutedForeground }} className="text-xs">
                {data.summary.job_count} job{data.summary.job_count !== 1 ? "s" : ""},{" "}
                {data.summary.stop_count} stop{data.summary.stop_count !== 1 ? "s" : ""}
              </Text>

              {data.jobs.length === 0 ? (
                <View
                  style={{ backgroundColor: theme.card, borderColor: theme.border }}
                  className="rounded-2xl border p-8 items-center gap-4"
                >
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center"
                    style={{ backgroundColor: theme.cardSoft }}
                  >
                    <Banknote color={theme.mutedForeground} size={30} />
                  </View>
                  <Text style={{ color: theme.mutedForeground }} className="text-sm text-center">
                    No earnings for this period yet.
                  </Text>
                </View>
              ) : (
                data.jobs.map((group) => (
                  <JobCard
                    key={`${group.job_type}-${group.job_id}`}
                    group={group}
                    theme={theme}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
