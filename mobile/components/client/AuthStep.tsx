import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Switch, ScrollView } from "react-native";
import { Plus, X } from "lucide-react-native";
import { createUser, loginUser, createSite } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { CurrentUser } from "@/types/client";
import { DEFAULT_LAT, DEFAULT_LNG } from "@/constants/clientConstants";

const PRIMARY = "#0084ff";

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
        try {
          await Promise.allSettled(
            sites.map((site) => {
              const rawCapacity = site.tankCapacity.trim();
              return createSite({
                user_id: user.id,
                latitude: DEFAULT_LAT,
                longitude: DEFAULT_LNG,
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
        <View className="flex-row rounded-xl border border-border p-1 bg-muted/30">
          <Pressable
            onPress={() => setMode("signup")}
            className={`flex-1 rounded-lg py-3 items-center ${isSignup ? "bg-background" : ""}`}
          >
            <Text className={isSignup ? "text-foreground font-semibold" : "text-muted"}>
              Sign Up
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("login")}
            className={`flex-1 rounded-lg py-3 items-center ${!isSignup ? "bg-background" : ""}`}
          >
            <Text className={!isSignup ? "text-foreground font-semibold" : "text-muted"}>
              Log In
            </Text>
          </Pressable>
        </View>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-red-600 text-sm">{error}</Text>
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
              <View className="flex-1 h-px bg-border" />
              <Text className="text-xs font-medium text-muted-foreground">Delivery Sites</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {sites.map((site, i) => (
              <View
                key={i}
                className="gap-3 rounded-xl border border-border p-3"
              >
                {/* Site card header */}
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-muted-foreground">Site {i + 1}</Text>
                  {sites.length > 1 && (
                    <Pressable
                      onPress={() => removeSite(i)}
                      accessibilityLabel={`Remove site ${i + 1}`}
                      className="h-6 w-6 items-center justify-center rounded-md"
                    >
                      <X size={14} color="#ef4444" />
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

                <View className="flex-row items-center justify-between rounded-xl border border-border px-4 py-3">
                  <Text className="text-foreground text-sm">Has gate / barrier?</Text>
                  <Switch
                    value={site.hasGate}
                    onValueChange={(v) => updateSite(i, { hasGate: v, gateNotes: v ? site.gateNotes : "" })}
                    trackColor={{ false: "#d1d5db", true: PRIMARY }}
                    thumbColor="#fff"
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
              className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3"
            >
              <Plus size={16} color="#6b7280" />
              <Text className="text-sm font-medium text-muted-foreground">Add Another Site</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="bg-primary rounded-xl py-4 items-center mt-2 disabled:opacity-60"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">
              {isSignup ? "Create Account" : "Log In"}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
