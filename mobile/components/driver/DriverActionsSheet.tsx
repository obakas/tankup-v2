import { Modal, Pressable, Text, View } from "react-native";
import { Banknote, Bell, ClipboardList, HelpCircle, LogOut, UserPen, X } from "lucide-react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onOpenNotificationSettings: () => void;
  onOpenHelp: () => void;
  onOpenHistory: () => void;
  onOpenEarnings: () => void;
  onLogout: () => void;
};

type ActionRowProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  iconBg: string;
  destructive?: boolean;
};

function ActionRow({ icon, label, description, onPress, iconBg, destructive }: ActionRowProps) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3.5 py-3.5 px-1 rounded-xl"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        className="w-11 h-11 rounded-xl items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className="font-semibold text-[15px]"
          style={{ color: destructive ? theme.destructive : theme.foreground }}
        >
          {label}
        </Text>
        <Text className="text-[13px] mt-0.5" style={{ color: theme.mutedForeground }}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

export function DriverActionsSheet({
  visible,
  onClose,
  onEditProfile,
  onOpenNotificationSettings,
  onOpenHelp,
  onOpenHistory,
  onOpenEarnings,
  onLogout,
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
              Driver menu
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
            icon={<UserPen color={theme.success} size={20} />}
            iconBg={theme.successSoft}
            label="Edit profile"
            description="Update your vehicle and contact details"
            onPress={() => handle(onEditProfile)}
          />

          <View style={{ height: 1, backgroundColor: theme.border }} />

          <ActionRow
            icon={<Bell color={theme.success} size={20} />}
            iconBg={theme.successSoft}
            label="Notification settings"
            description="Choose which alerts and updates you receive"
            onPress={() => handle(onOpenNotificationSettings)}
          />

          <View style={{ height: 1, backgroundColor: theme.border }} />

          <ActionRow
            icon={<HelpCircle color={theme.success} size={20} />}
            iconBg={theme.successSoft}
            label="Help"
            description="Get support or report an issue"
            onPress={() => handle(onOpenHelp)}
          />

          <View style={{ height: 1, backgroundColor: theme.border }} />

          <ActionRow
            icon={<ClipboardList color={theme.success} size={20} />}
            iconBg={theme.successSoft}
            label="Delivery history"
            description="View your past and completed delivery jobs"
            onPress={() => handle(onOpenHistory)}
          />

          <View style={{ height: 1, backgroundColor: theme.border }} />

          <ActionRow
            icon={<Banknote color={theme.success} size={20} />}
            iconBg={theme.successSoft}
            label="Earnings"
            description="View your earnings by job, stop, and bonus type"
            onPress={() => handle(onOpenEarnings)}
          />

          <View style={{ height: 1, backgroundColor: theme.border }} />

          <ActionRow
            icon={<LogOut color={theme.destructive} size={20} />}
            iconBg={theme.destructiveSoft}
            label="Log out"
            description="Switch role or sign in as someone else"
            onPress={() => handle(onLogout)}
            destructive
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
