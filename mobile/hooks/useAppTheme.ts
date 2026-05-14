import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppTheme, getTheme } from "@/components/ui/theme";

const THEME_KEY = "tankup-theme";

export function useAppTheme() {
  const [themeMode, setThemeMode] = useState<AppTheme>("light");

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);

      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeMode(savedTheme);
      }
    };

    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const nextTheme = themeMode === "dark" ? "light" : "dark";

    setThemeMode(nextTheme);
    await AsyncStorage.setItem(THEME_KEY, nextTheme);
  };

  return {
    themeMode,
    theme: getTheme(themeMode),
    isDark: themeMode === "dark",
    toggleTheme,
  };
}