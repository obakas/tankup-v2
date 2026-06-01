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
import { router } from "expo-router";
import { ArrowLeft, Bell } from "lucide-react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useToast } from "@/hooks/useToast";
import { ToastMessage } from "@/components/ui/ToastMessage";
import {
  CATEGORIES,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notificationPreferencesApi";
import { getFleetHeadToken } from "@/lib/fleetHeadApi";

const VIOLET = "#8b5cf6";
const VIOLET_SOFT = "rgba(139,92,246,0.12)";

function decodeJwtUsername(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded?.username ?? null;
  } catch {
    return null;
  }
}

export default function FleetHeadNotificationSettings() {
  const { theme } = useAppTheme();
  const { toast, showToast } = useToast();

  const [actorId, setActorId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const adminHeaders = actorId
    ? { Authorization: `Bearer ${actorId}` }
    : undefined;

  useEffect(() => {
    async function load() {
      try {
        const token = await getFleetHeadToken();
        if (!token) return;
        const username = decodeJwtUsername(token);
        if (!username) return;
        setActorId(username);

        const result = await getNotificationPreferences("fleet_head", username, {
          Authorization: `Bearer ${token}`,
        });
        setPrefs(result.preferences);
      } catch {
        // show defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleToggle(key: string, value: boolean) {
    if (!actorId) return;
    setSaving(key);
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    try {
      const token = await getFleetHeadToken();
      const result = await updateNotificationPreferences(
        "fleet_head",
        actorId,
        { [key]: value },
        token ? { Authorization: `Bearer ${token}` } : undefined
      );
      setPrefs(result.preferences);
      showToast("Preference saved");
    } catch {
      setPrefs({ ...optimistic, [key]: !value });
      showToast("Failed to save", false);
    } finally {
      setSaving(null);
    }
  }

  const categories = CATEGORIES.fleet_head;

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
        <View style={{ backgroundColor: VIOLET_SOFT, borderRadius: 8, padding: 6 }}>
          <Bell color={VIOLET} size={16} />
        </View>
        <View className="flex-1">
          <Text style={{ color: theme.foreground }} className="font-bold text-base">
            Notification Settings
          </Text>
          <Text style={{ color: theme.mutedForeground }} className="text-xs">
            Fleet head preferences
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={VIOLET} />
        </View>
      ) : !actorId ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text style={{ color: theme.mutedForeground }} className="text-center text-sm">
            Log in as a fleet head to manage notification preferences.
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
                    trackColor={{ true: VIOLET, false: theme.border }}
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
