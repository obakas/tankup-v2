import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Bell } from "lucide-react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useToast } from "@/hooks/useToast";
import { ToastMessage } from "@/components/ui/ToastMessage";
import {
  CATEGORIES,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notificationPreferencesApi";

const RED = "#ef4444";
const RED_SOFT = "rgba(239,68,68,0.12)";

export default function AdminNotificationSettings() {
  const { theme } = useAppTheme();
  const { toast, showToast } = useToast();
  const { actor_id } = useLocalSearchParams<{ actor_id: string }>();

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!actor_id) {
      setLoading(false);
      return;
    }
    getNotificationPreferences("admin", actor_id)
      .then((res) => setPrefs(res.preferences))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [actor_id]);

  async function handleToggle(key: string, value: boolean) {
    if (!actor_id) return;
    setSaving(key);
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    try {
      const result = await updateNotificationPreferences("admin", actor_id, { [key]: value });
      setPrefs(result.preferences);
      showToast("Preference saved");
    } catch {
      setPrefs({ ...optimistic, [key]: !value });
      showToast("Failed to save", false);
    } finally {
      setSaving(null);
    }
  }

  const categories = CATEGORIES.admin;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ToastMessage toast={toast} theme={theme} />

      <View
        style={{ backgroundColor: theme.card, borderBottomColor: theme.border }}
        className="flex-row items-center gap-3 px-4 py-3 border-b"
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          className="p-2 -ml-2"
        >
          <ArrowLeft color={theme.mutedForeground} size={21} />
        </Pressable>
        <View style={{ backgroundColor: RED_SOFT, borderRadius: 8, padding: 6 }}>
          <Bell color={RED} size={16} />
        </View>
        <View className="flex-1">
          <Text style={{ color: theme.foreground }} className="font-bold text-base">
            Notification Settings
          </Text>
          <Text style={{ color: theme.mutedForeground }} className="text-xs">
            Admin preferences
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={RED} />
        </View>
      ) : !actor_id ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text style={{ color: theme.mutedForeground }} className="text-center text-sm">
            No admin session found.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text
            style={{ color: theme.mutedForeground }}
            className="text-xs font-medium uppercase tracking-wider mb-4"
          >
            Choose what to receive
          </Text>

          {categories.map((cat, i) => {
            const enabled = prefs[cat.key] !== false;
            return (
              <View
                key={cat.key}
                style={{
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderRadius: 14,
                  borderWidth: 1,
                  marginBottom: i < categories.length - 1 ? 8 : 0,
                }}
              >
                <View
                  className="flex-row items-center justify-between px-4"
                  style={{ paddingVertical: 16 }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ color: theme.foreground }} className="font-semibold text-sm">
                      {cat.label}
                    </Text>
                    <Text style={{ color: theme.mutedForeground }} className="text-xs mt-1">
                      {cat.description}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(val) => handleToggle(cat.key, val)}
                    disabled={saving === cat.key}
                    trackColor={{ true: RED, false: theme.border }}
                    thumbColor={enabled ? "#fff" : theme.muted}
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
