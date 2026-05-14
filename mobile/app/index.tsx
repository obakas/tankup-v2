import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Droplets, Truck, Moon, Sun } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ROLE_KEY = "tankup_active_role";
const DRIVER_AUTH_KEY = "driver_auth";
const CLIENT_USER_KEY = "water_user";
const CLIENT_SESSION_KEY = "water_client_session";
const THEME_KEY = "tankup-theme";

type ThemeMode = "light" | "dark";

export default function RoleSelect() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [hydrated, setHydrated] = useState(false);

  const isDark = theme === "dark";
  const screenBg = isDark ? "#0f172a" : "#f8fafc";
  const cardBg = isDark ? "#111c31" : "#ffffff";
  const border = isDark ? "#24324a" : "#e5e7eb";
  const foreground = isDark ? "#f8fafc" : "#111827";
  const muted = isDark ? "#94a3b8" : "#64748b";

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [savedTheme, savedRole, driverAuth, clientUser, clientSession] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(ROLE_KEY),
        AsyncStorage.getItem(DRIVER_AUTH_KEY),
        AsyncStorage.getItem(CLIENT_USER_KEY),
        AsyncStorage.getItem(CLIENT_SESSION_KEY),
      ]);

      if (!mounted) return;
      setTheme(savedTheme === "dark" ? "dark" : "light");
      setHydrated(true);

      if (savedRole === "driver" && driverAuth) router.replace("/driver");
      else if (savedRole === "client" && (clientUser || clientSession)) router.replace("/client");
      else if (driverAuth) router.replace("/driver");
      else if (clientUser || clientSession) router.replace("/client");
    }

    hydrate();
    return () => { mounted = false; };
  }, []);

  const toggleTheme = async () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  const selectRole = async (role: "client" | "driver") => {
    await AsyncStorage.setItem(ROLE_KEY, role);
    router.push(role === "client" ? "/client" : "/driver");
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#0084ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
      <View className="flex-1 px-6 justify-center">
        <View className="w-full max-w-sm self-center">
          <View className="items-end mb-8">
            <Pressable
              onPress={toggleTheme}
              style={{ borderColor: border, backgroundColor: cardBg }}
              className="h-11 w-11 rounded-full border items-center justify-center active:scale-95"
            >
              {isDark ? <Sun color={foreground} size={20} /> : <Moon color={foreground} size={20} />}
            </Pressable>
          </View>

          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-3xl bg-primary items-center justify-center mb-4 shadow-lg">
              <Droplets color="#ffffff" size={42} />
            </View>
            <Text style={{ color: foreground }} className="text-3xl font-extrabold tracking-tight">TankUp</Text>
            <Text style={{ color: muted }} className="mt-2 text-base">Get water delivered to your tank</Text>
          </View>

          <View className="gap-4">
            <RoleCard
              cardBg={cardBg}
              border={border}
              foreground={foreground}
              muted={muted}
              iconBg={isDark ? "rgba(59,130,246,0.16)" : "rgba(0,132,255,0.10)"}
              icon={<Droplets color="#0084ff" size={28} />}
              title="I Need Water"
              subtitle="Request water delivery to your tank"
              onPress={() => selectRole("client")}
            />
            <RoleCard
              cardBg={cardBg}
              border={border}
              foreground={foreground}
              muted={muted}
              iconBg={isDark ? "rgba(34,197,94,0.16)" : "rgba(46,182,125,0.10)"}
              icon={<Truck color="#2eb67d" size={28} />}
              title="I'm a Tanker Driver"
              subtitle="Accept jobs, deliver water, & get paid"
              onPress={() => selectRole("driver")}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function RoleCard({
  icon,
  title,
  subtitle,
  onPress,
  cardBg,
  border,
  foreground,
  muted,
  iconBg,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  cardBg: string;
  border: string;
  foreground: string;
  muted: string;
  iconBg: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: cardBg, borderColor: border }}
      className="w-full rounded-2xl border p-6 flex-row items-center gap-5 active:scale-[0.98]"
    >
      <View style={{ backgroundColor: iconBg }} className="w-14 h-14 rounded-2xl items-center justify-center shrink-0">
        {icon}
      </View>
      <View className="flex-1">
        <Text style={{ color: foreground }} className="font-bold text-lg">{title}</Text>
        <Text style={{ color: muted }} className="text-sm mt-1">{subtitle}</Text>
      </View>
    </Pressable>
  );
}
