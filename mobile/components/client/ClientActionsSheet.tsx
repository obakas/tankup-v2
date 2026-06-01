import { Modal, Pressable, Text, View } from "react-native";
import { Bell, History, MapPin, UserPen, X } from "lucide-react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onOpenSites: () => void;
  onOpenHistory: () => void;
  onOpenNotificationSettings: () => void;
};

type ActionRowProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  iconBg: string;
};

function ActionRow({ icon, label, description, onPress, iconBg }: ActionRowProps) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderRadius: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 15 }}>
          {label}
        </Text>
        <Text style={{ color: theme.mutedForeground, fontSize: 13, marginTop: 1 }}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

export function ClientActionsSheet({
  visible,
  onClose,
  onEditProfile,
  onOpenSites,
  onOpenHistory,
  onOpenNotificationSettings,
}: Props) {
  const { theme } = useAppTheme();

  function handle(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 36,
          }}
        >
          {/* Sheet handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.border,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 17 }}>
              Account
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
              style={{
                padding: 6,
                borderRadius: 8,
                backgroundColor: theme.muted,
              }}
            >
              <X color={theme.mutedForeground} size={16} />
            </Pressable>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 4 }} />

          <ActionRow
            icon={<UserPen color={theme.primary} size={20} />}
            iconBg={theme.primarySoft}
            label="Edit profile"
            description="Update your name and contact details"
            onPress={() => handle(onEditProfile)}
          />

          <View style={{ height: 1, backgroundColor: theme.border }} />

          <ActionRow
            icon={<MapPin color={theme.primary} size={20} />}
            iconBg={theme.primarySoft}
            label="My delivery sites"
            description="Manage your saved delivery locations"
            onPress={() => handle(onOpenSites)}
          />

          <View style={{ height: 1, backgroundColor: theme.border }} />

          <ActionRow
            icon={<History color={theme.primary} size={20} />}
            iconBg={theme.primarySoft}
            label="Order history"
            description="View your past water delivery orders"
            onPress={() => handle(onOpenHistory)}
          />

          <View style={{ height: 1, backgroundColor: theme.border }} />

          <ActionRow
            icon={<Bell color={theme.primary} size={20} />}
            iconBg={theme.primarySoft}
            label="Notification settings"
            description="Choose which alerts and updates you receive"
            onPress={() => handle(onOpenNotificationSettings)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
