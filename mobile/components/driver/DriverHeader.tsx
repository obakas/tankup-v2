import { Alert, Pressable, Switch, Text, View } from "react-native";
import { ArrowLeft, HelpCircle, Moon, Sun } from "lucide-react-native";
import type { AppTheme, getTheme } from "@/components/ui/theme";
import type { DriverResponse } from "@/lib/api";

type Props = {
  title: string;
  driver: DriverResponse | null;
  online: boolean;
  onBack: () => void;
  onToggleOnline: (val: boolean) => void;
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
  theme,
  themeMode,
  onToggleTheme,
}: Props) {
  const iconColor = theme.foreground;

  return (
    <View
      style={{ backgroundColor: theme.background, borderBottomColor: theme.border }}
      className="flex-row items-center justify-between px-4 py-3 border-b"
    >
      <Pressable
        onPress={onBack}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        className="p-2"
      >
        <ArrowLeft color={iconColor} size={20} />
      </Pressable>

      {driver ? (
        <View className="flex-row items-center gap-3">
          <View
            style={{ backgroundColor: online ? theme.success : theme.muted }}
            className="w-2 h-2 rounded-full"
          />
          <Text style={{ color: theme.foreground }} className="font-medium">
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

      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onToggleTheme}
          accessibilityLabel={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          accessibilityRole="button"
          className="p-2"
        >
          {themeMode === "dark" ? (
            <Sun color={iconColor} size={20} />
          ) : (
            <Moon color={iconColor} size={20} />
          )}
        </Pressable>

        <Pressable
          onPress={() => Alert.alert("Help", "Driver support: 0800-DRIVER")}
          accessibilityLabel="Help"
          accessibilityRole="button"
          className="p-2"
        >
          <HelpCircle color={iconColor} size={20} />
        </Pressable>
      </View>
    </View>
  );
}
