import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Droplets, Truck, Users, Moon, Sun } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "@/hooks/useAppTheme";
import { type TankupTheme } from "@/components/ui/theme";

const ROLE_KEY = "tankup_active_role";
const DRIVER_AUTH_KEY = "driver_auth";
const CLIENT_USER_KEY = "water_user";
const CLIENT_SESSION_KEY = "water_client_session";
const FLEET_HEAD_AUTH_KEY = "fleet_head_auth";

type Role = "client" | "driver" | "fleet_head";

const ALL_ROLES: Array<{
  role: Role;
  title: string;
  subtitle: string;
  iconBg: (theme: TankupTheme) => string;
  icon: (theme: TankupTheme) => ReactNode;
}> = [
  {
    role: "client",
    title: "I Need Water",
    subtitle: "Request water delivery to your tank",
    iconBg: (t) => t.primarySoft,
    icon: (t) => <Droplets color={t.primary} size={28} />,
  },
  {
    role: "driver",
    title: "I'm a Tanker Driver",
    subtitle: "Accept jobs, deliver water, & get paid",
    iconBg: (t) => t.successSoft,
    icon: (t) => <Truck color={t.success} size={28} />,
  },
  {
    role: "fleet_head",
    title: "Manage My Fleet",
    subtitle: "Coordinate drivers, tankers & operations",
    iconBg: () => "rgba(139,92,246,0.12)",
    icon: () => <Users color="#8b5cf6" size={28} />,
  },
];

// Prevents the auto-route from re-firing when the user presses the system back button
// from a role screen (which remounts this screen). Resets on full app restart.
let sessionRouted = false;

export default function RoleSelect() {
  const { theme, isDark, toggleTheme } = useAppTheme();
  const [hydrated, setHydrated] = useState(false);
  const [authedRoles, setAuthedRoles] = useState<Set<Role>>(new Set());
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // expo-notifications throws on import in Expo Go (Android, SDK 53+); guard with require
    try {
      const Notifications = require("expo-notifications");
      const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        if (data?.type === "batch_invite") {
          router.push("/client");
        }
        if (data?.type === "job_offer") {
          router.push("/driver");
        }
        if (data?.type === "delivery_status" || data?.type === "delivery_otp") {
          router.push("/client");
        }
      });
      return () => sub.remove();
    } catch {
      // running in Expo Go — push notification tap routing unavailable
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [savedRole, driverAuth, clientUser, clientSession, fleetHeadAuth] =
        await Promise.all([
          AsyncStorage.getItem(ROLE_KEY),
          AsyncStorage.getItem(DRIVER_AUTH_KEY),
          AsyncStorage.getItem(CLIENT_USER_KEY),
          AsyncStorage.getItem(CLIENT_SESSION_KEY),
          AsyncStorage.getItem(FLEET_HEAD_AUTH_KEY),
        ]);

      if (!mounted) return;

      const credentialed = new Set<Role>();
      if (driverAuth) credentialed.add("driver");
      if (clientUser || clientSession) credentialed.add("client");
      if (fleetHeadAuth) credentialed.add("fleet_head");

      setAuthedRoles(credentialed);
      setHydrated(true);

      // Auto-route only when savedRole + matching auth are both present.
      // Skip if already routed this session (user pressed system back from a role screen).
      if (!sessionRouted) {
        if (savedRole === "driver" && driverAuth) { sessionRouted = true; router.push("/driver"); return; }
        if (savedRole === "client" && (clientUser || clientSession)) { sessionRouted = true; router.push("/client"); return; }
        if (savedRole === "fleet_head" && fleetHeadAuth) { sessionRouted = true; router.push("/fleet-head"); return; }
      }
    }

    hydrate();
    return () => { mounted = false; };
  }, []);

  const selectRole = async (role: Role) => {
    await AsyncStorage.setItem(ROLE_KEY, role);
    sessionRouted = true;
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
        style={{ flex: 1, backgroundColor: theme.background, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View className="flex-1 px-6 justify-center">
        <View className="w-full max-w-sm self-center">

          <View className="items-end mb-6">
            <Pressable
              onPress={toggleTheme}
              accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
              accessibilityRole="button"
              style={{ borderColor: theme.border, backgroundColor: theme.card }}
              className="h-11 w-11 rounded-full border items-center justify-center active:scale-95"
            >
              {isDark
                ? <Sun color={theme.foreground} size={20} />
                : <Moon color={theme.foreground} size={20} />}
            </Pressable>
          </View>

          <View className="items-center mb-8">
            <Pressable
              onPress={handleLogoTap}
              style={{ backgroundColor: theme.primary }}
              className="w-20 h-20 rounded-3xl items-center justify-center mb-4 shadow-lg active:scale-95"
            >
              <Droplets color="#ffffff" size={42} />
            </Pressable>
            <Text style={{ color: theme.foreground }} className="text-3xl font-extrabold tracking-tight">
              TankUp
            </Text>
            <Text style={{ color: theme.mutedForeground }} className="mt-2 text-base">
              Water delivery, coordinated.
            </Text>
          </View>

          <View className="gap-4">
            {/* {ALL_ROLES.filter((r) => authedRoles.size === 0 || authedRoles.has(r.role)).map((r) => ( */}
            {ALL_ROLES.map((r) => ( 
              <RoleCard
                key={r.role}
                theme={theme}
                iconBg={r.iconBg(theme)}
                icon={r.icon(theme)}
                title={r.title}
                subtitle={r.subtitle}
                onPress={() => selectRole(r.role)}
              />
            ))}
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
  theme,
  iconBg,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  theme: TankupTheme;
  iconBg: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: theme.card, borderColor: theme.border }}
      className="w-full rounded-2xl border p-5 flex-row items-center gap-5 active:scale-[0.98]"
    >
      <View
        style={{ backgroundColor: iconBg }}
        className="w-14 h-14 rounded-2xl items-center justify-center shrink-0"
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text style={{ color: theme.foreground }} className="font-bold text-lg">{title}</Text>
        <Text style={{ color: theme.mutedForeground }} className="text-sm mt-1">{subtitle}</Text>
      </View>
    </Pressable>
  );
}
