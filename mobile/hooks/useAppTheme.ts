import { createElement, createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppTheme, TankupTheme, getTheme } from "@/components/ui/theme";

const THEME_KEY = "tankup-theme";

type ThemeContextValue = {
  themeMode: AppTheme;
  theme: TankupTheme;
  isDark: boolean;
  toggleTheme: () => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<AppTheme>("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setThemeMode(saved);
    });
  }, []);

  const toggleTheme = async () => {
    const next: AppTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  return createElement(ThemeContext.Provider, {
    value: { themeMode, theme: getTheme(themeMode), isDark: themeMode === "dark", toggleTheme },
    children,
  });
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
