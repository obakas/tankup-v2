import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronUp,
  LogOut,
  Moon,
  Package,
  Plus,
  RefreshCw,
  Sun,
  Truck,
  Users,
} from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppStatePause } from "@/hooks/useAppStatePause";
import { type TankupTheme } from "@/components/ui/theme";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { useToast } from "@/hooks/useToast";
import {
  clearFleetHeadToken,
  getFleetHeadLive,
  getFleetHeadOverview,
  getFleetHeadTankers,
  getFleetHeadToken,
  loginFleetHead,
  registerTanker,
  setFleetHeadToken,
  type BatchCard,
  type DeliveryCard,
  type LiveData,
  type OverviewData,
  type TankerCard,
} from "@/lib/fleetHeadApi";

const ROLE_KEY = "tankup_active_role";
const POLL_MS = 15_000;
const VIOLET = "#8b5cf6";
const VIOLET_SOFT = "rgba(139,92,246,0.12)";

type Tab = "live" | "tankers" | "overview";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { bg: string; text: string }> = {
  available:             { bg: "rgba(46,182,125,0.15)",  text: "#2eb67d" },
  delivering:            { bg: "rgba(0,132,255,0.15)",   text: "#0084ff" },
  loading:               { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b" },
  assigned:              { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6" },
  arrived:               { bg: VIOLET_SOFT,              text: VIOLET    },
  completed:             { bg: "rgba(46,182,125,0.15)",  text: "#2eb67d" },
  forming:               { bg: "rgba(100,116,139,0.15)", text: "#64748b" },
  near_ready:            { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b" },
  ready_for_assignment:  { bg: "rgba(0,132,255,0.15)",   text: "#0084ff" },
  expired:               { bg: "rgba(100,116,139,0.15)", text: "#64748b" },
  failed:                { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  offline:               { bg: "rgba(100,116,139,0.15)", text: "#64748b" },
  inactive:              { bg: "rgba(100,116,139,0.15)", text: "#64748b" },
  pending:               { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_MAP[status] ?? { bg: "rgba(100,116,139,0.15)", text: "#64748b" };
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: "600", textTransform: "capitalize" }}>
        {status.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function EmptyCard({ message, theme }: { message: string; theme: TankupTheme }) {
  return (
    <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center" }}>
      <Text style={{ color: theme.mutedForeground, fontSize: 14, textAlign: "center" }}>{message}</Text>
    </View>
  );
}

function Section({
  title,
  count,
  children,
  theme,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  theme: TankupTheme;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>{title}</Text>
        <View style={{ backgroundColor: theme.muted, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: "500" }}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function MiniStat({
  label,
  value,
  icon,
  color,
  theme,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  theme: TankupTheme;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 }}>
      {icon}
      <Text style={{ color, fontSize: 22, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: TankupTheme;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16 }}>
      <Text style={{ color: theme.mutedForeground, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color, fontSize: 24, fontWeight: "700", marginTop: 4 }}>{value}</Text>
    </View>
  );
}

// ── Live tab ──────────────────────────────────────────────────────────────────

function TankerActiveCard({ tanker, theme }: { tanker: TankerCard; theme: TankupTheme }) {
  return (
    <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>
            {tanker.driver_name}
          </Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
            {tanker.phone} · {tanker.tank_plate_number}
          </Text>
          {(tanker.active_batch_id || tanker.current_request_id) && (
            <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 4 }}>
              {tanker.active_batch_id ? `Batch #${tanker.active_batch_id}` : `Request #${tanker.current_request_id}`}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <StatusBadge status={tanker.status} />
          <Text style={{ color: tanker.is_online ? theme.success : theme.mutedForeground, fontSize: 11, fontWeight: "500" }}>
            {tanker.is_online ? "● Online" : "○ Offline"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function BatchRowCard({ batch, theme }: { batch: BatchCard; theme: TankupTheme }) {
  return (
    <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>Batch #{batch.id}</Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
            {batch.member_count} members · {(batch.current_volume ?? 0).toLocaleString()}L
          </Text>
          {batch.deliveries_total > 0 && (
            <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
              Delivered: {batch.deliveries_completed}/{batch.deliveries_total}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <StatusBadge status={batch.status} />
          {batch.fill_percent > 0 && (
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>{batch.fill_percent}% full</Text>
          )}
        </View>
      </View>
      {batch.fill_percent > 0 && (
        <View style={{ marginTop: 10, height: 4, backgroundColor: theme.muted, borderRadius: 99, overflow: "hidden" }}>
          <View
            style={{ width: `${Math.min(batch.fill_percent, 100)}%`, height: "100%", backgroundColor: VIOLET, borderRadius: 99 }}
          />
        </View>
      )}
    </View>
  );
}

function DeliveryRowCard({ delivery, theme }: { delivery: DeliveryCard; theme: TankupTheme }) {
  return (
    <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
          {"Delivery #" + delivery.id + (delivery.stop_order != null ? " · Stop " + (delivery.stop_order + 1) : "")}
        </Text>
        <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
          {delivery.job_type === "batch" ? `Batch #${delivery.batch_id}` : `Request #${delivery.request_id}`}
          {delivery.user_name ? ` · ${delivery.user_name}` : ""}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
            {delivery.planned_liters.toLocaleString()}L planned
          </Text>
          {delivery.otp_verified && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <CheckCircle2 color={theme.success} size={11} />
              <Text style={{ color: theme.success, fontSize: 11 }}>OTP verified</Text>
            </View>
          )}
        </View>
      </View>
      <StatusBadge status={delivery.delivery_status} />
    </View>
  );
}

function LiveTab({ live, theme }: { live: LiveData | null; theme: TankupTheme }) {
  if (!live) {
    return <EmptyCard message="No live data available. Refresh to try again." theme={theme} />;
  }

  const { batches, tankers, deliveries, priority_requests } = live;
  const activeTankers = tankers.filter((t) => t.status !== "available" && t.status !== "inactive");

  return (
    <View style={{ gap: 20 }}>
      {/* Quick stats */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MiniStat
          label="Online"
          value={tankers.filter((t) => t.is_online).length}
          icon={<Truck color={theme.primary} size={16} />}
          color={theme.primary}
          theme={theme}
        />
        <MiniStat
          label="Active Jobs"
          value={activeTankers.length}
          icon={<Activity color={VIOLET} size={16} />}
          color={VIOLET}
          theme={theme}
        />
        <MiniStat
          label="Deliveries"
          value={deliveries.length}
          icon={<Package color={theme.success} size={16} />}
          color={theme.success}
          theme={theme}
        />
      </View>

      {/* Active tankers */}
      <Section title="Active Tankers" count={activeTankers.length} theme={theme}>
        {activeTankers.length === 0 ? (
          <EmptyCard message="No tankers currently active." theme={theme} />
        ) : (
          <View style={{ gap: 10 }}>
            {activeTankers.map((t) => (
              <TankerActiveCard key={t.id} tanker={t} theme={theme} />
            ))}
          </View>
        )}
      </Section>

      {/* Active batches */}
      {batches.length > 0 && (
        <Section title="Active Batches" count={batches.length} theme={theme}>
          <View style={{ gap: 10 }}>
            {batches.map((b) => (
              <BatchRowCard key={b.id} batch={b} theme={theme} />
            ))}
          </View>
        </Section>
      )}

      {/* Priority requests */}
      {priority_requests.length > 0 && (
        <Section title="Priority Requests" count={priority_requests.length} theme={theme}>
          <View style={{ gap: 10 }}>
            {priority_requests.map((r: any) => (
              <View
                key={r.id}
                style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View>
                  <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>Request #{r.id}</Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    {(r.volume_liters ?? 0).toLocaleString()}L
                  </Text>
                </View>
                <StatusBadge status={r.status} />
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* Active deliveries */}
      {deliveries.length > 0 && (
        <Section title="Active Deliveries" count={deliveries.length} theme={theme}>
          <View style={{ gap: 10 }}>
            {deliveries.map((d) => (
              <DeliveryRowCard key={d.id} delivery={d} theme={theme} />
            ))}
          </View>
        </Section>
      )}

      {batches.length === 0 && deliveries.length === 0 && priority_requests.length === 0 && activeTankers.length === 0 && (
        <EmptyCard message="No active jobs right now. Everything is quiet." theme={theme} />
      )}
    </View>
  );
}

// ── Tankers tab ───────────────────────────────────────────────────────────────

function TankersTab({
  tankers,
  theme,
  onTankerAdded,
  showToast,
}: {
  tankers: TankerCard[];
  theme: TankupTheme;
  onTankerAdded: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ driver_name: "", phone: "", tank_plate_number: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const statusOptions = ["all", "available", "assigned", "loading", "delivering", "arrived", "offline", "inactive"];
  const filtered = filter === "all" ? tankers : tankers.filter((t) => t.status === filter);

  const handleRegister = async () => {
    if (!formData.driver_name || !formData.phone || !formData.tank_plate_number) {
      setFormError("All fields are required");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await registerTanker(formData);
      setFormData({ driver_name: "", phone: "", tank_plate_number: "" });
      setShowForm(false);
      onTankerAdded();
      showToast("Tanker registered successfully");
    } catch (err: any) {
      setFormError(err.message);
      showToast(err.message, false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Controls */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 2 }}>
            {statusOptions.map((s) => (
              <Pressable
                key={s}
                onPress={() => setFilter(s)}
                style={{
                  backgroundColor: filter === s ? VIOLET : theme.card,
                  borderColor: filter === s ? VIOLET : theme.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
              >
                <Text
                  style={{
                    color: filter === s ? "#fff" : theme.mutedForeground,
                    fontSize: 12,
                    fontWeight: "500",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Pressable
          onPress={() => setShowForm((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: VIOLET, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}
        >
          {showForm ? <ChevronUp color="#fff" size={15} /> : <Plus color="#fff" size={15} />}
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
            {showForm ? "Cancel" : "Register"}
          </Text>
        </Pressable>
      </View>

      {/* Register form */}
      {showForm && (
        <View style={{ backgroundColor: theme.card, borderColor: VIOLET, borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 }}>
          <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 14 }}>Register New Tanker</Text>

          {formError && (
            <View style={{ backgroundColor: theme.destructiveSoft, borderColor: theme.destructive, borderWidth: 1, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: theme.destructive, fontSize: 13 }}>{formError}</Text>
            </View>
          )}

          {[
            { label: "Driver Name", key: "driver_name", placeholder: "Full name", keyboard: "default" as const, capitalize: "words" as const },
            { label: "Phone", key: "phone", placeholder: "08012345678", keyboard: "phone-pad" as const, capitalize: "none" as const },
            { label: "Plate Number", key: "tank_plate_number", placeholder: "ABC-123-XY", keyboard: "default" as const, capitalize: "characters" as const },
          ].map(({ label, key, placeholder, keyboard, capitalize }) => (
            <View key={key}>
              <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: "500", marginBottom: 6 }}>{label}</Text>
              <TextInput
                value={formData[key as keyof typeof formData]}
                onChangeText={(v) =>
                  setFormData((p) => ({ ...p, [key]: key === "tank_plate_number" ? v.toUpperCase() : v }))
                }
                placeholder={placeholder}
                placeholderTextColor={theme.mutedForeground}
                keyboardType={keyboard}
                autoCapitalize={capitalize}
                style={{
                  backgroundColor: theme.input,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  color: theme.foreground,
                  fontSize: 14,
                }}
              />
            </View>
          ))}

          <Pressable
            onPress={handleRegister}
            disabled={submitting}
            style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 13, alignItems: "center", opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Register Tanker</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Tanker list */}
      {filtered.length === 0 ? (
        <EmptyCard
          message={filter === "all" ? "No tankers registered yet." : `No tankers with status "${filter}".`}
          theme={theme}
        />
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((t) => (
            <View key={t.id} style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.foreground, fontWeight: "600", fontSize: 15 }}>{t.driver_name}</Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 13, marginTop: 2 }}>{t.phone}</Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>Plate: {t.tank_plate_number}</Text>
                  {(t.active_batch_id || t.current_request_id) && (
                    <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 4 }}>
                      {t.active_batch_id ? `Active batch: #${t.active_batch_id}` : `Active request: #${t.current_request_id}`}
                    </Text>
                  )}
                  {t.pending_offer_type && (
                    <Text style={{ color: theme.warning, fontSize: 12, marginTop: 4 }}>
                      Pending {t.pending_offer_type} offer
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <StatusBadge status={t.status} />
                  <Text style={{ color: t.is_online ? theme.success : theme.mutedForeground, fontSize: 11, fontWeight: "500" }}>
                    {t.is_online ? "● Online" : "○ Offline"}
                  </Text>
                  <Text style={{ color: t.is_available ? theme.primary : theme.mutedForeground, fontSize: 11 }}>
                    {t.is_available ? "Available" : "Busy"}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ overview, theme }: { overview: OverviewData | null; theme: TankupTheme }) {
  if (!overview) {
    return <EmptyCard message="No overview data available. Refresh to try again." theme={theme} />;
  }

  const t = overview.totals ?? {};
  const sb = overview.status_breakdown ?? {};

  const breakdowns = [
    { label: "Tanker Status", data: sb.tankers },
    { label: "Batch Status", data: sb.batches },
    { label: "Delivery Status", data: sb.deliveries },
  ];

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
        Last updated: {new Date(overview.generated_at).toLocaleTimeString()}
      </Text>

      {/* Key metrics — 2-col grid */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Online Tankers" value={t.online_tankers ?? 0} color={theme.primary} theme={theme} />
          <StatCard label="Available" value={t.available_tankers ?? 0} color={theme.success} theme={theme} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Active Batches" value={t.active_batches ?? 0} color={VIOLET} theme={theme} />
          <StatCard label="Active Deliveries" value={t.active_deliveries ?? 0} color={theme.warning} theme={theme} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Priority Jobs" value={t.active_priority_requests ?? 0} color={theme.primary} theme={theme} />
          <StatCard label="Total Tankers" value={t.tankers ?? 0} color={theme.foreground} theme={theme} />
        </View>
      </View>

      {/* Status breakdowns */}
      {breakdowns.map(({ label, data }) =>
        data && Object.keys(data).length > 0 ? (
          <View
            key={label}
            style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }}
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>
              {label}
            </Text>
            {Object.entries(data).map(([status, count]) => (
              <View key={status} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: theme.mutedForeground, fontSize: 13, textTransform: "capitalize" }}>
                  {status.replace(/_/g, " ")}
                </Text>
                <Text style={{ color: theme.foreground, fontSize: 13, fontWeight: "600" }}>{String(count)}</Text>
              </View>
            ))}
          </View>
        ) : null
      )}
    </View>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({
  theme,
  isDark,
  onToggleTheme,
  onLogin,
  onBack,
}: {
  theme: TankupTheme;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogin: (token: string) => void;
  onBack: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!username || !password) { setError("Username and password required"); return; }
    setLoading(true);
    setError(null);
    try {
      const token = await loginFleetHead(username, password);
      onLogin(token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={onBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={{ padding: 8, borderRadius: 10 }}
          >
            <ArrowLeft color={theme.foreground} size={20} />
          </Pressable>
          <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 16, marginLeft: 8 }}>Fleet Dashboard</Text>
        </View>
        <Pressable
          onPress={onToggleTheme}
          accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
          accessibilityRole="button"
          style={{ padding: 9, borderRadius: 10 }}
        >
          {isDark ? <Sun color={theme.mutedForeground} size={18} /> : <Moon color={theme.mutedForeground} size={18} />}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 360, alignSelf: "center", gap: 24 }}>

            <View style={{ alignItems: "center", gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: VIOLET_SOFT, alignItems: "center", justifyContent: "center" }}>
                <Users color={VIOLET} size={32} />
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: theme.foreground, fontSize: 22, fontWeight: "800" }}>Fleet Head Login</Text>
                <Text style={{ color: theme.mutedForeground, fontSize: 13, marginTop: 4 }}>Sign in to manage your fleet</Text>
              </View>
            </View>

            <View style={{ gap: 14 }}>
              {error && (
                <View style={{ backgroundColor: theme.destructiveSoft, borderColor: theme.destructive, borderWidth: 1, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: theme.destructive, fontSize: 13 }}>{error}</Text>
                </View>
              )}

              <View>
                <Text style={{ color: theme.foreground, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Username</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor={theme.mutedForeground}
                  autoCapitalize="none"
                  autoComplete="username"
                  style={{ backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: theme.foreground, fontSize: 15 }}
                />
              </View>

              <View>
                <Text style={{ color: theme.foreground, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.mutedForeground}
                  secureTextEntry
                  autoComplete="current-password"
                  style={{ backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: theme.foreground, fontSize: 15 }}
                />
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Sign In</Text>
                )}
              </Pressable>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const TABS: Tab[] = ["live", "tankers", "overview"];

export default function FleetHeadScreen() {
  const { theme, isDark, toggleTheme } = useAppTheme();
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("live");
  const [live, setLive] = useState<LiveData | null>(null);
  const [tankers, setTankers] = useState<TankerCard[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    getFleetHeadToken().then((tok) => {
      setToken(tok);
      setHydrated(true);
    });
  }, []);

  const fetchAll = useCallback(async (currentToken: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [liveData, tankersData, overviewData] = await Promise.all([
        getFleetHeadLive(currentToken),
        getFleetHeadTankers(currentToken),
        getFleetHeadOverview(currentToken),
      ]);
      setLive(liveData);
      setTankers(tankersData.items ?? []);
      setOverview(overviewData);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message);
      if (e.message.includes("401") || e.message.includes("403")) {
        if (pollRef.current) clearInterval(pollRef.current);
        await clearFleetHeadToken();
        await AsyncStorage.removeItem(ROLE_KEY);
        setToken(null);
        router.replace("/");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchAll(token);
    pollRef.current = setInterval(() => fetchAll(token, true), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token, fetchAll]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const restartPolling = useCallback(() => {
    if (!token) return;
    stopPolling();
    fetchAll(token, true);
    pollRef.current = setInterval(() => fetchAll(token, true), POLL_MS);
  }, [token, fetchAll, stopPolling]);

  useAppStatePause(stopPolling, restartPolling);

  const handleLogin = async (tok: string) => {
    await setFleetHeadToken(tok);
    setToken(tok);
  };

  const handleLogout = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    await clearFleetHeadToken();
    await AsyncStorage.removeItem(ROLE_KEY);
    setToken(null);
    router.replace("/");
  };

  const handleBack = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    await AsyncStorage.removeItem(ROLE_KEY);
    router.replace("/");
  };

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    await fetchAll(token, true);
    setRefreshing(false);
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={VIOLET} size="large" />
      </SafeAreaView>
    );
  }

  if (!token) {
    return <LoginScreen theme={theme} isDark={isDark} onToggleTheme={toggleTheme} onLogin={handleLogin} onBack={handleBack} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ToastMessage toast={toast} theme={theme} />
      {/* Header */}
      <View style={{ backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={handleBack}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              style={{ padding: 8, borderRadius: 10 }}
            >
              <ArrowLeft color={theme.foreground} size={20} />
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: VIOLET_SOFT, alignItems: "center", justifyContent: "center" }}>
                <Users color={VIOLET} size={16} />
              </View>
              <Text style={{ color: theme.foreground, fontWeight: "700", fontSize: 16 }}>Fleet Dashboard</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              onPress={handleRefresh}
              disabled={refreshing}
              accessibilityLabel="Refresh data"
              accessibilityRole="button"
              style={{ padding: 9, borderRadius: 10, opacity: refreshing ? 0.5 : 1 }}
            >
              {refreshing ? (
                <ActivityIndicator color={theme.mutedForeground} size="small" />
              ) : (
                <RefreshCw color={theme.mutedForeground} size={18} />
              )}
            </Pressable>
            <Pressable
              onPress={toggleTheme}
              accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
              accessibilityRole="button"
              style={{ padding: 9, borderRadius: 10 }}
            >
              {isDark ? <Sun color={theme.mutedForeground} size={18} /> : <Moon color={theme.mutedForeground} size={18} />}
            </Pressable>
            <Pressable
              onPress={handleLogout}
              accessibilityLabel="Log out"
              accessibilityRole="button"
              style={{ padding: 9, borderRadius: 10 }}
            >
              <LogOut color={theme.mutedForeground} size={18} />
            </Pressable>
          </View>
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: theme.border }}>
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderBottomWidth: 2,
                borderBottomColor: tab === t ? VIOLET : "transparent",
              }}
            >
              <Text style={{ color: tab === t ? VIOLET : theme.mutedForeground, fontSize: 14, fontWeight: "500", textTransform: "capitalize" }}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={{ margin: 12, backgroundColor: theme.destructiveSoft, borderColor: theme.destructive, borderWidth: 1, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: theme.destructive, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <FleetHeadLiveSkeleton theme={theme} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={VIOLET}
              colors={[VIOLET]}
            />
          }
        >
          {tab === "live" && <LiveTab live={live} theme={theme} />}
          {tab === "tankers" && (
            <TankersTab
              tankers={tankers}
              theme={theme}
              onTankerAdded={() => token && fetchAll(token, true)}
              showToast={showToast}
            />
          )}
          {tab === "overview" && <OverviewTab overview={overview} theme={theme} />}

          {lastUpdated && (
            <Text style={{ color: theme.mutedForeground, fontSize: 11, textAlign: "center", marginTop: 20 }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Fleet-head live skeleton ───────────────────────────────────────────────────

function FleetHeadLiveSkeleton({ theme }: { theme: TankupTheme }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 20 }}
      scrollEnabled={false}
    >
      {/* Mini stats row */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 14,
              padding: 12,
              gap: 8,
            }}
          >
            <Skeleton height={10} width="60%" borderRadius={6} theme={theme} />
            <Skeleton height={22} width="45%" borderRadius={6} theme={theme} />
          </View>
        ))}
      </View>

      {/* Active Tankers section */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Skeleton height={14} width="40%" borderRadius={6} theme={theme} />
          <Skeleton height={18} width={28} borderRadius={8} theme={theme} />
        </View>
        {Array.from({ length: 3 }).map((_, i) => (
          <View
            key={i}
            style={{
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 16,
              padding: 16,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Skeleton height={14} width="45%" borderRadius={6} theme={theme} />
              <Skeleton height={22} width={70} borderRadius={8} theme={theme} />
            </View>
            <Skeleton height={10} width="35%" borderRadius={6} theme={theme} />
            <Skeleton height={10} width="60%" borderRadius={6} theme={theme} />
          </View>
        ))}
      </View>

      {/* Active Batches section */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Skeleton height={14} width="38%" borderRadius={6} theme={theme} />
          <Skeleton height={18} width={28} borderRadius={8} theme={theme} />
        </View>
        {Array.from({ length: 2 }).map((_, i) => (
          <View
            key={i}
            style={{
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 16,
              padding: 16,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Skeleton height={13} width="40%" borderRadius={6} theme={theme} />
              <Skeleton height={22} width={70} borderRadius={8} theme={theme} />
            </View>
            <Skeleton height={10} width="65%" borderRadius={6} theme={theme} />
            <Skeleton height={6} borderRadius={4} theme={theme} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
