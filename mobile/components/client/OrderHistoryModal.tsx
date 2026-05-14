import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";

import { fetchClientHistory, type ClientHistoryItem } from "@/lib/api";
import type { CurrentUser } from "@/types/client";

type Props = {
  visible: boolean;
  onClose: () => void;
  user: CurrentUser | null;
  theme: ReturnType<typeof import("@/components/ui/theme").getTheme>;
};

function prettyStatus(value?: string | null) {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

function statusLabel(item: ClientHistoryItem) {
  if (item.request_status === "partially_completed") return "Partially completed";
  if (item.request_status === "failed" || item.delivery_status === "failed") return "Failed";
  if (item.delivery_status === "skipped") return "Skipped";
  if (item.delivery_status === "delivered" || item.request_status === "completed") return "Delivered";
  if (item.request_status === "expired") return "Expired";

  if (item.delivery_type === "batch" && item.batch_status) {
    return prettyStatus(item.batch_status);
  }

  return prettyStatus(item.request_status);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function OrderHistoryModal({ visible, onClose, user, theme }: Props) {
  const [items, setItems] = useState<ClientHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible || !user?.id) return;

    const userId = user.id;
    let mounted = true;

    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const data = await fetchClientHistory(userId);

        if (!mounted) return;
        setItems(data.items ?? []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load order history");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      mounted = false;
    };
  }, [visible, user?.id]);

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
              Order History
            </Text>
            <Text style={{ color: theme.mutedForeground }} className="text-xs">
              Your previous TankUp requests
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
                Loading order history...
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
              className="rounded-2xl border p-5"
            >
              <Text style={{ color: theme.foreground }} className="font-bold text-base">
                No orders yet
              </Text>
              <Text style={{ color: theme.mutedForeground }} className="mt-1 text-sm">
                Your completed and active requests will appear here.
              </Text>
            </View>
          )}

          {!loading &&
            !error &&
            items.map((item) => (
              <View
                key={item.request_id}
                style={{ backgroundColor: theme.card, borderColor: theme.border }}
                className="rounded-2xl border p-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text style={{ color: theme.foreground }} className="font-bold">
                      {item.delivery_type === "batch" ? "Batch Order" : "Priority Order"} #
                      {item.request_id}
                    </Text>

                    <Text style={{ color: theme.mutedForeground }} className="text-sm mt-1">
                      {item.volume_liters}L • {statusLabel(item)}
                    </Text>
                  </View>

                  <View
                    style={{ borderColor: theme.border }}
                    className="rounded-full border px-3 py-1"
                  >
                    <Text style={{ color: theme.foreground }} className="text-xs capitalize">
                      {item.delivery_type}
                    </Text>
                  </View>
                </View>

                <View className="mt-4 gap-2">
                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Created: {formatDate(item.created_at)}
                  </Text>

                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Completed: {formatDate(item.completed_at || item.delivered_at)}
                  </Text>

                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Driver: {item.driver_name || "—"}
                  </Text>

                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Delivered: {item.actual_liters_delivered ?? item.planned_liters ?? "—"}L
                  </Text>

                  <Text style={{ color: theme.mutedForeground }} className="text-xs">
                    Status: {prettyStatus(item.delivery_status || item.batch_status || item.request_status)}
                  </Text>
                </View>
              </View>
            ))}
        </ScrollView>
      </View>
    </Modal>
  );
}