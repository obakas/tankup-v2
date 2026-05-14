
export type AppTheme = "light" | "dark";

export type TankupTheme = {
  background: string;
  foreground: string;
  card: string;
  cardSoft: string;
  border: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primarySoft: string;
  primaryForeground: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  destructive: string;
  destructiveSoft: string;
  input: string;
  shadow: string;
};

export const lightTheme: TankupTheme = {
  background: "#f8fafc",
  foreground: "#111827",
  card: "#ffffff",
  cardSoft: "#f1f5f9",
  border: "#e5e7eb",
  muted: "#f1f5f9",
  mutedForeground: "#64748b",
  primary: "#0084ff",
  primarySoft: "rgba(0,132,255,0.10)",
  primaryForeground: "#ffffff",
  success: "#2eb67d",
  successSoft: "rgba(46,182,125,0.12)",
  warning: "#f59e0b",
  warningSoft: "rgba(245,158,11,0.12)",
  destructive: "#ef4444",
  destructiveSoft: "rgba(239,68,68,0.10)",
  input: "#ffffff",
  shadow: "rgba(15,23,42,0.10)",
};

export const darkTheme: TankupTheme = {
  background: "#0f172a",
  foreground: "#f8fafc",
  card: "#111c31",
  cardSoft: "#1e293b",
  border: "#24324a",
  muted: "#1e293b",
  mutedForeground: "#94a3b8",
  primary: "#3b82f6",
  primarySoft: "rgba(59,130,246,0.16)",
  primaryForeground: "#ffffff",
  success: "#22c55e",
  successSoft: "rgba(34,197,94,0.16)",
  warning: "#f59e0b",
  warningSoft: "rgba(245,158,11,0.16)",
  destructive: "#ef4444",
  destructiveSoft: "rgba(239,68,68,0.16)",
  input: "#0f172a",
  shadow: "rgba(0,0,0,0.25)",
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export function getTheme(theme: AppTheme) {
  return themes[theme];
}

// export type AppTheme = "light" | "dark";

// export const lightTheme = {
//   background: "#f8fafc",
//   foreground: "#111827",

//   card: "#ffffff",
//   border: "#e5e7eb",

//   primary: "#1e88ff",
//   primaryForeground: "#ffffff",

//   muted: "#64748b",
//   mutedForeground: "#64748b",

//   success: "#16a34a",
//   danger: "#dc2626",
//   warning: "#f59e0b",
// };

// export const darkTheme = {
//   background: "#0f172a",
//   foreground: "#e6edf7",

//   card: "#0f172a",
//   border: "#1e293b",

//   primary: "#1e88ff",
//   primaryForeground: "#ffffff",

//   muted: "#7c8aa6",
//   mutedForeground: "#94a3b8",

//   success: "#22c55e",
//   danger: "#ef4444",
//   warning: "#fbbf24",
// };


// export const themes = {
//   light: lightTheme,
//   dark: darkTheme,
// };

// export function getTheme(theme: AppTheme) {
//   return themes[theme];
// }