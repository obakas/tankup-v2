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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Bell } from "lucide-react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useToast } from "@/hooks/useToast";
import { ToastMessage } from "@/components/ui/ToastMessage";
import {
  CATEGORIES,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notificationPreferencesApi";

const CLIENT_USER_KEY = "water_user";

export default function ClientNotificationSettings() {
  const { theme } = useAppTheme();
  const { toast, showToast } = useToast();

  const [actorId, setActorId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(CLIENT_USER_KEY);
        const user = raw ? JSON.parse(raw) : null;
        const id = user?.id ? String(user.id) : null;
        setActorId(id);
        if (!id) return;

        const result = await getNotificationPreferences("customer", id);
        setPrefs(result.preferences);
      } catch {
        // defaults (all true) will be rendered via CATEGORIES
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
      const result = await updateNotificationPreferences("customer", actorId, { [key]: value });
      setPrefs(result.preferences);
      showToast("Preference saved");
    } catch {
      setPrefs({ ...optimistic, [key]: !value });
      showToast("Failed to save", false);
    } finally {
      setSaving(null);
    }
  }

  const categories = CATEGORIES.customer;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ToastMessage toast={toast} theme={theme} />

      {/* Header */}
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
        <View style={{ backgroundColor: theme.primarySoft, borderRadius: 8, padding: 6 }}>
          <Bell color={theme.primary} size={16} />
        </View>
        <View className="flex-1">
          <Text style={{ color: theme.foreground }} className="font-bold text-base">
            Notification Settings
          </Text>
          <Text style={{ color: theme.mutedForeground }} className="text-xs">
            Customer preferences
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 8 }}
        >
          <Text
            style={{ color: theme.mutedForeground }}
            className="text-xs font-medium uppercase tracking-wider mb-2"
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
                    <Text
                      style={{ color: theme.foreground }}
                      className="font-semibold text-sm"
                    >
                      {cat.label}
                    </Text>
                    <Text
                      style={{ color: theme.mutedForeground }}
                      className="text-xs mt-1"
                    >
                      {cat.description}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(val) => handleToggle(cat.key, val)}
                    disabled={saving === cat.key}
                    trackColor={{ true: theme.primary, false: theme.border }}
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
