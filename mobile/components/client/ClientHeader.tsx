import { Pressable, Text, View } from "react-native";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Droplets,
  HelpCircle,
  History,
  LogOut,
  MapPin,
  Moon,
  Sun,
  UserPen,
} from "lucide-react-native";

import type { AppTheme } from "@/components/ui/theme";
import type { CurrentUser } from "@/types/client";

type Props = {
  title: string;
  user: CurrentUser | null;
  onBack: () => void;
  onLogout: () => void;
  onEditProfile: () => void;
  onOpenSites: () => void;
  onOpenHelp: () => void;
  theme: ReturnType<typeof import("@/components/ui/theme").getTheme>;
  themeMode: AppTheme;
  onToggleTheme: () => void;
  alertsEnabled: boolean;
  onToggleAlerts: () => void;
  onOpenHistory: () => void;
};

export function ClientHeader({
  title,
  user,
  onBack,
  onLogout,
  onEditProfile,
  onOpenSites,
  onOpenHelp,
  theme,
  themeMode,
  onToggleTheme,
  alertsEnabled,
  onToggleAlerts,
  onOpenHistory,
}: Props) {
  return (
    <View
      style={{ backgroundColor: theme.card, borderBottomColor: theme.border }}
      className="px-4 py-3 border-b"
    >
      {/* Row 1: back + title + utilities */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-2 gap-2">
          <Pressable
            onPress={onBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            className="p-2 -ml-2"
          >
            <ArrowLeft color={theme.mutedForeground} size={21} />
          </Pressable>

          {/* Brand pill */}
          <View
            style={{ backgroundColor: theme.primarySoft, borderRadius: 8, padding: 5 }}
          >
            <Droplets color={theme.primary} size={15} />
          </View>

          <Text
            numberOfLines={1}
            style={{ color: theme.foreground }}
            className="font-bold text-lg flex-1"
          >
            {title}
          </Text>
        </View>

        {/* Utility icons */}
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={onToggleTheme}
            accessibilityLabel={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            accessibilityRole="button"
            className="p-2"
          >
            {themeMode === "dark" ? (
              <Sun color={theme.mutedForeground} size={19} />
            ) : (
              <Moon color={theme.mutedForeground} size={19} />
            )}
          </Pressable>

          <Pressable
            onPress={onToggleAlerts}
            accessibilityLabel={alertsEnabled ? "Disable alerts" : "Enable alerts"}
            accessibilityRole="button"
            className="p-2"
          >
            {alertsEnabled ? (
              <BellOff color={theme.mutedForeground} size={19} />
            ) : (
              <Bell color={theme.mutedForeground} size={19} />
            )}
          </Pressable>

          <Pressable
            onPress={onOpenHelp}
            accessibilityLabel="Help"
            accessibilityRole="button"
            className="p-2"
          >
            <HelpCircle color={theme.mutedForeground} size={19} />
          </Pressable>

          {user && (
            <Pressable
              onPress={onLogout}
              accessibilityLabel="Log out"
              accessibilityRole="button"
              className="p-2"
            >
              <LogOut color={theme.mutedForeground} size={19} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Row 2: user info + action buttons */}
      <View className="mt-3 flex-row items-center justify-between gap-3">
        <View
          style={{ borderColor: theme.border, backgroundColor: theme.background }}
          className="flex-row items-center gap-2 rounded-2xl border px-3 py-2 flex-1"
        >
          <View
            style={{ backgroundColor: theme.primarySoft, borderRadius: 6, padding: 4 }}
          >
            <Droplets color={theme.primary} size={13} />
          </View>

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
            {/* Edit profile — primary accent */}
            <Pressable
              onPress={onEditProfile}
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
              style={{ backgroundColor: theme.primarySoft, borderColor: theme.primary + "30" }}
              className="h-12 w-12 items-center justify-center rounded-2xl border"
            >
              <UserPen color={theme.primary} size={19} />
            </Pressable>

            {/* My sites — primary accent */}
            <Pressable
              onPress={onOpenSites}
              accessibilityLabel="My delivery sites"
              accessibilityRole="button"
              style={{ backgroundColor: theme.primarySoft, borderColor: theme.primary + "30" }}
              className="h-12 w-12 items-center justify-center rounded-2xl border"
            >
              <MapPin color={theme.primary} size={19} />
            </Pressable>

            {/* Order history — primary accent */}
            <Pressable
              onPress={onOpenHistory}
              accessibilityLabel="Order history"
              accessibilityRole="button"
              style={{ backgroundColor: theme.primarySoft, borderColor: theme.primary + "30" }}
              className="h-12 w-12 items-center justify-center rounded-2xl border"
            >
              <History color={theme.primary} size={20} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
