import { Alert, Pressable, Switch, Text, View } from "react-native";
import { ArrowLeft, HelpCircle, LogOut, Moon, Sun, Truck, UserPen } from "lucide-react-native";
import type { AppTheme, getTheme } from "@/components/ui/theme";
import type { DriverResponse } from "@/lib/api";

type Props = {
  title: string;
  driver: DriverResponse | null;
  online: boolean;
  onBack: () => void;
  onToggleOnline: (val: boolean) => void;
  onEditProfile: () => void;
  onLogout: () => void;
  theme: ReturnType<typeof getTheme>;
  themeMode: AppTheme;
  onToggleTheme: () => void;
};

export function DriverHeader({
  title,
  driver,
  online,
  onBack,
  onToggleOnline,
  onEditProfile,
  onLogout,
  theme,
  themeMode,
  onToggleTheme,
}: Props) {
  return (
    <View
      style={{ backgroundColor: theme.card, borderBottomColor: theme.border }}
      className="border-b"
    >
      {/* Row 1: back + brand + title/status + utilities */}
      <View
        className="flex-row items-center justify-between px-4 py-3"
      >
        {/* Left: back + brand pill + title or status */}
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          <Pressable
            onPress={onBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            className="p-2 -ml-2"
          >
            <ArrowLeft color={theme.mutedForeground} size={20} />
          </Pressable>

          {/* Brand pill */}
          <View
            style={{ backgroundColor: theme.successSoft, borderRadius: 8, padding: 5 }}
          >
            <Truck color={theme.success} size={15} />
          </View>

          {driver ? (
            /* Online/offline status */
            <View className="flex-row items-center gap-2">
              <View
                style={{ backgroundColor: online ? theme.success : theme.mutedForeground }}
                className="w-2 h-2 rounded-full"
              />
              <Text
                style={{ color: online ? theme.success : theme.mutedForeground }}
                className="font-semibold text-sm"
              >
                {online ? "Online" : "Offline"}
              </Text>
              <Switch
                value={online}
                onValueChange={onToggleOnline}
                trackColor={{ true: theme.success, false: theme.border }}
                thumbColor={online ? "#fff" : theme.muted}
              />
            </View>
          ) : (
            <Text style={{ color: theme.foreground }} className="font-bold text-base">
              {title}
            </Text>
          )}
        </View>

        {/* Right: utilities */}
        <View className="flex-row items-center gap-1">
          {driver && (
            /* Edit profile — warning accent */
            <Pressable
              onPress={onEditProfile}
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
              style={{
                backgroundColor: theme.successSoft,
                borderColor: theme.success + "40",
                borderWidth: 1,
                borderRadius: 10,
                padding: 8,
              }}
            >
              <UserPen color={theme.success} size={19} />
            </Pressable>
          )}

          <Pressable
            onPress={onToggleTheme}
            accessibilityLabel={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            accessibilityRole="button"
            className="p-2"
          >
            {themeMode === "dark" ? (
              <Sun color={theme.mutedForeground} size={20} />
            ) : (
              <Moon color={theme.mutedForeground} size={20} />
            )}
          </Pressable>

          <Pressable
            onPress={() => Alert.alert("Help", "Driver support: 0800-DRIVER")}
            accessibilityLabel="Help"
            accessibilityRole="button"
            className="p-2"
          >
            <HelpCircle color={theme.mutedForeground} size={20} />
          </Pressable>

          <Pressable
            onPress={onLogout}
            accessibilityLabel="Log out"
            accessibilityRole="button"
            className="p-2"
          >
            <LogOut color={theme.mutedForeground} size={20} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
