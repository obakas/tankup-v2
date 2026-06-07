import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { ClipboardList, X } from "lucide-react-native";

import { fetchDriverHistory, type DriverHistoryItem } from "@/lib/api";
import { useAppTheme } from "@/hooks/useAppTheme";
import { parseApiDate } from "@/lib/utils";

type Props = {
  visible: boolean;
  onClose: () => void;
  tankerId: number | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = parseApiDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short", hour12: true }).format(date);
}

function prettyStatus(value?: string | null) {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

export function DeliveryHistoryModal({ visible, onClose, tankerId }: Props) {
  const { theme } = useAppTheme();
  const [items, setItems] = useState<DriverHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible || !tankerId) return;

    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchDriverHistory(tankerId!);
        if (!mounted) return;
        setItems(data.items ?? []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load delivery history");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [visible, tankerId]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{
            backgroundColor: theme.card,
            borderBottomColor: theme.border,
          }}
          className="px-4 py-4 border-b flex-row items-center justify-between"
        >
          <View>
            <Text style={{ color: theme.foreground }} className="text-lg font-bold">
              Delivery History
            </Text>
            <Text style={{ color: theme.mutedForeground }} className="text-xs">
              Your completed and past deliveries
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

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {loading && (
            <View className="py-10 items-center">
              <ActivityIndicator />
              <Text style={{ color: theme.mutedForeground }} className="mt-3">
                Loading delivery history...
              </Text>
            </View>
          )}

          {!!error && (
            <View
              style={{ backgroundColor: theme.card, borderColor: theme.border }}
              className="rounded-2xl border p-4"
            >
              <Text className="text-red-500 font-semibold">{error}</Text>
            </View>
          )}

          {!loading && !error && items.length === 0 && (
            <View
              style={{ backgroundColor: theme.card, borderColor: theme.border }}
              className="rounded-2xl border p-8 items-center gap-4"
            >
              <View
                className="w-16 h-16 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.cardSoft }}
              >
                <ClipboardList color={theme.mutedForeground} size={30} />
              </View>
              <View className="items-center gap-1">
                <Text style={{ color: theme.foreground }} className="font-bold text-base">
                  No deliveries yet
                </Text>
                <Text
                  style={{ color: theme.mutedForeground }}
                  className="text-sm text-center leading-5"
                >
                  Your completed and past delivery jobs will appear here.
                </Text>
              </View>
            </View>
          )}

          {!loading &&
            !error &&
            items.map((item) => (
              <View
                key={item.job_id}
                style={{ backgroundColor: theme.card, borderColor: theme.border }}
                className="rounded-2xl border p-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text style={{ color: theme.foreground }} className="font-bold">
                      {item.job_type === "batch" ? "Batch Job" : "Priority Job"} #{item.job_id}
                    </Text>
                    <Text style={{ color: theme.mutedForeground }} className="text-sm mt-1">
                      {item.total_actual_liters_delivered}L delivered • {prettyStatus(item.job_status)}
                    </Text>
                  </View>

                  <View
                    style={{ borderColor: theme.border }}
                    className="rounded-full border px-3 py-1"
                  >
                    <Text style={{ color: theme.foreground }} className="text-xs capitalize">
                      {item.job_type}
                    </Text>
                  </View>
                </View>

                <View className="mt-4 gap-2">
                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Started: {formatDate(item.started_at)}
                  </Text>
                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Completed: {formatDate(item.completed_at)}
                  </Text>
                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Stops: {item.delivered_stops}/{item.total_stops} delivered
                    {item.failed_stops > 0 ? ` • ${item.failed_stops} failed` : ""}
                    {item.skipped_stops > 0 ? ` • ${item.skipped_stops} skipped` : ""}
                  </Text>
                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Planned: {item.total_planned_liters}L
                  </Text>
                </View>
              </View>
            ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
