import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import type { TankupTheme } from "@/components/ui/theme";
import type { DriverResponse } from "@/lib/api";
import { updateDriver } from "@/lib/api";

type Props = {
  visible: boolean;
  driver: DriverResponse;
  theme: TankupTheme;
  onClose: () => void;
  onSaved: (updated: DriverResponse) => void;
};

export function DriverProfileModal({ visible, driver, theme, onClose, onSaved }: Props) {
  const [name, setName] = useState(driver.name ?? "");
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    setError(null);
    try {
      const payload: { driver_name?: string; tank_plate_number?: string } = {
        driver_name: name.trim(),
      };
      if (plate.trim()) payload.tank_plate_number = plate.trim();

      const updated = await updateDriver(driver.tankerId, payload);
      onSaved({ ...driver, name: updated.name });
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to update profile");
    } finally {
      setLoading(false);
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}
      >
        <View style={{ backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 17 }}>Edit Profile</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" style={{ padding: 4 }}>
              <X color={theme.mutedForeground} size={20} />
            </Pressable>
          </View>

          {error && (
            <View style={{ backgroundColor: theme.destructiveSoft, borderWidth: 1, borderColor: theme.destructive, borderRadius: 10, padding: 10 }}>
              <Text style={{ color: theme.destructive, fontSize: 13 }}>{error}</Text>
            </View>
          )}

          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>Driver Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.mutedForeground}
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>Tank Plate Number</Text>
            <TextInput
              value={plate}
              onChangeText={setPlate}
              placeholder="Leave blank to keep current"
              placeholderTextColor={theme.mutedForeground}
              autoCapitalize="characters"
              style={inputStyle}
            />
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Leave blank to keep your current plate number</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>Phone</Text>
            <View style={{ ...inputStyle, backgroundColor: theme.muted }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>{driver.phone}</Text>
            </View>
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Phone number cannot be changed</Text>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={{ backgroundColor: theme.success, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: loading ? 0.7 : 1, marginTop: 4 }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
