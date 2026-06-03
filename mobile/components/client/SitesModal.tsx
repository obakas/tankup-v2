import { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ChevronLeft, Image as ImageIcon, MapPin, Pencil, Plus, Trash2, X } from "lucide-react-native";
import type { TankupTheme } from "@/components/ui/theme";
import type { CurrentUser } from "@/types/client";
import {
  createSite,
  deleteSite,
  listUserSites,
  updateSite,
  uploadSitePhoto,
  type SiteProfileResponse,
  type TankFloorLevel,
} from "@/lib/api";
import { DEFAULT_LAT, DEFAULT_LNG } from "@/constants/clientConstants";

interface SiteFormData {
  label: string;
  address: string;
  landmark_notes: string;
  tank_capacity_liters: string;
  tank_floor_level: TankFloorLevel | null;
  has_gate: boolean;
  gate_notes: string;
}

interface PendingPhoto {
  uri: string;
  mimeType: string;
}

const EMPTY_FORM: SiteFormData = {
  label: "",
  address: "",
  landmark_notes: "",
  tank_capacity_liters: "",
  tank_floor_level: null,
  has_gate: false,
  gate_notes: "",
};

const STATUS_LABELS: Record<string, string> = {
  unverified: "Unverified",
  partially_verified: "Partly Verified",
  verified: "Verified",
  high_risk: "High Risk",
  restricted: "Restricted",
};

const FLOOR_OPTIONS: { value: TankFloorLevel; label: string }[] = [
  { value: "ground", label: "Ground" },
  { value: "first_floor", label: "1st Floor" },
  { value: "second_floor", label: "2nd Floor" },
  { value: "third_floor", label: "3rd Floor" },
  { value: "rooftop", label: "Roof" },
];

type Props = {
  visible: boolean;
  user: CurrentUser;
  theme: TankupTheme;
  onClose: () => void;
};

export function SitesModal({ visible, user, theme, onClose }: Props) {
  const [sites, setSites] = useState<SiteProfileResponse[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [view, setView] = useState<"list" | "form">("list");
  const [editingSite, setEditingSite] = useState<SiteProfileResponse | null>(null);
  const [form, setForm] = useState<SiteFormData>(EMPTY_FORM);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const data = await listUserSites(user.id);
      setSites(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load sites");
    } finally {
      setLoadingSites(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (visible) {
      setView("list");
      setError(null);
      loadSites();
    }
  }, [visible, loadSites]);

  const openAddForm = () => {
    setEditingSite(null);
    setForm(EMPTY_FORM);
    setPendingPhoto(null);
    setError(null);
    setView("form");
  };

  const handleDelete = (site: SiteProfileResponse) => {
    Alert.alert(
      "Delete Site",
      `Delete "${site.label ?? "this site"}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(site.id);
            try {
              await deleteSite(site.id);
              setSites((prev) => prev.filter((s) => s.id !== site.id));
            } catch (e: any) {
              setError(e.message ?? "Failed to delete site");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const openEditForm = (site: SiteProfileResponse) => {
    setEditingSite(site);
    setForm({
      label: site.label ?? "",
      address: site.address ?? "",
      landmark_notes: site.landmark_notes ?? "",
      tank_capacity_liters: site.tank_capacity_liters != null ? String(site.tank_capacity_liters) : "",
      tank_floor_level: site.tank_floor_level ?? null,
      has_gate: site.has_gate,
      gate_notes: site.gate_notes ?? "",
    });
    setPendingPhoto(null);
    setError(null);
    setView("form");
  };

  const pickPhoto = async (source: "camera" | "gallery") => {
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
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            allowsEditing: false,
          });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPendingPhoto({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  };

  const showPhotoPicker = () => {
    Alert.alert("Tank Photo", "How would you like to add a photo?", [
      { text: "Take Photo", onPress: () => pickPhoto("camera") },
      { text: "Choose from Library", onPress: () => pickPhoto("gallery") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!form.label.trim()) { setError("Site label is required"); return; }
    if (!form.address.trim()) { setError("Address is required"); return; }

    const rawCapacity = form.tank_capacity_liters.trim();
    const tank_capacity = rawCapacity ? parseInt(rawCapacity, 10) : undefined;
    if (tank_capacity !== undefined && isNaN(tank_capacity)) {
      setError("Tank capacity must be a number");
      return;
    }

    const gateNotes = form.has_gate && form.gate_notes.trim() ? form.gate_notes.trim() : undefined;

    setSaving(true);
    setError(null);
    try {
      let saved: SiteProfileResponse;
      if (editingSite) {
        saved = await updateSite(editingSite.id, {
          label: form.label.trim(),
          address: form.address.trim(),
          landmark_notes: form.landmark_notes.trim() || undefined,
          tank_capacity_liters: tank_capacity,
          tank_floor_level: form.tank_floor_level ?? undefined,
          has_gate: form.has_gate,
          gate_notes: gateNotes,
        });
        setSites((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      } else {
        saved = await createSite({
          user_id: user.id,
          latitude: DEFAULT_LAT,
          longitude: DEFAULT_LNG,
          label: form.label.trim(),
          address: form.address.trim(),
          landmark_notes: form.landmark_notes.trim() || undefined,
          tank_capacity_liters: tank_capacity,
          tank_floor_level: form.tank_floor_level ?? undefined,
          has_gate: form.has_gate,
          gate_notes: gateNotes,
        });
        setSites((prev) => [...prev, saved]);
      }

      if (pendingPhoto) {
        const withPhoto = await uploadSitePhoto(saved.id, pendingPhoto.uri, pendingPhoto.mimeType);
        setSites((prev) => prev.map((s) => (s.id === withPhoto.id ? withPhoto : s)));
      }

      setView("list");
    } catch (e: any) {
      setError(e.message ?? "Failed to save site");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.input,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.foreground,
    fontSize: 14,
  };

  const currentPhotoUri = pendingPhoto?.uri ?? (editingSite?.tank_photo_url || null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}
      >
        <View
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "90%",
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              {view === "form" && (
                <Pressable
                  onPress={() => setView("list")}
                  accessibilityLabel="Back to sites list"
                  style={{ padding: 4 }}
                >
                  <ChevronLeft color={theme.mutedForeground} size={20} />
                </Pressable>
              )}
              <MapPin color={theme.primary} size={18} />
              <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 17 }}>
                {view === "list" ? "My Delivery Sites" : editingSite ? "Edit Site" : "Add New Site"}
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close" style={{ padding: 4 }}>
              <X color={theme.mutedForeground} size={20} />
            </Pressable>
          </View>

          {error && (
            <View
              style={{
                backgroundColor: theme.destructiveSoft,
                borderWidth: 1,
                borderColor: theme.destructive,
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: theme.destructive, fontSize: 13 }}>{error}</Text>
            </View>
          )}

          {view === "list" ? (
            <>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {loadingSites ? (
                  <View style={{ alignItems: "center", paddingVertical: 32 }}>
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : sites.length === 0 ? (
                  <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
                    <MapPin color={theme.mutedForeground} size={32} />
                    <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>No delivery sites yet.</Text>
                    <Text style={{ color: theme.mutedForeground, fontSize: 12, textAlign: "center" }}>
                      Add a site to speed up future orders.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {sites.map((site) => (
                      <View
                        key={site.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          backgroundColor: theme.background,
                          borderWidth: 1,
                          borderColor: theme.border,
                          borderRadius: 12,
                          padding: 12,
                          gap: 12,
                        }}
                      >
                        {/* Tank photo thumbnail */}
                        {site.tank_photo_url ? (
                          <Image
                            source={{ uri: site.tank_photo_url }}
                            style={{ width: 48, height: 48, borderRadius: 8 }}
                            resizeMode="cover"
                          />
                        ) : null}
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
                            {site.label ?? "Unlabeled"}
                          </Text>
                          {!!site.address && (
                            <Text style={{ color: theme.mutedForeground, fontSize: 12 }} numberOfLines={2}>
                              {site.address}
                            </Text>
                          )}
                          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                            {site.tank_capacity_liters != null && (
                              <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
                                {site.tank_capacity_liters.toLocaleString()}L
                              </Text>
                            )}
                            {site.tank_floor_level && (
                              <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
                                {FLOOR_OPTIONS.find((f) => f.value === site.tank_floor_level)?.label ?? site.tank_floor_level}
                              </Text>
                            )}
                          </View>
                          <Text style={{ color: theme.mutedForeground, fontSize: 11, marginTop: 2 }}>
                            {STATUS_LABELS[site.verification_status] ?? "Unverified"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Pressable
                            onPress={() => openEditForm(site)}
                            accessibilityLabel={`Edit ${site.label ?? "site"}`}
                            style={{
                              height: 32,
                              width: 32,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: theme.border,
                              borderRadius: 8,
                              backgroundColor: theme.muted,
                            }}
                          >
                            <Pencil color={theme.mutedForeground} size={14} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDelete(site)}
                            disabled={deletingId === site.id}
                            accessibilityLabel={`Delete ${site.label ?? "site"}`}
                            style={{
                              height: 32,
                              width: 32,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: theme.destructive,
                              borderRadius: 8,
                              backgroundColor: theme.destructiveSoft,
                              opacity: deletingId === site.id ? 0.5 : 1,
                            }}
                          >
                            {deletingId === site.id ? (
                              <ActivityIndicator color={theme.destructive} size={12} />
                            ) : (
                              <Trash2 color={theme.destructive} size={14} />
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              <Pressable
                onPress={openAddForm}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  marginTop: 16,
                  gap: 8,
                }}
              >
                <Plus color="#fff" size={18} />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Add New Site</Text>
              </Pressable>
            </>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>Site Label *</Text>
                  <TextInput
                    value={form.label}
                    onChangeText={(v) => setForm((f) => ({ ...f, label: v }))}
                    placeholder="Home, Office, Warehouse…"
                    placeholderTextColor={theme.mutedForeground}
                    style={inputStyle}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>Delivery Address *</Text>
                  <TextInput
                    value={form.address}
                    onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                    placeholder="12 Gana St, Maitama, Abuja"
                    placeholderTextColor={theme.mutedForeground}
                    style={inputStyle}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                    Landmark / Notes{" "}
                    <Text style={{ fontWeight: "400" }}>(optional)</Text>
                  </Text>
                  <TextInput
                    value={form.landmark_notes}
                    onChangeText={(v) => setForm((f) => ({ ...f, landmark_notes: v }))}
                    placeholder="Blue gate, beside the school"
                    placeholderTextColor={theme.mutedForeground}
                    style={inputStyle}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                    Tank Capacity (liters){" "}
                    <Text style={{ fontWeight: "400" }}>(optional)</Text>
                  </Text>
                  <TextInput
                    value={form.tank_capacity_liters}
                    onChangeText={(v) => setForm((f) => ({ ...f, tank_capacity_liters: v }))}
                    placeholder="e.g. 5000"
                    placeholderTextColor={theme.mutedForeground}
                    style={inputStyle}
                    keyboardType="numeric"
                  />
                </View>

                {/* Tank floor level */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                    Tank Location{" "}
                    <Text style={{ fontWeight: "400" }}>(optional)</Text>
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    {FLOOR_OPTIONS.map((opt) => {
                      const selected = form.tank_floor_level === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() =>
                            setForm((f) => ({
                              ...f,
                              tank_floor_level: selected ? null : opt.value,
                            }))
                          }
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: selected ? theme.primary : theme.border,
                            backgroundColor: selected ? theme.primary + "22" : theme.input,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: selected ? "700" : "400",
                              color: selected ? theme.primary : theme.foreground,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Tank photo */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                    Tank Photo{" "}
                    <Text style={{ fontWeight: "400" }}>(optional — helps drivers estimate height)</Text>
                  </Text>

                  {currentPhotoUri ? (
                    <View style={{ gap: 8 }}>
                      <Image
                        source={{ uri: currentPhotoUri }}
                        style={{ width: "100%", height: 160, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable
                          onPress={showPhotoPicker}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor: theme.input,
                          }}
                        >
                          <Camera color={theme.mutedForeground} size={14} />
                          <Text style={{ color: theme.foreground, fontSize: 13 }}>Retake</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setPendingPhoto(null)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: theme.destructive,
                            backgroundColor: theme.destructiveSoft,
                          }}
                        >
                          <Text style={{ color: theme.destructive, fontSize: 13 }}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={showPhotoPicker}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 32,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: theme.border,
                        backgroundColor: theme.input,
                      }}
                    >
                      <ImageIcon color={theme.mutedForeground} size={20} />
                      <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>Add Tank Photo</Text>
                    </Pressable>
                  )}
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: theme.input,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ color: theme.foreground, fontSize: 14 }}>Has gate / barrier?</Text>
                  <Switch
                    value={form.has_gate}
                    onValueChange={(v) => setForm((f) => ({ ...f, has_gate: v, gate_notes: v ? f.gate_notes : "" }))}
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {form.has_gate && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                      Gate Notes{" "}
                      <Text style={{ fontWeight: "400" }}>(optional)</Text>
                    </Text>
                    <TextInput
                      value={form.gate_notes}
                      onChangeText={(v) => setForm((f) => ({ ...f, gate_notes: v }))}
                      placeholder="Call ahead, code is 1234…"
                      placeholderTextColor={theme.mutedForeground}
                      style={inputStyle}
                    />
                  </View>
                )}

                <View style={{ flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 16 }}>
                  <Pressable
                    onPress={() => setView("list")}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.card,
                    }}
                  >
                    <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: theme.primary,
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                        {editingSite ? "Save Changes" : "Add Site"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
