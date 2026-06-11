import { useState } from "react";
import * as Location from "expo-location";
import { View, Text, Pressable, ActivityIndicator, Switch, ScrollView } from "react-native";
import { Plus, X } from "lucide-react-native";
import { createUser, loginUser, createSite } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { CurrentUser } from "@/types/client";
import { DEFAULT_LAT, DEFAULT_LNG } from "@/constants/clientConstants";
import { useAppTheme } from "@/hooks/useAppTheme";

interface SiteFormData {
  label: string;
  landmarkNotes: string;
  tankCapacity: string;
  hasGate: boolean;
  gateNotes: string;
}

const newSite = (label = ""): SiteFormData => ({
  label,
  landmarkNotes: "",
  tankCapacity: "",
  hasGate: false,
  gateNotes: "",
});

type AuthStepProps = {
  onComplete: (user: CurrentUser, isSignup: boolean) => void;
};

export function AuthStep({ onComplete }: AuthStepProps) {
  const { theme } = useAppTheme();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sites, setSites] = useState<SiteFormData[]>([newSite("Home")]);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const isSignup = mode === "signup";

  const updateSite = (index: number, patch: Partial<SiteFormData>) =>
    setSites((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const addSite = () => setSites((prev) => [...prev, newSite()]);

  const removeSite = (index: number) =>
    setSites((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!phone.trim()) { setError("Phone number is required"); return; }
    if (isSignup && (!name.trim() || !address.trim())) {
      setError("Name, phone number, and address are required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const user = isSignup
        ? await createUser({ name: name.trim(), phone: phone.trim(), address: address.trim() })
        : await loginUser({ phone: phone.trim() });

      if (isSignup) {
        let lat = DEFAULT_LAT;
        let lng = DEFAULT_LNG;
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          }
        } catch {
          // silently fall back to Abuja defaults
        }

        try {
          await Promise.allSettled(
            sites.map((site) => {
              const rawCapacity = site.tankCapacity.trim();
              return createSite({
                user_id: user.id,
                latitude: lat,
                longitude: lng,
                label: site.label.trim() || "Home",
                address: address.trim(),
                landmark_notes: site.landmarkNotes.trim() || undefined,
                tank_capacity_liters: rawCapacity ? parseInt(rawCapacity, 10) : undefined,
                has_gate: site.hasGate,
                gate_notes: site.hasGate && site.gateNotes.trim() ? site.gateNotes.trim() : undefined,
              });
            })
          );
        } catch {
          // Site creation is best-effort; account was created successfully
        }
      }

      onComplete(user, isSignup);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isSignup ? "Failed to create account" : "Failed to log in"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View className="gap-4">
        {/* Mode tabs */}
        <View
          className="flex-row rounded-xl p-1"
          style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.muted + "4d" }}
        >
          <Pressable
            onPress={() => setMode("signup")}
            className="flex-1 rounded-lg py-3 items-center"
            style={isSignup ? { backgroundColor: theme.background } : undefined}
          >
            <Text
              className="font-semibold"
              style={{ color: isSignup ? theme.foreground : theme.mutedForeground }}
            >
              Sign Up
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("login")}
            className="flex-1 rounded-lg py-3 items-center"
            style={!isSignup ? { backgroundColor: theme.background } : undefined}
          >
            <Text
              className="font-semibold"
              style={{ color: !isSignup ? theme.foreground : theme.mutedForeground }}
            >
              Log In
            </Text>
          </Pressable>
        </View>

        {error && (
          <View
            className="rounded-xl p-3"
            style={{ backgroundColor: theme.destructiveSoft, borderWidth: 1, borderColor: theme.destructive + "4d" }}
          >
            <Text className="text-sm" style={{ color: theme.destructive }}>{error}</Text>
          </View>
        )}

        {/* Account fields */}
        {isSignup && (
          <>
            <Input label="Full Name" value={name} onChangeText={setName} placeholder="Amina Hassan" />
            <Input
              label="Delivery Address"
              value={address}
              onChangeText={setAddress}
              placeholder="12 Gana St, Maitama, Abuja"
            />
          </>
        )}

        <Input
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="+234..."
          keyboardType="phone-pad"
        />

        {/* Delivery sites section (signup only) */}
        {isSignup && (
          <View className="gap-3">
            {/* Section separator */}
            <View className="flex-row items-center gap-2">
              <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
              <Text className="text-xs font-medium" style={{ color: theme.mutedForeground }}>Delivery Sites</Text>
              <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
            </View>

            {sites.map((site, i) => (
              <View
                key={i}
                className="gap-3 rounded-xl p-3"
                style={{ borderWidth: 1, borderColor: theme.border }}
              >
                {/* Site card header */}
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold" style={{ color: theme.mutedForeground }}>Site {i + 1}</Text>
                  {sites.length > 1 && (
                    <Pressable
                      onPress={() => removeSite(i)}
                      accessibilityLabel={`Remove site ${i + 1}`}
                      className="h-6 w-6 items-center justify-center rounded-md"
                    >
                      <X size={14} color={theme.destructive} />
                    </Pressable>
                  )}
                </View>

                <Input
                  label="Site Label"
                  value={site.label}
                  onChangeText={(v) => updateSite(i, { label: v })}
                  placeholder="Home, Office, Warehouse…"
                />

                <Input
                  label="Landmark / Notes (optional)"
                  value={site.landmarkNotes}
                  onChangeText={(v) => updateSite(i, { landmarkNotes: v })}
                  placeholder="Blue gate, beside the school"
                />

                <Input
                  label="Tank Capacity in liters (optional)"
                  value={site.tankCapacity}
                  onChangeText={(v) => updateSite(i, { tankCapacity: v })}
                  placeholder="e.g. 5000"
                  keyboardType="phone-pad"
                />

                <View
                  className="flex-row items-center justify-between rounded-xl px-4 py-3"
                  style={{ borderWidth: 1, borderColor: theme.border }}
                >
                  <Text className="text-sm" style={{ color: theme.foreground }}>Has gate / barrier?</Text>
                  <Switch
                    value={site.hasGate}
                    onValueChange={(v) => updateSite(i, { hasGate: v, gateNotes: v ? site.gateNotes : "" })}
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor={theme.primaryForeground}
                  />
                </View>

                {site.hasGate && (
                  <Input
                    label="Gate Notes (optional)"
                    value={site.gateNotes}
                    onChangeText={(v) => updateSite(i, { gateNotes: v })}
                    placeholder="Call ahead, code is 1234…"
                  />
                )}
              </View>
            ))}

            {/* Add another site */}
            <Pressable
              onPress={addSite}
              className="flex-row items-center justify-center gap-2 rounded-xl border-dashed py-3"
              style={{ borderWidth: 1, borderColor: theme.border }}
            >
              <Plus size={16} color={theme.mutedForeground} />
              <Text className="text-sm font-medium" style={{ color: theme.mutedForeground }}>Add Another Site</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="rounded-xl py-4 items-center mt-2"
          style={{ backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
              {isSignup ? "Create Account" : "Log In"}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
