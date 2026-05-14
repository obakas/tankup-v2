import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, RefreshCw, LogOut } from "lucide-react-native";
import { apiRequest } from "@/lib/api";

const POLL_INTERVAL_MS = 10000;

// ── Admin API helpers ─────────────────────────────────────────────────────────

async function adminLogin(username: string, password: string): Promise<string> {
  const res = await apiRequest<{ access_token: string }>("/admin/login", {
    method: "POST",
    body: { username, password },
  });
  return res.access_token;
}

async function getOverview(token: string): Promise<any> {
  return apiRequest("/admins/overview", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getTankers(token: string): Promise<any[]> {
  return apiRequest("/admins/tankers", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getLive(token: string): Promise<any> {
  return apiRequest("/admins/live", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [tankers, setTankers] = useState<any[]>([]);
  const [live, setLive] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "tankers" | "live">("overview");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(
    async (tok: string, silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [ov, tnk, lv] = await Promise.all([
          getOverview(tok),
          getTankers(tok),
          getLive(tok),
        ]);
        setOverview(ov);
        setTankers(tnk);
        setLive(lv);
      } catch (e: any) {
        setError(e.message);
        if (e.message.includes("401") || e.message.includes("403")) {
          setToken(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!token) return;
    fetchAll(token);
    pollRef.current = setInterval(() => fetchAll(token, true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, fetchAll]);

  const onRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    await fetchAll(token, true);
    setRefreshing(false);
  };

  const handleLogout = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setToken(null);
    setOverview(null);
    setTankers([]);
    setLive(null);
  };

  if (!token) {
    return <AdminLoginScreen onLogin={setToken} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2">
          <ArrowLeft color="#e6edf7" size={20} />
        </Pressable>
        <Text className="text-foreground font-bold text-base">Admin Dashboard</Text>
        <Pressable onPress={handleLogout} className="p-2">
          <LogOut color="#7c8aa6" size={20} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-border">
        {(["overview", "tankers", "live"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-3 items-center ${
              tab === t ? "border-b-2 border-primary" : ""
            }`}
          >
            <Text
              className={`font-medium text-sm capitalize ${
                tab === t ? "text-primary" : "text-muted"
              }`}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1e88ff" size="large" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e88ff" />
          }
        >
          {error && (
            <View className="bg-red-900/30 border border-red-500 rounded-xl p-4">
              <Text className="text-red-400">{error}</Text>
            </View>
          )}

          {tab === "overview" && overview && (
            <OverviewTab overview={overview} />
          )}

          {tab === "tankers" && (
            <TankersTab tankers={tankers} />
          )}

          {tab === "live" && live && (
            <LiveTab live={live} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────

function AdminLoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username || !password) { setError("Credentials required"); return; }
    setLoading(true); setError(null);
    try {
      const tok = await adminLogin(username, password);
      onLogin(tok);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2">
          <ArrowLeft color="#e6edf7" size={20} />
        </Pressable>
        <Text className="text-foreground font-bold text-base ml-2">Admin Login</Text>
      </View>

      <View className="flex-1 px-6 py-10 justify-center gap-4">
        {error && (
          <View className="bg-red-900/30 border border-red-500 rounded-xl p-3">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}

        <View>
          <Text className="text-foreground font-medium mb-2">Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            placeholderTextColor="#7c8aa6"
            autoCapitalize="none"
            className="bg-card border border-border rounded-xl px-4 py-3"
            style={{ color: "#e6edf7" }}
          />
        </View>

        <View>
          <Text className="text-foreground font-medium mb-2">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#7c8aa6"
            secureTextEntry
            className="bg-card border border-border rounded-xl px-4 py-3"
            style={{ color: "#e6edf7" }}
          />
        </View>

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          className="bg-amber-500 rounded-xl py-4 items-center mt-2"
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-semibold">Sign In as Admin</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: any }) {
  const t = overview.totals ?? {};
  const pv = overview.payment_value ?? {};
  const sb = overview.status_breakdown ?? {};

  return (
    <>
      <Text className="text-muted text-xs">
        Last updated: {new Date(overview.generated_at).toLocaleTimeString()}
      </Text>

      {/* Key metrics */}
      <View className="flex-row gap-3 flex-wrap">
        <StatCard label="Online Tankers" value={String(t.online_tankers ?? 0)} color="success" />
        <StatCard label="Available" value={String(t.available_tankers ?? 0)} color="primary" />
        <StatCard label="Active Batches" value={String(t.active_batches ?? 0)} color="warning" />
        <StatCard label="Priority Active" value={String(t.active_priority_requests ?? 0)} color="primary" />
        <StatCard label="Active Deliveries" value={String(t.active_deliveries ?? 0)} color="success" />
        <StatCard label="Total Users" value={String(t.users ?? 0)} color="muted" />
      </View>

      {/* Revenue */}
      <View className="bg-card border border-border rounded-2xl p-5">
        <Text className="text-muted text-xs uppercase tracking-wider mb-3">Revenue</Text>
        <View className="flex-row justify-between">
          <View>
            <Text className="text-muted text-xs">Confirmed Paid</Text>
            <Text className="text-foreground text-xl font-bold">
              ₦{(pv.paid ?? 0).toLocaleString()}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-muted text-xs">Total Outstanding</Text>
            <Text className="text-foreground text-xl font-bold">
              ₦{(pv.total ?? 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Tanker status breakdown */}
      {sb.tankers && Object.keys(sb.tankers).length > 0 && (
        <View className="bg-card border border-border rounded-2xl p-5">
          <Text className="text-muted text-xs uppercase tracking-wider mb-3">Tanker Status</Text>
          {Object.entries(sb.tankers).map(([status, count]) => (
            <View key={status} className="flex-row justify-between py-1">
              <Text className="text-muted capitalize">{status}</Text>
              <Text className="text-foreground font-semibold">{String(count)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Delivery status breakdown */}
      {sb.deliveries && Object.keys(sb.deliveries).length > 0 && (
        <View className="bg-card border border-border rounded-2xl p-5">
          <Text className="text-muted text-xs uppercase tracking-wider mb-3">Delivery Status</Text>
          {Object.entries(sb.deliveries).map(([status, count]) => (
            <View key={status} className="flex-row justify-between py-1">
              <Text className="text-muted capitalize">{status.replace(/_/g, " ")}</Text>
              <Text className="text-foreground font-semibold">{String(count)}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

// ── Tankers Tab ───────────────────────────────────────────────────────────────

function TankersTab({ tankers }: { tankers: any[] }) {
  if (!tankers.length) {
    return (
      <View className="bg-card border border-border rounded-2xl p-6 items-center">
        <Text className="text-muted">No tankers registered</Text>
      </View>
    );
  }

  return (
    <>
      {tankers.map((t: any) => (
        <View key={t.id} className="bg-card border border-border rounded-2xl p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-foreground font-semibold">{t.driver_name}</Text>
              <Text className="text-muted text-sm">{t.phone}</Text>
              <Text className="text-muted text-xs mt-1">Plate: {t.tank_plate_number}</Text>
            </View>
            <View className="items-end gap-1">
              <StatusBadge status={t.status} />
              <Text className={`text-xs ${t.is_online ? "text-success" : "text-muted"}`}>
                {t.is_online ? "● Online" : "○ Offline"}
              </Text>
              <Text className={`text-xs ${t.is_available ? "text-primary" : "text-muted"}`}>
                {t.is_available ? "Available" : "Busy"}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

// ── Live Tab ──────────────────────────────────────────────────────────────────

function LiveTab({ live }: { live: any }) {
  const batches = live.active_batches ?? [];
  const requests = live.active_priority_requests ?? [];

  return (
    <>
      {batches.length === 0 && requests.length === 0 && (
        <View className="bg-card border border-border rounded-2xl p-6 items-center">
          <Text className="text-muted">No active jobs right now</Text>
        </View>
      )}

      {batches.length > 0 && (
        <>
          <Text className="text-foreground font-semibold">Active Batches ({batches.length})</Text>
          {batches.map((b: any) => (
            <View key={b.id} className="bg-card border border-border rounded-2xl p-4">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="text-foreground font-semibold">Batch #{b.id}</Text>
                  <Text className="text-muted text-sm mt-1">
                    {b.member_count ?? b.deliveries_total ?? "—"} members •{" "}
                    {(b.current_volume ?? 0).toLocaleString()}L
                  </Text>
                  {b.deliveries_completed !== undefined && (
                    <Text className="text-muted text-xs mt-1">
                      Delivered: {b.deliveries_completed}/{b.deliveries_total}
                    </Text>
                  )}
                </View>
                <StatusBadge status={b.status} />
              </View>
            </View>
          ))}
        </>
      )}

      {requests.length > 0 && (
        <>
          <Text className="text-foreground font-semibold mt-2">
            Priority Requests ({requests.length})
          </Text>
          {requests.map((r: any) => (
            <View key={r.id} className="bg-card border border-border rounded-2xl p-4">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="text-foreground font-semibold">Request #{r.id}</Text>
                  <Text className="text-muted text-sm mt-1">
                    {(r.volume_liters ?? 0).toLocaleString()}L • User #{r.user_id}
                  </Text>
                </View>
                <StatusBadge status={r.status} />
              </View>
            </View>
          ))}
        </>
      )}
    </>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

function StatCard({
  label, value, color,
}: {
  label: string;
  value: string;
  color: "success" | "primary" | "warning" | "muted";
}) {
  const textColor = {
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning",
    muted: "text-foreground",
  }[color];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 flex-1 min-w-[44%]">
      <Text className="text-muted text-xs uppercase tracking-wider">{label}</Text>
      <Text className={`${textColor} text-2xl font-bold mt-1`}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    available: "bg-success/20 text-success",
    delivering: "bg-primary/20 text-primary",
    loading: "bg-warning/20 text-warning",
    assigned: "bg-blue-900/30 text-blue-400",
    arrived: "bg-purple-900/30 text-purple-400",
    completed: "bg-success/20 text-success",
    forming: "bg-border text-muted",
    collecting: "bg-border text-muted",
    offline: "bg-border text-muted",
    pending: "bg-warning/20 text-warning",
    failed: "bg-red-900/30 text-red-400",
  };
  const cls = colorMap[status] ?? "bg-border text-muted";

  return (
    <View className={`px-2 py-1 rounded-lg ${cls.split(" ")[0]}`}>
      <Text className={`text-xs font-medium capitalize ${cls.split(" ")[1]}`}>
        {status?.replace(/_/g, " ")}
      </Text>
    </View>
  );
}
