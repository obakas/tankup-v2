import { useState } from "react";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { View, Text, Pressable, ActivityIndicator, Switch, ScrollView, Alert, Image } from "react-native";
import { Camera, Image as ImageIcon, MapPin, Plus, X } from "lucide-react-native";
import { createUser, loginUser, createSite, uploadSitePhoto, type TankFloorLevel } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { CurrentUser } from "@/types/client";
import { DEFAULT_LAT, DEFAULT_LNG } from "@/constants/clientConstants";
import { useAppTheme } from "@/hooks/useAppTheme";

interface SiteFormData {
  label: string;
  landmarkNotes: string;
  tankCapacity: string;
  tankFloorLevel: TankFloorLevel | null;
  hasGate: boolean;
  gateNotes: string;
  latitude: number;
  longitude: number;
  locationCaptured: boolean;
  capturingLocation: boolean;
  locationPermissionDenied: boolean;
  photoUri: string | null;
  photoMimeType: string | null;
}

const FLOOR_OPTIONS: { value: TankFloorLevel; label: string }[] = [
  { value: "ground", label: "Ground" },
  { value: "first_floor", label: "1st Floor" },
  { value: "second_floor", label: "2nd Floor" },
  { value: "third_floor", label: "3rd Floor" },
  { value: "rooftop", label: "Roof" },
];

const newSite = (label = ""): SiteFormData => ({
  label,
  landmarkNotes: "",
  tankCapacity: "",
  tankFloorLevel: null,
  hasGate: false,
  gateNotes: "",
  latitude: DEFAULT_LAT,
  longitude: DEFAULT_LNG,
  locationCaptured: false,
  capturingLocation: false,
  locationPermissionDenied: false,
  photoUri: null,
  photoMimeType: null,
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

  const captureSiteLocation = async (index: number) => {
    updateSite(index, { capturingLocation: true, locationPermissionDenied: false });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        updateSite(index, { capturingLocation: false, locationPermissionDenied: true });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateSite(index, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        locationCaptured: true,
        capturingLocation: false,
      });
    } catch {
      updateSite(index, { capturingLocation: false });
      setError("Could not get your location. Please try again.");
    }
  };

  const pickSitePhoto = async (index: number, source: "camera" | "gallery") => {
    const permResult =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permResult.granted) {
      Alert.alert(
        "Permission required",
        source === "camera"
          ? "Camera access is needed to take a photo."
          : "Photo library access is needed to choose a photo."
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: false });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      updateSite(index, { photoUri: asset.uri, photoMimeType: asset.mimeType ?? "image/jpeg" });
    }
  };

  const showSitePhotoPicker = (index: number) => {
    Alert.alert("Tank Photo", "How would you like to add a photo?", [
      { text: "Take Photo", onPress: () => pickSitePhoto(index, "camera") },
      { text: "Choose from Library", onPress: () => pickSitePhoto(index, "gallery") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

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
            sites.map(async (site) => {
              const rawCapacity = site.tankCapacity.trim();
              const saved = await createSite({
                user_id: user.id,
                latitude: site.latitude,
                longitude: site.longitude,
                label: site.label.trim() || "Home",
                address: address.trim(),
                landmark_notes: site.landmarkNotes.trim() || undefined,
                tank_capacity_liters: rawCapacity ? parseInt(rawCapacity, 10) : undefined,
                tank_floor_level: site.tankFloorLevel ?? undefined,
                has_gate: site.hasGate,
                gate_notes: site.hasGate && site.gateNotes.trim() ? site.gateNotes.trim() : undefined,
              });
              if (site.photoUri && site.photoMimeType) {
                await uploadSitePhoto(saved.id, site.photoUri, site.photoMimeType);
              }
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

                {/* Delivery location */}
                <View className="gap-2">
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>Delivery Location</Text>
                  <Text className="text-xs" style={{ color: theme.mutedForeground }}>
                    Go to this site and tap the button below so drivers can find you.
                  </Text>
                  <Pressable
                    onPress={() => captureSiteLocation(i)}
                    disabled={site.capturingLocation}
                    className="flex-row items-center justify-center gap-2 rounded-xl py-3"
                    style={{
                      borderWidth: 1,
                      borderColor: site.locationCaptured ? theme.success : theme.border,
                      backgroundColor: site.locationCaptured ? theme.successSoft : theme.background,
                    }}
                  >
                    {site.capturingLocation ? (
                      <ActivityIndicator color={theme.primary} size={16} />
                    ) : (
                      <>
                        <MapPin size={16} color={site.locationCaptured ? theme.success : theme.primary} />
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: site.locationCaptured ? theme.success : theme.foreground }}
                        >
                          {site.locationCaptured ? "Location captured ✓" : "I'm at this site — use my current location"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {site.locationPermissionDenied && (
                    <Text className="text-xs" style={{ color: theme.destructive }}>
                      Location permission denied. Please enable it in Settings.
                    </Text>
                  )}
                </View>

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

                {/* Tank floor level */}
                <View className="gap-2">
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                    Tank Location <Text className="font-normal">(optional)</Text>
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {FLOOR_OPTIONS.map((opt) => {
                      const selected = site.tankFloorLevel === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => updateSite(i, { tankFloorLevel: selected ? null : opt.value })}
                          className="rounded-lg px-3 py-2"
                          style={{
                            borderWidth: 1,
                            borderColor: selected ? theme.primary : theme.border,
                            backgroundColor: selected ? theme.primary + "22" : theme.background,
                          }}
                        >
                          <Text
                            className="text-sm"
                            style={{ fontWeight: selected ? "700" : "400", color: selected ? theme.primary : theme.foreground }}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Tank photo */}
                <View className="gap-2">
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                    Tank Photo <Text className="font-normal">(optional — helps drivers estimate height)</Text>
                  </Text>
                  {site.photoUri ? (
                    <View className="gap-2">
                      <Image
                        source={{ uri: site.photoUri }}
                        style={{ width: "100%", height: 140, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => showSitePhotoPicker(i)}
                          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5"
                          style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }}
                        >
                          <Camera size={14} color={theme.mutedForeground} />
                          <Text className="text-sm" style={{ color: theme.foreground }}>Retake</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => updateSite(i, { photoUri: null, photoMimeType: null })}
                          className="rounded-lg px-3.5 py-2.5"
                          style={{ borderWidth: 1, borderColor: theme.destructive, backgroundColor: theme.destructiveSoft }}
                        >
                          <Text className="text-sm" style={{ color: theme.destructive }}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => showSitePhotoPicker(i)}
                      className="flex-row items-center justify-center gap-2 rounded-xl border-dashed py-6"
                      style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }}
                    >
                      <ImageIcon size={18} color={theme.mutedForeground} />
                      <Text className="text-sm" style={{ color: theme.mutedForeground }}>Add Tank Photo</Text>
                    </Pressable>
                  )}
                </View>

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
