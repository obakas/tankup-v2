import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AlertTriangle, ArrowLeft, LogOut, RefreshCw, Zap } from "lucide-react-native";
import Constants from "expo-constants";
import { apiRequest } from "@/lib/api";
import { useAppTheme } from "@/hooks/useAppTheme";
import { type TankupTheme } from "@/components/ui/theme";
import { useAppStatePause } from "@/hooks/useAppStatePause";

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_LIVE_MS = 10_000;
const POLL_HIST_MS = 30_000;
const ADMIN_SECRET =
  (Constants.expoConfig?.extra?.ADMIN_SECRET as string) || "dev-admin-secret";

// ── Admin API ─────────────────────────────────────────────────────────────────

function adminReq<T>(
  token: string,
  endpoint: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: options.method ?? "GET",
    body: options.body,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-admin-secret": ADMIN_SECRET,
    },
  });
}

function buildQ(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

const api = {
  login: (u: string, p: string) =>
    apiRequest<{ access_token: string }>("/admin/login", {
      method: "POST",
      body: { username: u, password: p },
      headers: { "x-admin-secret": ADMIN_SECRET },
    }),
  overview: (tok: string) => adminReq<any>(tok, "/admin/overview"),
  live: (tok: string) => adminReq<any>(tok, "/admin/live?limit=20"),
  alerts: (tok: string) =>
    adminReq<{ items: any[] }>(tok, "/admin/operation-alerts?limit=50&status=open"),
  requests: (tok: string, search?: string, status?: string, type?: string) =>
    adminReq<{ items: any[] }>(
      tok,
      `/admin/requests?${buildQ({ limit: 100, search, status, delivery_type: type })}`
    ),
  deliveries: (tok: string, search?: string, status?: string, jobType?: string) =>
    adminReq<{ items: any[] }>(
      tok,
      `/admin/deliveries?${buildQ({ limit: 100, search, status, job_type: jobType })}`
    ),
  payments: (tok: string, search?: string, status?: string) =>
    adminReq<{ items: any[] }>(
      tok,
      `/admin/payments?${buildQ({ limit: 100, search, status })}`
    ),
  tankers: (tok: string) =>
    adminReq<{ items: any[] }>(tok, "/admin/tankers?limit=100"),

  // Actions
  reassignAlert: (tok: string, id: number) =>
    adminReq(tok, `/admin/operation-alerts/${id}/reassign`, { method: "POST" }),
  forceOfferPriority: (tok: string, reqId: number, tnkId: number) =>
    adminReq(tok, `/admin/requests/${reqId}/offer/${tnkId}`, { method: "POST" }),
  cancelPriority: (tok: string, reqId: number) =>
    adminReq(tok, `/admin/requests/${reqId}/cancel`, {
      method: "POST",
      body: { reason: "Cancelled manually by admin" },
    }),
  forceOfferBatch: (tok: string, batchId: number, tnkId: number) =>
    adminReq(tok, `/admin/batches/${batchId}/offer/${tnkId}`, { method: "POST" }),
  expireBatch: (tok: string, batchId: number) =>
    adminReq(tok, `/admin/batches/${batchId}/expire?refund_paid_members=true`, { method: "POST" }),
  resetTanker: (tok: string, tnkId: number) =>
    adminReq(tok, `/admin/tankers/${tnkId}/reset`, { method: "POST" }),
  cleanup: (tok: string) =>
    adminReq(tok, "/admin/maintenance/cleanup-expired", { method: "POST" }),
  completeDelivery: (tok: string, id: number) =>
    adminReq(tok, `/admin/deliveries/${id}/complete-manual`, {
      method: "POST",
      body: { notes: "Manual admin completion" },
    }),
  failDelivery: (tok: string, id: number, reason: string) =>
    adminReq(tok, `/admin/deliveries/${id}/fail-manual`, { method: "POST", body: { reason } }),
  skipDelivery: (tok: string, id: number, reason: string) =>
    adminReq(tok, `/admin/deliveries/${id}/skip-manual`, { method: "POST", body: { reason } }),
  refundMember: (tok: string, memberId: number) =>
    adminReq(tok, `/admin/batch-members/${memberId}/refund`, { method: "POST" }),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n?: number | null) {
  return new Intl.NumberFormat("en-NG").format(Number(n || 0));
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tab = "overview" | "live" | "history" | "payments" | "emergency";

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { theme } = useAppTheme();
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const [overview, setOverview] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tankers, setTankers] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [reqSearch, setReqSearch] = useState("");
  const [reqStatus, setReqStatus] = useState("");
  const [reqType, setReqType] = useState("");
  const [delSearch, setDelSearch] = useState("");
  const [delStatus, setDelStatus] = useState("");
  const [paySearch, setPaySearch] = useState("");
  const [payStatus, setPayStatus] = useState("");

  const [confirm, setConfirm] = useState<{
    title: string;
    msg: string;
    action: () => Promise<unknown>;
  } | null>(null);
  const [reasonModal, setReasonModal] = useState<{
    type: "fail" | "skip";
    deliveryId: number;
  } | null>(null);
  const [reasonText, setReasonText] = useState("");

  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const histRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep search params in a ref so polling closures always read fresh values
  const searchRef = useRef({ reqSearch, reqStatus, reqType, delSearch, delStatus, paySearch, payStatus });
  searchRef.current = { reqSearch, reqStatus, reqType, delSearch, delStatus, paySearch, payStatus };

  const fetchLive = useCallback(async (tok: string) => {
    try {
      const [ov, lv, al] = await Promise.all([
        api.overview(tok),
        api.live(tok),
        api.alerts(tok),
      ]);
      setOverview(ov);
      setLive(lv);
      setAlerts(al.items ?? []);
    } catch (e: any) {
      if (e.message?.includes("401") || e.message?.includes("403")) setToken(null);
    }
  }, []);

  const fetchHistory = useCallback(async (tok: string) => {
    const { reqSearch, reqStatus, reqType, delSearch, delStatus, paySearch, payStatus } =
      searchRef.current;
    try {
      const [req, del, pay, tnk] = await Promise.all([
        api.requests(tok, reqSearch, reqStatus, reqType),
        api.deliveries(tok, delSearch, delStatus),
        api.payments(tok, paySearch, payStatus),
        api.tankers(tok),
      ]);
      setRequests(req.items ?? []);
      setDeliveries(del.items ?? []);
      setPayments(pay.items ?? []);
      setTankers(tnk.items ?? []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchLive(token), fetchHistory(token)]).finally(() => setLoading(false));
    liveRef.current = setInterval(() => fetchLive(token), POLL_LIVE_MS);
    histRef.current = setInterval(() => fetchHistory(token), POLL_HIST_MS);
    return () => {
      if (liveRef.current) clearInterval(liveRef.current);
      if (histRef.current) clearInterval(histRef.current);
    };
  }, [token, fetchLive, fetchHistory]);

  const stopAllPolling = useCallback(() => {
    if (liveRef.current) { clearInterval(liveRef.current); liveRef.current = null; }
    if (histRef.current) { clearInterval(histRef.current); histRef.current = null; }
  }, []);

  const restartAllPolling = useCallback(() => {
    if (!token) return;
    stopAllPolling();
    fetchLive(token);
    fetchHistory(token);
    liveRef.current = setInterval(() => fetchLive(token), POLL_LIVE_MS);
    histRef.current = setInterval(() => fetchHistory(token), POLL_HIST_MS);
  }, [token, fetchLive, fetchHistory, stopAllPolling]);

  useAppStatePause(stopAllPolling, restartAllPolling);

  useEffect(() => {
    if (!token) return;
    fetchHistory(token);
  }, [reqSearch, reqStatus, reqType, delSearch, delStatus, paySearch, payStatus]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const runAction = async (action: () => Promise<unknown>, successMsg: string) => {
    setActionLoading(true);
    try {
      await action();
      showToast(successMsg, true);
      if (token) {
        await Promise.all([fetchLive(token), fetchHistory(token)]);
      }
    } catch (e: any) {
      showToast(e.message || "Action failed", false);
    } finally {
      setActionLoading(false);
      setConfirm(null);
      setReasonModal(null);
      setReasonText("");
    }
  };

  const onRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    await Promise.all([fetchLive(token), fetchHistory(token)]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    if (liveRef.current) clearInterval(liveRef.current);
    if (histRef.current) clearInterval(histRef.current);
    setToken(null);
    setOverview(null);
    setLive(null);
    setAlerts([]);
    setRequests([]);
    setDeliveries([]);
    setPayments([]);
    setTankers([]);
  };

  if (!token) return <LoginScreen theme={theme} onLogin={setToken} />;

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: alerts.length ? `Overview (${alerts.length})` : "Overview" },
    { key: "live", label: "Live" },
    { key: "history", label: "History" },
    { key: "payments", label: "Payments" },
    { key: "emergency", label: "Emergency" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
          <ArrowLeft color={theme.mutedForeground} size={20} />
        </Pressable>
        <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 15 }}>
          Admin Dashboard
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable onPress={() => token && Promise.all([fetchLive(token), fetchHistory(token)])} style={{ padding: 6 }}>
            <RefreshCw color={theme.mutedForeground} size={18} />
          </Pressable>
          <Pressable onPress={handleLogout} style={{ padding: 6 }}>
            <LogOut color={theme.mutedForeground} size={18} />
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: theme.border, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: 2,
              borderBottomColor: tab === t.key ? theme.primary : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: tab === t.key ? theme.primary : theme.mutedForeground,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Toast */}
      {toast && (
        <View
          style={{
            position: "absolute",
            top: 90,
            left: 16,
            right: 16,
            zIndex: 200,
            backgroundColor: toast.ok ? theme.successSoft : theme.destructiveSoft,
            borderWidth: 1,
            borderColor: toast.ok ? theme.success : theme.destructive,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Text style={{ color: toast.ok ? theme.success : theme.destructive, fontSize: 13 }}>
            {toast.msg}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {error && (
            <View
              style={{
                backgroundColor: theme.destructiveSoft,
                borderWidth: 1,
                borderColor: theme.destructive,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <Text style={{ color: theme.destructive, fontSize: 13 }}>{error}</Text>
            </View>
          )}

          {tab === "overview" && (
            <OverviewTab
              theme={theme}
              overview={overview}
              alerts={alerts}
              actionLoading={actionLoading}
              onReassign={(id) =>
                runAction(() => api.reassignAlert(token, id), "Reassignment triggered")
              }
            />
          )}

          {tab === "live" && <LiveTab theme={theme} live={live} />}

          {tab === "history" && (
            <HistoryTab
              theme={theme}
              requests={requests}
              deliveries={deliveries}
              reqSearch={reqSearch}
              setReqSearch={setReqSearch}
              reqStatus={reqStatus}
              setReqStatus={setReqStatus}
              reqType={reqType}
              setReqType={setReqType}
              delSearch={delSearch}
              setDelSearch={setDelSearch}
              delStatus={delStatus}
              setDelStatus={setDelStatus}
              actionLoading={actionLoading}
              onComplete={(id) =>
                setConfirm({
                  title: "Complete delivery",
                  msg: `Force-complete delivery #${id}? Bypasses missing OTP/measurement.`,
                  action: () => api.completeDelivery(token, id),
                })
              }
              onFail={(id) => {
                setReasonModal({ type: "fail", deliveryId: id });
                setReasonText("");
              }}
              onSkip={(id) => {
                setReasonModal({ type: "skip", deliveryId: id });
                setReasonText("");
              }}
            />
          )}

          {tab === "payments" && (
            <PaymentsTab
              theme={theme}
              payments={payments}
              tankers={tankers}
              paySearch={paySearch}
              setPaySearch={setPaySearch}
              payStatus={payStatus}
              setPayStatus={setPayStatus}
              actionLoading={actionLoading}
              onRefund={(memberId) =>
                setConfirm({
                  title: "Refund member",
                  msg: `Issue refund for batch member #${memberId}?`,
                  action: () => api.refundMember(token, memberId),
                })
              }
              onReset={(tnkId) =>
                setConfirm({
                  title: "Reset tanker",
                  msg: `Clear pending offer/assignment for tanker #${tnkId}?`,
                  action: () => api.resetTanker(token, tnkId),
                })
              }
            />
          )}

          {tab === "emergency" && (
            <EmergencyTab
              theme={theme}
              actionLoading={actionLoading}
              onForceOfferPriority={(rId, tId) =>
                setConfirm({
                  title: "Force priority offer",
                  msg: `Push priority request #${rId} offer to tanker #${tId}?`,
                  action: () => api.forceOfferPriority(token, rId, tId),
                })
              }
              onCancelPriority={(rId) =>
                setConfirm({
                  title: "Cancel priority request",
                  msg: `Cancel priority #${rId}? Clears offers, frees tanker, marks refund-eligible.`,
                  action: () => api.cancelPriority(token, rId),
                })
              }
              onForceOfferBatch={(bId, tId) =>
                setConfirm({
                  title: "Force batch offer",
                  msg: `Push batch #${bId} offer to tanker #${tId}?`,
                  action: () => api.forceOfferBatch(token, bId, tId),
                })
              }
              onExpireBatch={(bId) =>
                setConfirm({
                  title: "Expire batch + refund",
                  msg: `Expire batch #${bId} and trigger refunds for all paid members?`,
                  action: () => api.expireBatch(token, bId),
                })
              }
              onResetTanker={(tId) =>
                setConfirm({
                  title: "Reset tanker",
                  msg: `Reset tanker #${tId} to available?`,
                  action: () => api.resetTanker(token, tId),
                })
              }
              onCleanup={() =>
                setConfirm({
                  title: "Run cleanup",
                  msg: "Run expired-member cleanup immediately?",
                  action: () => api.cleanup(token),
                })
              }
            />
          )}
        </ScrollView>
      )}

      {/* Confirm modal */}
      <Modal visible={confirm !== null} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 18,
              padding: 20,
              width: "100%",
              gap: 12,
            }}
          >
            <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 16 }}>
              {confirm?.title}
            </Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 13, lineHeight: 18 }}>
              {confirm?.msg}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => setConfirm(null)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  paddingVertical: 11,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.foreground, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => confirm && runAction(confirm.action, `${confirm.title} succeeded`)}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  backgroundColor: theme.primary,
                  borderRadius: 10,
                  paddingVertical: 11,
                  alignItems: "center",
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reason modal for fail / skip */}
      <Modal visible={reasonModal !== null} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 18,
              padding: 20,
              width: "100%",
              gap: 12,
            }}
          >
            <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 16 }}>
              {reasonModal?.type === "fail" ? "Mark delivery as failed" : "Skip delivery"}
            </Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
              Give a real reason — the paper trail matters.
            </Text>
            <TextInput
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="Reason..."
              placeholderTextColor={theme.mutedForeground}
              style={{
                backgroundColor: theme.input,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: theme.foreground,
                fontSize: 13,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => {
                  setReasonModal(null);
                  setReasonText("");
                }}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  paddingVertical: 11,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.foreground, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!reasonModal || reasonText.trim().length < 3) {
                    showToast("Reason must be at least 3 characters", false);
                    return;
                  }
                  const { type, deliveryId } = reasonModal;
                  runAction(
                    () =>
                      type === "fail"
                        ? api.failDelivery(token, deliveryId, reasonText.trim())
                        : api.skipDelivery(token, deliveryId, reasonText.trim()),
                    `Delivery ${type === "fail" ? "failed" : "skipped"}`
                  );
                }}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  backgroundColor: theme.destructive,
                  borderRadius: 10,
                  paddingVertical: 11,
                  alignItems: "center",
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({
  theme,
  onLogin,
}: {
  theme: TankupTheme;
  onLogin: (token: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Username and password required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(username.trim(), password.trim());
      onLogin(res.access_token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
          <ArrowLeft color={theme.mutedForeground} size={20} />
        </Pressable>
        <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 15, marginLeft: 8 }}>
          Admin Login
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48, gap: 16 }}>
        {error && (
          <View
            style={{
              backgroundColor: theme.destructiveSoft,
              borderWidth: 1,
              borderColor: theme.destructive,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Text style={{ color: theme.destructive, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            placeholderTextColor={theme.mutedForeground}
            autoCapitalize="none"
            style={{
              backgroundColor: theme.input,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: theme.foreground,
              fontSize: 14,
            }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.mutedForeground}
            secureTextEntry
            style={{
              backgroundColor: theme.input,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: theme.foreground,
              fontSize: 14,
            }}
          />
        </View>

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          style={{
            backgroundColor: theme.primary,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Sign In as Admin</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  theme,
  overview,
  alerts,
  actionLoading,
  onReassign,
}: {
  theme: TankupTheme;
  overview: any;
  alerts: any[];
  actionLoading: boolean;
  onReassign: (id: number) => void;
}) {
  if (!overview) return <EmptyState theme={theme} message="Loading overview..." />;

  const t = overview.totals ?? {};
  const pv = overview.payment_value ?? {};
  const sb = overview.status_breakdown ?? {};

  return (
    <>
      <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
        Updated {fmtDate(overview.generated_at)}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard theme={theme} label="Online Tankers" value={t.online_tankers ?? 0} color={theme.success} soft={theme.successSoft} />
        <StatCard theme={theme} label="Available" value={t.available_tankers ?? 0} color={theme.primary} soft={theme.primarySoft} />
        <StatCard theme={theme} label="Active Batches" value={t.active_batches ?? 0} color={theme.warning} soft={theme.warningSoft} />
        <StatCard theme={theme} label="Active Deliveries" value={t.active_deliveries ?? 0} color={theme.primary} soft={theme.primarySoft} />
        <StatCard theme={theme} label="Priority Active" value={t.active_priority_requests ?? 0} color={theme.success} soft={theme.successSoft} />
        <StatCard theme={theme} label="Total Users" value={t.users ?? 0} color={theme.mutedForeground} soft={theme.muted} />
      </View>

      <View
        style={{
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 16,
          padding: 16,
          gap: 10,
        }}
      >
        <Text
          style={{
            color: theme.mutedForeground,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Revenue
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Confirmed Paid</Text>
            <Text style={{ color: theme.foreground, fontSize: 22, fontWeight: "800" }}>
              ₦{fmt(pv.paid)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Total Outstanding</Text>
            <Text style={{ color: theme.foreground, fontSize: 22, fontWeight: "800" }}>
              ₦{fmt(pv.total)}
            </Text>
          </View>
        </View>
      </View>

      <SectionHeader
        theme={theme}
        title="Operation Alerts"
        subtitle={alerts.length === 0 ? "All clear" : `${alerts.length} open`}
      />
      {alerts.length === 0 ? (
        <EmptyState theme={theme} message="No open alerts — beautiful silence." />
      ) : (
        alerts.map((a) => (
          <AlertCard
            key={a.id}
            theme={theme}
            alert={a}
            actionLoading={actionLoading}
            onReassign={onReassign}
          />
        ))
      )}

      {sb.tankers && Object.keys(sb.tankers).length > 0 && (
        <BreakdownCard theme={theme} title="Tanker Status" data={sb.tankers} />
      )}
      {sb.deliveries && Object.keys(sb.deliveries).length > 0 && (
        <BreakdownCard theme={theme} title="Delivery Status" data={sb.deliveries} />
      )}
    </>
  );
}

// ── Live Tab ──────────────────────────────────────────────────────────────────

function LiveTab({ theme, live }: { theme: TankupTheme; live: any }) {
  if (!live) return <EmptyState theme={theme} message="Loading live data..." />;

  const batches: any[] = live.batches ?? live.active_batches ?? [];
  const liveTankers: any[] = live.tankers ?? [];
  const deliveries: any[] = live.deliveries ?? [];
  const priorities: any[] = live.priority_requests ?? live.active_priority_requests ?? [];

  return (
    <>
      <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
        Updated {fmtDate(live.generated_at)}
      </Text>

      <SectionHeader theme={theme} title={`Active Batches (${batches.length})`} />
      {batches.length === 0 ? (
        <EmptyState theme={theme} message="No active batches" />
      ) : (
        batches.map((b) => (
          <View key={b.id} style={card(theme)}>
            <Row>
              <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>
                Batch #{b.id}
              </Text>
              <StatusBadge status={b.status} theme={theme} />
            </Row>
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              {fmt(b.current_volume)}L / {fmt(b.target_volume)}L • {b.fill_percent ?? "—"}% full
            </Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              Members: {b.member_count} • Paid: {b.paid_member_count ?? "—"}
            </Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              Tanker: {b.tanker_id ? `#${b.tanker_id}` : "Unassigned"}
            </Text>
          </View>
        ))
      )}

      <SectionHeader theme={theme} title={`Active Tankers (${liveTankers.length})`} />
      {liveTankers.length === 0 ? (
        <EmptyState theme={theme} message="No active tankers" />
      ) : (
        liveTankers.map((t) => (
          <View key={t.id} style={card(theme)}>
            <Row>
              <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>
                {t.driver_name}
              </Text>
              <StatusBadge status={t.status} theme={theme} />
            </Row>
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              Plate: {t.tank_plate_number}
            </Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              Online: {t.is_online ? "Yes" : "No"} • Available: {t.is_available ? "Yes" : "No"}
            </Text>
          </View>
        ))
      )}

      <SectionHeader theme={theme} title={`Active Deliveries (${deliveries.length})`} />
      {deliveries.length === 0 ? (
        <EmptyState theme={theme} message="No active deliveries" />
      ) : (
        deliveries.map((d) => (
          <View key={d.id} style={card(theme)}>
            <Row>
              <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>
                Delivery #{d.id}
              </Text>
              <StatusBadge status={d.delivery_status} theme={theme} />
            </Row>
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              {d.job_type} • Tanker #{d.tanker_id} • Stop {d.stop_order ?? "—"}
            </Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              Planned: {fmt(d.planned_liters)}L • OTP: {d.otp_verified ? "Verified" : "Pending"}
            </Text>
            {d.anomaly_flagged && (
              <View
                style={{
                  backgroundColor: theme.warningSoft,
                  borderRadius: 8,
                  padding: 6,
                  marginTop: 2,
                }}
              >
                <Text style={{ color: theme.warning, fontSize: 11 }}>⚠ Anomaly flagged</Text>
              </View>
            )}
          </View>
        ))
      )}

      {priorities.length > 0 && (
        <>
          <SectionHeader theme={theme} title={`Priority Requests (${priorities.length})`} />
          {priorities.map((r) => (
            <View key={r.id} style={card(theme)}>
              <Row>
                <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>
                  Request #{r.id}
                </Text>
                <StatusBadge status={r.status} theme={theme} />
              </Row>
              <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                {fmt(r.volume_liters)}L • User #{r.user_id}
              </Text>
            </View>
          ))}
        </>
      )}
    </>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({
  theme,
  requests,
  deliveries,
  reqSearch, setReqSearch,
  reqStatus, setReqStatus,
  reqType, setReqType,
  delSearch, setDelSearch,
  delStatus, setDelStatus,
  actionLoading,
  onComplete, onFail, onSkip,
}: {
  theme: TankupTheme;
  requests: any[];
  deliveries: any[];
  reqSearch: string; setReqSearch: (v: string) => void;
  reqStatus: string; setReqStatus: (v: string) => void;
  reqType: string; setReqType: (v: string) => void;
  delSearch: string; setDelSearch: (v: string) => void;
  delStatus: string; setDelStatus: (v: string) => void;
  actionLoading: boolean;
  onComplete: (id: number) => void;
  onFail: (id: number) => void;
  onSkip: (id: number) => void;
}) {
  return (
    <>
      <SectionHeader theme={theme} title="Order History" subtitle={`${requests.length} requests`} />
      <SearchInput theme={theme} placeholder="Search request / user" value={reqSearch} onChange={setReqSearch} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SearchInput theme={theme} placeholder="Status" value={reqStatus} onChange={setReqStatus} style={{ flex: 1 }} />
        <SearchInput theme={theme} placeholder="batch / priority" value={reqType} onChange={setReqType} style={{ flex: 1 }} />
      </View>

      {requests.length === 0 ? (
        <EmptyState theme={theme} message="No requests found" />
      ) : (
        requests.map((r) => (
          <View key={r.id} style={card(theme)}>
            <Row>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 13 }}>
                  #{r.id} • {r.delivery_type}
                </Text>
                <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  User #{r.user_id} • {fmt(r.volume_liters)}L • Retry: {r.retry_count}
                </Text>
                <Text style={{ color: theme.mutedForeground, fontSize: 11, marginTop: 2 }}>
                  {fmtDate(r.created_at)}
                </Text>
              </View>
              <StatusBadge status={r.status} theme={theme} />
            </Row>
          </View>
        ))
      )}

      <SectionHeader
        theme={theme}
        title="Delivery History"
        subtitle={`${deliveries.length} deliveries`}
      />
      <SearchInput theme={theme} placeholder="Search delivery / batch / tanker" value={delSearch} onChange={setDelSearch} />
      <SearchInput theme={theme} placeholder="Status filter" value={delStatus} onChange={setDelStatus} />

      {deliveries.length === 0 ? (
        <EmptyState theme={theme} message="No deliveries found" />
      ) : (
        deliveries.map((d) => {
          const resolved = ["delivered", "failed", "skipped"].includes(d.delivery_status);
          return (
            <View key={d.id} style={card(theme)}>
              <Row>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 13 }}>
                    #{d.id} • {d.job_type}
                  </Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    Tanker #{d.tanker_id} • {d.user_name || `User #${d.user_id ?? "—"}`}
                  </Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                    {fmt(d.planned_liters)}L • {fmtDate(d.updated_at)}
                  </Text>
                </View>
                <StatusBadge status={d.delivery_status} theme={theme} />
              </Row>
              {!resolved ? (
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  <ActionBtn theme={theme} label="Complete" color={theme.success} soft={theme.successSoft} onPress={() => onComplete(d.id)} disabled={actionLoading} />
                  <ActionBtn theme={theme} label="Fail" color={theme.destructive} soft={theme.destructiveSoft} onPress={() => onFail(d.id)} disabled={actionLoading} />
                  <ActionBtn theme={theme} label="Skip" color={theme.warning} soft={theme.warningSoft} onPress={() => onSkip(d.id)} disabled={actionLoading} />
                </View>
              ) : (
                <Text style={{ color: theme.mutedForeground, fontSize: 11, marginTop: 6 }}>
                  Resolved
                </Text>
              )}
            </View>
          );
        })
      )}
    </>
  );
}

// ── Payments Tab ──────────────────────────────────────────────────────────────

function PaymentsTab({
  theme, payments, tankers,
  paySearch, setPaySearch, payStatus, setPayStatus,
  actionLoading, onRefund, onReset,
}: {
  theme: TankupTheme;
  payments: any[];
  tankers: any[];
  paySearch: string; setPaySearch: (v: string) => void;
  payStatus: string; setPayStatus: (v: string) => void;
  actionLoading: boolean;
  onRefund: (memberId: number) => void;
  onReset: (tnkId: number) => void;
}) {
  return (
    <>
      <SectionHeader theme={theme} title="Payments" subtitle={`${payments.length} records`} />
      <SearchInput theme={theme} placeholder="Search payment / batch / member" value={paySearch} onChange={setPaySearch} />
      <SearchInput theme={theme} placeholder="Status filter" value={payStatus} onChange={setPayStatus} />

      {payments.length === 0 ? (
        <EmptyState theme={theme} message="No payments found" />
      ) : (
        payments.map((p) => (
          <View key={p.id} style={card(theme)}>
            <Row>
              <View>
                <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 13 }}>
                  Payment #{p.id}
                </Text>
                <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  User #{p.user_id ?? "—"} • Batch #{p.batch_id ?? "—"} • Member #{p.member_id ?? "—"}
                </Text>
                <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 15, marginTop: 4 }}>
                  ₦{fmt(p.amount)}
                </Text>
              </View>
              <StatusBadge status={p.status} theme={theme} />
            </Row>
            {p.member_id && p.status === "paid" && (
              <View style={{ marginTop: 8 }}>
                <ActionBtn
                  theme={theme}
                  label="Refund"
                  color={theme.destructive}
                  soft={theme.destructiveSoft}
                  onPress={() => onRefund(p.member_id)}
                  disabled={actionLoading}
                />
              </View>
            )}
          </View>
        ))
      )}

      <SectionHeader theme={theme} title="Tankers" subtitle={`${tankers.length} registered`} />
      {tankers.length === 0 ? (
        <EmptyState theme={theme} message="No tankers found" />
      ) : (
        tankers.map((t) => (
          <View key={t.id} style={card(theme)}>
            <Row>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 13 }}>
                  #{t.id} • {t.driver_name}
                </Text>
                <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  {t.tank_plate_number} • Online: {t.is_online ? "Yes" : "No"} • Avail:{" "}
                  {t.is_available ? "Yes" : "No"}
                </Text>
              </View>
              <StatusBadge status={t.status} theme={theme} />
            </Row>
            <View style={{ marginTop: 8 }}>
              <ActionBtn
                theme={theme}
                label="Reset"
                color={theme.primary}
                soft={theme.primarySoft}
                onPress={() => onReset(t.id)}
                disabled={actionLoading}
              />
            </View>
          </View>
        ))
      )}
    </>
  );
}

// ── Emergency Tab ─────────────────────────────────────────────────────────────

function EmergencyTab({
  theme, actionLoading,
  onForceOfferPriority, onCancelPriority, onForceOfferBatch,
  onExpireBatch, onResetTanker, onCleanup,
}: {
  theme: TankupTheme;
  actionLoading: boolean;
  onForceOfferPriority: (rId: number, tId: number) => void;
  onCancelPriority: (rId: number) => void;
  onForceOfferBatch: (bId: number, tId: number) => void;
  onExpireBatch: (bId: number) => void;
  onResetTanker: (tId: number) => void;
  onCleanup: () => void;
}) {
  const [prioReqId, setPrioReqId] = useState("");
  const [prioTnkId, setPrioTnkId] = useState("");
  const [cancelReqId, setCancelReqId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batchTnkId, setBatchTnkId] = useState("");
  const [expireBId, setExpireBId] = useState("");
  const [resetTnkId, setResetTnkId] = useState("");

  return (
    <>
      <View
        style={{
          backgroundColor: theme.warningSoft,
          borderWidth: 1,
          borderColor: theme.warning,
          borderRadius: 12,
          padding: 12,
          marginBottom: 4,
        }}
      >
        <Text style={{ color: theme.warning, fontWeight: "700", fontSize: 13 }}>
          ⚠ Emergency Controls
        </Text>
        <Text style={{ color: theme.warning, fontSize: 12, marginTop: 4 }}>
          Manual intervention tools. All actions require confirmation before execution.
        </Text>
      </View>

      <ECard theme={theme} title="Force offer priority to tanker">
        <NumInput theme={theme} placeholder="Priority Request ID" value={prioReqId} onChange={setPrioReqId} />
        <NumInput theme={theme} placeholder="Tanker ID" value={prioTnkId} onChange={setPrioTnkId} />
        <EBtn theme={theme} label="Send priority offer" color={theme.primary}
          disabled={actionLoading || !prioReqId || !prioTnkId}
          onPress={() => onForceOfferPriority(Number(prioReqId), Number(prioTnkId))} />
      </ECard>

      <ECard theme={theme} title="Cancel priority request">
        <NumInput theme={theme} placeholder="Priority Request ID" value={cancelReqId} onChange={setCancelReqId} />
        <EBtn theme={theme} label="Cancel priority" color={theme.destructive}
          disabled={actionLoading || !cancelReqId}
          onPress={() => onCancelPriority(Number(cancelReqId))} />
      </ECard>

      <ECard theme={theme} title="Force offer batch to tanker">
        <NumInput theme={theme} placeholder="Batch ID" value={batchId} onChange={setBatchId} />
        <NumInput theme={theme} placeholder="Tanker ID" value={batchTnkId} onChange={setBatchTnkId} />
        <EBtn theme={theme} label="Send batch offer" color={theme.primary}
          disabled={actionLoading || !batchId || !batchTnkId}
          onPress={() => onForceOfferBatch(Number(batchId), Number(batchTnkId))} />
      </ECard>

      <ECard theme={theme} title="Force expire batch + refund">
        <NumInput theme={theme} placeholder="Batch ID" value={expireBId} onChange={setExpireBId} />
        <EBtn theme={theme} label="Expire batch + refund" color={theme.destructive}
          disabled={actionLoading || !expireBId}
          onPress={() => onExpireBatch(Number(expireBId))} />
      </ECard>

      <ECard theme={theme} title="Reset tanker to available">
        <NumInput theme={theme} placeholder="Tanker ID" value={resetTnkId} onChange={setResetTnkId} />
        <EBtn theme={theme} label="Reset tanker" color={theme.primary}
          disabled={actionLoading || !resetTnkId}
          onPress={() => onResetTanker(Number(resetTnkId))} />
      </ECard>

      <ECard theme={theme} title="Run expired-member cleanup">
        <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
          Triggers the expired-member cleanup job immediately. Normally runs on a schedule.
        </Text>
        <EBtn theme={theme} label="Run cleanup now" color={theme.primary}
          disabled={actionLoading} onPress={onCleanup} />
      </ECard>
    </>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  medium: { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  low:    { bg: "rgba(100,116,139,0.12)", text: "#94a3b8" },
  info:   { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available:    { bg: "rgba(46,182,125,0.15)",  text: "#2eb67d" },
  delivering:   { bg: "rgba(0,132,255,0.15)",   text: "#0084ff" },
  en_route:     { bg: "rgba(0,132,255,0.15)",   text: "#0084ff" },
  loading:      { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b" },
  assigned:     { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6" },
  arrived:      { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6" },
  completed:    { bg: "rgba(46,182,125,0.15)",  text: "#2eb67d" },
  delivered:    { bg: "rgba(46,182,125,0.15)",  text: "#2eb67d" },
  paid:         { bg: "rgba(46,182,125,0.15)",  text: "#2eb67d" },
  pending:      { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b" },
  forming:      { bg: "rgba(100,116,139,0.15)", text: "#94a3b8" },
  collecting:   { bg: "rgba(100,116,139,0.15)", text: "#94a3b8" },
  offline:      { bg: "rgba(100,116,139,0.15)", text: "#94a3b8" },
  failed:       { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  skipped:      { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  expired:      { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  cancelled:    { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  refunded:     { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  awaiting_otp: { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6" },
  measuring:    { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6" },
};

function AlertCard({
  theme, alert, actionLoading, onReassign,
}: {
  theme: TankupTheme; alert: any; actionLoading: boolean; onReassign: (id: number) => void;
}) {
  const sev = SEVERITY_COLORS[alert.severity?.toLowerCase()] ?? SEVERITY_COLORS.low;
  const canReassign = ["loading_timeout", "offer_expiry_repeated_failure"].includes(alert.alert_type);

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: sev.text + "50",
        borderRadius: 14,
        padding: 14,
        gap: 8,
      }}
    >
      <Row>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <AlertTriangle color={sev.text} size={14} />
          <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 13 }}>
            {alert.alert_type?.replace(/_/g, " ")}
          </Text>
        </View>
        <View style={{ backgroundColor: sev.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: sev.text, fontSize: 11, fontWeight: "600", textTransform: "capitalize" }}>
            {alert.severity}
          </Text>
        </View>
      </Row>
      <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>{alert.message}</Text>
      <Row>
        <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
          {alert.job_type} #{alert.job_id}
          {alert.tanker_id ? ` • Tanker #${alert.tanker_id}` : ""}
        </Text>
        {canReassign && (
          <Pressable
            onPress={() => onReassign(alert.id)}
            disabled={actionLoading}
            style={{
              backgroundColor: theme.primarySoft,
              borderWidth: 1,
              borderColor: theme.primary,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 5,
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: "600" }}>Reassign</Text>
          </Pressable>
        )}
      </Row>
      <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>{fmtDate(alert.created_at)}</Text>
    </View>
  );
}

function StatCard({
  theme, label, value, color, soft,
}: {
  theme: TankupTheme; label: string; value: number; color: string; soft: string;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 14,
        padding: 14,
        flex: 1,
        minWidth: "45%",
      }}
    >
      <Text
        style={{
          color: theme.mutedForeground,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text style={{ color, fontSize: 26, fontWeight: "800", marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status, theme }: { status: string; theme: TankupTheme }) {
  const c = STATUS_COLORS[status?.toLowerCase()] ?? { bg: theme.muted, text: theme.mutedForeground };
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: "600", textTransform: "capitalize" }}>
        {status?.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

function SectionHeader({
  theme, title, subtitle,
}: {
  theme: TankupTheme; title: string; subtitle?: string;
}) {
  return (
    <View style={{ marginTop: 8, marginBottom: 2 }}>
      <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 15 }}>{title}</Text>
      {subtitle && (
        <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>{subtitle}</Text>
      )}
    </View>
  );
}

function SearchInput({
  theme, placeholder, value, onChange, style,
}: {
  theme: TankupTheme; placeholder: string; value: string;
  onChange: (v: string) => void; style?: object;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.mutedForeground}
      style={[
        {
          backgroundColor: theme.input,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          color: theme.foreground,
          fontSize: 12,
        },
        style,
      ]}
    />
  );
}

function EmptyState({ theme, message }: { theme: TankupTheme; message: string }) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 14,
        padding: 20,
        alignItems: "center",
      }}
    >
      <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

function BreakdownCard({
  theme, title, data,
}: {
  theme: TankupTheme; title: string; data: Record<string, unknown>;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 14,
        padding: 14,
        gap: 4,
      }}
    >
      <Text
        style={{
          color: theme.mutedForeground,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      {Object.entries(data).map(([status, count]) => (
        <View
          key={status}
          style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}
        >
          <Text
            style={{
              color: theme.mutedForeground,
              textTransform: "capitalize",
              fontSize: 12,
            }}
          >
            {status.replace(/_/g, " ")}
          </Text>
          <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 12 }}>
            {String(count)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ActionBtn({
  theme, label, color, soft, onPress, disabled,
}: {
  theme: TankupTheme; label: string; color: string; soft: string;
  onPress: () => void; disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: soft,
        borderWidth: 1,
        borderColor: color,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function ECard({
  theme, title, children,
}: {
  theme: TankupTheme; title: string; children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 14,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Zap color={theme.warning} size={14} />
        <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 13 }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function NumInput({
  theme, placeholder, value, onChange,
}: {
  theme: TankupTheme; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.mutedForeground}
      keyboardType="numeric"
      style={{
        backgroundColor: theme.input,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: theme.foreground,
        fontSize: 13,
      }}
    />
  );
}

function EBtn({
  theme, label, color, disabled, onPress,
}: {
  theme: TankupTheme; label: string; color: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: color,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      {children}
    </View>
  );
}

function card(theme: TankupTheme) {
  return {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  };
}
