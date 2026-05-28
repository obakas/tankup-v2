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
import type { CurrentUser } from "@/types/client";
import { updateUser } from "@/lib/api";

type Props = {
  visible: boolean;
  user: CurrentUser;
  theme: TankupTheme;
  onClose: () => void;
  onSaved: (updated: CurrentUser) => void;
};

export function ProfileModal({ visible, user, theme, onClose, onSaved }: Props) {
  const [name, setName] = useState(user.name ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!address.trim()) { setError("Address is required"); return; }
    setLoading(true);
    setError(null);
    try {
      const updated = await updateUser(user.id, {
        name: name.trim(),
        address: address.trim(),
      });
      onSaved({ ...user, name: updated.name, address: updated.address });
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
            <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.mutedForeground}
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>Delivery Address</Text>
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
            <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "600" }}>Phone</Text>
            <View style={{ ...inputStyle, backgroundColor: theme.muted }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>{user.phone}</Text>
            </View>
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Phone number cannot be changed</Text>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={{ backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: loading ? 0.7 : 1, marginTop: 4 }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
