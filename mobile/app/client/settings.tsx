import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Bell, Mail } from "lucide-react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useToast } from "@/hooks/useToast";
import { ToastMessage } from "@/components/ui/ToastMessage";
import {
  CATEGORIES,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notificationPreferencesApi";
import { promptRingPermissionsOnce } from "@/lib/ringNotification";
import { updateUser } from "@/lib/api";

const CLIENT_USER_KEY = "water_user";

export default function ClientNotificationSettings() {
  const { theme } = useAppTheme();
  const { toast, showToast } = useToast();

  const [actorId, setActorId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(CLIENT_USER_KEY);
        const user = raw ? JSON.parse(raw) : null;
        const id = user?.id ? String(user.id) : null;
        setActorId(id);
        setEmail(user?.email ?? "");
        if (!id) return;

        const result = await getNotificationPreferences("customer", id);
        setPrefs(result.preferences);
      } catch {
        // each category's own defaultValue will be rendered (see CATEGORIES)
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveEmail() {
    if (!actorId) return;
    setSavingEmail(true);
    try {
      const trimmed = email.trim();
      const updated = await updateUser(Number(actorId), { email: trimmed || null });
      const raw = await AsyncStorage.getItem(CLIENT_USER_KEY);
      const user = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(CLIENT_USER_KEY, JSON.stringify({ ...user, email: updated.email }));
      showToast("Email saved");
    } catch {
      showToast("Failed to save email", false);
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleToggle(key: string, value: boolean) {
    if (!actorId) return;
    setSaving(key);
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    try {
      const result = await updateNotificationPreferences("customer", actorId, { [key]: value });
      setPrefs(result.preferences);
      showToast("Preference saved");
      if (key === "arrival_ring" && value) {
        // One-time nudge for full-screen-intent/battery permissions — only
        // relevant once the customer actually opts into the ring.
        promptRingPermissionsOnce().catch(() => {});
      }
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
            Email for receipts
          </Text>

          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderRadius: 14,
              borderWidth: 1,
              marginBottom: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Mail color={theme.mutedForeground} size={16} />
              <Text style={{ color: theme.mutedForeground }} className="text-xs">
                Get a PDF receipt emailed after each delivery
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  color: theme.foreground,
                  backgroundColor: theme.input,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              />
              <Pressable
                onPress={handleSaveEmail}
                disabled={savingEmail || !actorId}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  opacity: savingEmail || !actorId ? 0.6 : 1,
                }}
              >
                {savingEmail ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff" }} className="font-semibold text-sm">
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <Text
            style={{ color: theme.mutedForeground }}
            className="text-xs font-medium uppercase tracking-wider mb-2"
          >
            Choose what to receive
          </Text>

          {categories.map((cat, i) => {
            const enabled = prefs[cat.key] ?? cat.defaultValue;
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
