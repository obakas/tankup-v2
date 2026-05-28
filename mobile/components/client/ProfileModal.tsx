import { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
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
import { ChevronLeft, MapPin, Pencil, Plus, X } from "lucide-react-native";
import type { TankupTheme } from "@/components/ui/theme";
import type { CurrentUser } from "@/types/client";
import {
  updateUser,
  createSite,
  listUserSites,
  updateSite,
  type SiteProfileResponse,
} from "@/lib/api";
import { DEFAULT_LAT, DEFAULT_LNG } from "@/constants/clientConstants";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "profile" | "sites";
type SiteView = "list" | "form";

interface SiteFormData {
  label: string;
  address: string;
  landmark_notes: string;
  tank_capacity_liters: string;
  has_gate: boolean;
  gate_notes: string;
}

const EMPTY_FORM: SiteFormData = {
  label: "",
  address: "",
  landmark_notes: "",
  tank_capacity_liters: "",
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

type Props = {
  visible: boolean;
  user: CurrentUser;
  theme: TankupTheme;
  onClose: () => void;
  onSaved: (updated: CurrentUser) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileModal({ visible, user, theme, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Profile tab state
  const [name, setName] = useState(user.name ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Sites tab state
  const [sites, setSites] = useState<SiteProfileResponse[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [siteView, setSiteView] = useState<SiteView>("list");
  const [editingSite, setEditingSite] = useState<SiteProfileResponse | null>(null);
  const [form, setForm] = useState<SiteFormData>(EMPTY_FORM);
  const [savingSite, setSavingSite] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const data = await listUserSites(user.id);
      setSites(data);
    } catch (e: any) {
      setSiteError(e.message ?? "Failed to load sites");
    } finally {
      setLoadingSites(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (visible) {
      setActiveTab("profile");
      setName(user.name ?? "");
      setAddress(user.address ?? "");
      setProfileError(null);
      setSiteView("list");
      setSiteError(null);
      void loadSites();
    }
  }, [visible, user.name, user.address, loadSites]);

  // ── Profile save ───────────────────────────────────────────────────────────

  const handleProfileSave = async () => {
    if (!name.trim()) { setProfileError("Name is required"); return; }
    if (!address.trim()) { setProfileError("Address is required"); return; }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const updated = await updateUser(user.id, {
        name: name.trim(),
        address: address.trim(),
      });
      onSaved({ ...user, name: updated.name, address: updated.address });
      onClose();
    } catch (e: any) {
      setProfileError(e.message ?? "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Site helpers ───────────────────────────────────────────────────────────

  const openAddForm = () => {
    setEditingSite(null);
    setForm(EMPTY_FORM);
    setSiteError(null);
    setSiteView("form");
  };

  const openEditForm = (site: SiteProfileResponse) => {
    setEditingSite(site);
    setForm({
      label: site.label ?? "",
      address: site.address ?? "",
      landmark_notes: site.landmark_notes ?? "",
      tank_capacity_liters:
        site.tank_capacity_liters != null ? String(site.tank_capacity_liters) : "",
      has_gate: site.has_gate,
      gate_notes: site.gate_notes ?? "",
    });
    setSiteError(null);
    setSiteView("form");
  };

  const handleSiteSave = async () => {
    if (!form.label.trim()) { setSiteError("Site label is required"); return; }
    if (!form.address.trim()) { setSiteError("Address is required"); return; }

    const rawCapacity = form.tank_capacity_liters.trim();
    const tank_capacity = rawCapacity ? parseInt(rawCapacity, 10) : undefined;
    if (tank_capacity !== undefined && isNaN(tank_capacity)) {
      setSiteError("Tank capacity must be a number");
      return;
    }

    const gateNotes =
      form.has_gate && form.gate_notes.trim() ? form.gate_notes.trim() : undefined;

    setSavingSite(true);
    setSiteError(null);
    try {
      if (editingSite) {
        const updated = await updateSite(editingSite.id, {
          label: form.label.trim(),
          address: form.address.trim(),
          landmark_notes: form.landmark_notes.trim() || undefined,
          tank_capacity_liters: tank_capacity,
          has_gate: form.has_gate,
          gate_notes: gateNotes,
        });
        setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await createSite({
          user_id: user.id,
          latitude: DEFAULT_LAT,
          longitude: DEFAULT_LNG,
          label: form.label.trim(),
          address: form.address.trim(),
          landmark_notes: form.landmark_notes.trim() || undefined,
          tank_capacity_liters: tank_capacity,
          has_gate: form.has_gate,
          gate_notes: gateNotes,
        });
        setSites((prev) => [...prev, created]);
      }
      setSiteView("list");
    } catch (e: any) {
      setSiteError(e.message ?? "Failed to save site");
    } finally {
      setSavingSite(false);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────

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

  const inSiteForm = activeTab === "sites" && siteView === "form";

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {inSiteForm && (
                <Pressable
                  onPress={() => setSiteView("list")}
                  accessibilityLabel="Back to sites list"
                  style={{ padding: 4 }}
                >
                  <ChevronLeft color={theme.mutedForeground} size={20} />
                </Pressable>
              )}
              <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 17 }}>
                {inSiteForm
                  ? editingSite
                    ? "Edit Site"
                    : "Add New Site"
                  : "Edit Profile"}
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close" style={{ padding: 4 }}>
              <X color={theme.mutedForeground} size={20} />
            </Pressable>
          </View>

          {/* Tab bar — hidden when site form is open */}
          {!inSiteForm && (
            <View
              style={{
                flexDirection: "row",
                backgroundColor: theme.muted,
                borderRadius: 10,
                padding: 4,
                marginBottom: 16,
              }}
            >
              {(["profile", "sites"] as Tab[]).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: "center",
                    backgroundColor:
                      activeTab === tab ? theme.card : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color:
                        activeTab === tab ? theme.foreground : theme.mutedForeground,
                    }}
                  >
                    {tab === "profile" ? "Profile" : "My Sites"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* ── Profile tab ── */}
          {activeTab === "profile" && (
            <View style={{ gap: 16 }}>
              {profileError && (
                <View
                  style={{
                    backgroundColor: theme.destructiveSoft,
                    borderWidth: 1,
                    borderColor: theme.destructive,
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <Text style={{ color: theme.destructive, fontSize: 13 }}>
                    {profileError}
                  </Text>
                </View>
              )}

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                  Full Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={theme.mutedForeground}
                  style={inputStyle}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                  Delivery Address
                </Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Your delivery address"
                  placeholderTextColor={theme.mutedForeground}
                  style={inputStyle}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                  Phone
                </Text>
                <View style={{ ...inputStyle, backgroundColor: theme.muted }}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>
                    {user.phone}
                  </Text>
                </View>
                <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
                  Phone number cannot be changed
                </Text>
              </View>

              <Pressable
                onPress={handleProfileSave}
                disabled={profileLoading}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: profileLoading ? 0.7 : 1,
                  marginTop: 4,
                }}
              >
                {profileLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                    Save Changes
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* ── Sites tab ── */}
          {activeTab === "sites" && (
            <>
              {siteError && (
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
                  <Text style={{ color: theme.destructive, fontSize: 13 }}>
                    {siteError}
                  </Text>
                </View>
              )}

              {siteView === "list" ? (
                <>
                  <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                    {loadingSites ? (
                      <View style={{ alignItems: "center", paddingVertical: 32 }}>
                        <ActivityIndicator color={theme.primary} />
                      </View>
                    ) : sites.length === 0 ? (
                      <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
                        <MapPin color={theme.mutedForeground} size={32} />
                        <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>
                          No delivery sites yet.
                        </Text>
                        <Text
                          style={{
                            color: theme.mutedForeground,
                            fontSize: 12,
                            textAlign: "center",
                          }}
                        >
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
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text
                                style={{
                                  color: theme.foreground,
                                  fontWeight: "600",
                                  fontSize: 14,
                                }}
                                numberOfLines={1}
                              >
                                {site.label ?? "Unlabeled"}
                              </Text>
                              {!!site.address && (
                                <Text
                                  style={{ color: theme.mutedForeground, fontSize: 12 }}
                                  numberOfLines={2}
                                >
                                  {site.address}
                                </Text>
                              )}
                              {site.tank_capacity_liters != null && (
                                <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
                                  Tank: {site.tank_capacity_liters.toLocaleString()}L
                                </Text>
                              )}
                              <Text style={{ color: theme.mutedForeground, fontSize: 11, marginTop: 2 }}>
                                {STATUS_LABELS[site.verification_status] ?? "Unverified"}
                              </Text>
                            </View>
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
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                      Add New Site
                    </Text>
                  </Pressable>
                </>
              ) : (
                /* Site form */
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={{ gap: 14 }}>
                    <View style={{ gap: 6 }}>
                      <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                        Site Label *
                      </Text>
                      <TextInput
                        value={form.label}
                        onChangeText={(v) => setForm((f) => ({ ...f, label: v }))}
                        placeholder="Home, Office, Warehouse…"
                        placeholderTextColor={theme.mutedForeground}
                        style={inputStyle}
                      />
                    </View>

                    <View style={{ gap: 6 }}>
                      <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                        Delivery Address *
                      </Text>
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
                        onChangeText={(v) =>
                          setForm((f) => ({ ...f, tank_capacity_liters: v }))
                        }
                        placeholder="e.g. 5000"
                        placeholderTextColor={theme.mutedForeground}
                        style={inputStyle}
                        keyboardType="numeric"
                      />
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
                      <Text style={{ color: theme.foreground, fontSize: 14 }}>
                        Has gate / barrier?
                      </Text>
                      <Switch
                        value={form.has_gate}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, has_gate: v, gate_notes: v ? f.gate_notes : "" }))
                        }
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
                        onPress={() => setSiteView("list")}
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
                        <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleSiteSave}
                        disabled={savingSite}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingVertical: 14,
                          borderRadius: 12,
                          backgroundColor: theme.primary,
                          opacity: savingSite ? 0.7 : 1,
                        }}
                      >
                        {savingSite ? (
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
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
