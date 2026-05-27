import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Droplets, Truck, Users, Moon, Sun } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, darkColors } from "@/constants/tankupTheme";

const ROLE_KEY = "tankup_active_role";
const DRIVER_AUTH_KEY = "driver_auth";
const CLIENT_USER_KEY = "water_user";
const CLIENT_SESSION_KEY = "water_client_session";
const FLEET_HEAD_AUTH_KEY = "fleet_head_auth";
const THEME_KEY = "tankup-theme";

type ThemeMode = "light" | "dark";
type Role = "client" | "driver" | "fleet_head";

export default function RoleSelect() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [hydrated, setHydrated] = useState(false);
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = theme === "dark";
  const c = isDark ? darkColors : colors;

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [savedTheme, savedRole, driverAuth, clientUser, clientSession, fleetHeadAuth] =
        await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(ROLE_KEY),
          AsyncStorage.getItem(DRIVER_AUTH_KEY),
          AsyncStorage.getItem(CLIENT_USER_KEY),
          AsyncStorage.getItem(CLIENT_SESSION_KEY),
          AsyncStorage.getItem(FLEET_HEAD_AUTH_KEY),
        ]);

      if (!mounted) return;
      setTheme(savedTheme === "dark" ? "dark" : "light");
      setHydrated(true);

      if (savedRole === "driver" && driverAuth) { router.replace("/driver"); return; }
      if (savedRole === "client" && (clientUser || clientSession)) { router.replace("/client"); return; }
      if (savedRole === "fleet_head" && fleetHeadAuth) { router.replace("/fleet-head"); return; }
      if (driverAuth) { router.replace("/driver"); return; }
      if (clientUser || clientSession) { router.replace("/client"); return; }
      if (fleetHeadAuth) { router.replace("/fleet-head"); return; }
    }

    hydrate();
    return () => { mounted = false; };
  }, []);

  const toggleTheme = async () => {
    const next: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  const selectRole = async (role: Role) => {
    await AsyncStorage.setItem(ROLE_KEY, role);
    if (role === "client") router.push("/client");
    else if (role === "driver") router.push("/driver");
    else router.push("/fleet-head");
  };

  // 5 rapid taps on the logo within 2 seconds opens the admin panel
  const handleLogoTap = () => {
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);

    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0;
      router.push("/admin");
      return;
    }

    logoTapTimer.current = setTimeout(() => {
      logoTapCount.current = 0;
    }, 2000);
  };

  if (!hydrated) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color={c.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View className="flex-1 px-6 justify-center">
        <View className="w-full max-w-sm self-center">

          <View className="items-end mb-6">
            <Pressable
              onPress={toggleTheme}
              style={{ borderColor: c.border, backgroundColor: c.card }}
              className="h-11 w-11 rounded-full border items-center justify-center active:scale-95"
            >
              {isDark
                ? <Sun color={c.foreground} size={20} />
                : <Moon color={c.foreground} size={20} />}
            </Pressable>
          </View>

          <View className="items-center mb-8">
            <Pressable
              onPress={handleLogoTap}
              className="w-20 h-20 rounded-3xl bg-primary items-center justify-center mb-4 shadow-lg active:scale-95"
            >
              <Droplets color="#ffffff" size={42} />
            </Pressable>
            <Text style={{ color: c.foreground }} className="text-3xl font-extrabold tracking-tight">
              TankUp
            </Text>
            <Text style={{ color: c.mutedForeground }} className="mt-2 text-base">
              Water delivery, coordinated.
            </Text>
          </View>

          <View className="gap-4">
            <RoleCard
              c={c}
              iconBg={isDark ? "rgba(59,130,246,0.16)" : "rgba(0,132,255,0.10)"}
              icon={<Droplets color={c.primary} size={28} />}
              title="I Need Water"
              subtitle="Request water delivery to your tank"
              onPress={() => selectRole("client")}
            />
            <RoleCard
              c={c}
              iconBg={isDark ? "rgba(34,197,94,0.16)" : "rgba(46,182,125,0.10)"}
              icon={<Truck color={c.success} size={28} />}
              title="I'm a Tanker Driver"
              subtitle="Accept jobs, deliver water, & get paid"
              onPress={() => selectRole("driver")}
            />
            <RoleCard
              c={c}
              iconBg={isDark ? "rgba(139,92,246,0.16)" : "rgba(139,92,246,0.10)"}
              icon={<Users color="#8b5cf6" size={28} />}
              title="Manage My Fleet"
              subtitle="Coordinate drivers, tankers & operations"
              onPress={() => selectRole("fleet_head")}
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
  c,
  iconBg,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  c: typeof colors;
  iconBg: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: c.card, borderColor: c.border }}
      className="w-full rounded-2xl border p-5 flex-row items-center gap-5 active:scale-[0.98]"
    >
      <View
        style={{ backgroundColor: iconBg }}
        className="w-14 h-14 rounded-2xl items-center justify-center shrink-0"
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text style={{ color: c.foreground }} className="font-bold text-lg">{title}</Text>
        <Text style={{ color: c.mutedForeground }} className="text-sm mt-1">{subtitle}</Text>
      </View>
    </Pressable>
  );
}
