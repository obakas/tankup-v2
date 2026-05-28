import { Alert, Pressable, Text, View } from "react-native";
import {
  ArrowLeft,
  Bell,
  BellOff,
  HelpCircle,
  History,
  LogOut,
  Moon,
  Sun,
  UserCircle2,
  UserPen,
} from "lucide-react-native";

import type { AppTheme } from "@/components/ui/theme";
import type { CurrentUser } from "@/types/client";

type Props = {
  title: string;
  // stepLabel: string;
  user: CurrentUser | null;
  onBack: () => void;
  onLogout: () => void;
  onEditProfile: () => void;
  theme: ReturnType<typeof import("@/components/ui/theme").getTheme>;
  themeMode: AppTheme;
  onToggleTheme: () => void;
  alertsEnabled: boolean;
  onToggleAlerts: () => void;
  onOpenHistory: () => void;
};

export function ClientHeader({
  title,
  // stepLabel,
  user,
  onBack,
  onLogout,
  onEditProfile,
  theme,
  themeMode,
  onToggleTheme,
  alertsEnabled,
  onToggleAlerts,
  onOpenHistory
}: Props) {
  const iconColor = theme.foreground;

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderBottomColor: theme.border,
      }}
      className="px-4 py-3 border-b"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-2">
          <Pressable
            onPress={onBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            className="p-2 -ml-2"
          >
            <ArrowLeft color={iconColor} size={21} />
          </Pressable>

          <Text
            numberOfLines={1}
            style={{ color: theme.foreground }}
            className="font-bold text-lg flex-1"
          >
            {title}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={onToggleTheme}
            accessibilityLabel={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            accessibilityRole="button"
            className="p-2"
          >
            {themeMode === "dark" ? (
              <Sun color={iconColor} size={19} />
            ) : (
              <Moon color={iconColor} size={19} />
            )}
          </Pressable>

          <Pressable
            onPress={onToggleAlerts}
            accessibilityLabel={alertsEnabled ? "Disable alerts" : "Enable alerts"}
            accessibilityRole="button"
            className="p-2"
          >
            {alertsEnabled ? (
              <BellOff color={iconColor} size={19} />
            ) : (
              <Bell color={iconColor} size={19} />
            )}
          </Pressable>

          <Pressable
            onPress={() => Alert.alert("Help", "Contact support: 0800-TANKUP")}
            accessibilityLabel="Help"
            accessibilityRole="button"
            className="p-2"
          >
            <HelpCircle color={iconColor} size={19} />
          </Pressable>

          {user && (
            <Pressable
              onPress={onLogout}
              accessibilityLabel="Log out"
              accessibilityRole="button"
              className="p-2"
            >
              <LogOut color={iconColor} size={19} />
            </Pressable>
          )}

        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between gap-3">
        <View
          style={{
            borderColor: theme.border,
            backgroundColor: theme.background,
          }}
          className="flex-row items-center gap-2 rounded-2xl border px-3 py-2 flex-1"
        >
          <UserCircle2 color={theme.mutedForeground} size={17} />

          <View className="flex-1">
            <Text
              numberOfLines={1}
              style={{ color: theme.foreground }}
              className="text-sm font-semibold"
            >
              {user?.name ?? "Guest user"}
            </Text>

            {!!user?.phone && (
              <Text
                numberOfLines={1}
                style={{ color: theme.mutedForeground }}
                className="text-xs"
              >
                {user.phone}
              </Text>
            )}
          </View>

        </View>
         {user && (
            <View className="flex-row gap-2">
              <Pressable
                onPress={onEditProfile}
                accessibilityLabel="Edit profile"
                accessibilityRole="button"
                style={{ borderColor: theme.border, backgroundColor: theme.background }}
                className="h-12 w-12 items-center justify-center rounded-2xl border"
              >
                <UserPen color={theme.foreground} size={19} />
              </Pressable>
              <Pressable
                onPress={onOpenHistory}
                accessibilityLabel="Order history"
                accessibilityRole="button"
                style={{ borderColor: theme.border, backgroundColor: theme.background }}
                className="h-12 w-12 items-center justify-center rounded-2xl border"
              >
                <History color={theme.foreground} size={20} />
              </Pressable>
            </View>
          )}

      </View>
    </View>
  );
}