/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#f8fafc",
        foreground: "#111827",
        card: "#ffffff",
        border: "#e5e7eb",
        muted: "#f1f5f9",
        "muted-foreground": "#64748b",
        primary: "#0084ff",
        "primary-foreground": "#ffffff",
        success: "#2eb67d",
        "success-foreground": "#ffffff",
        warning: "#f59e0b",
        destructive: "#ef4444",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
