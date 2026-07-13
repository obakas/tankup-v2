import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronUp,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  clearFleetHeadToken,
  fleetForgiveDriver,
  fleetPunishDriver,
  forceOfferToTanker,
  getFleetHeadFinancials,
  getFleetHeadLive,
  getFleetHeadOverview,
  getFleetHeadPendingRequests,
  getFleetHeadTankers,
  getFleetHeadToken,
  loginFleetHead,
  registerTanker,
  setFleetHeadToken,
  type BatchCard,
  type DeliveryCard,
  type FinancialSummary,
  type LiveData,
  type OverviewData,
  type PendingRequestItem,
  type TankerCard,
} from "@/lib/fleetHeadApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FleetHeadFinancialsTab } from "@/components/FleetHeadFinancialsTab";
import { parseApiDate, formatNigeriaTime } from "@/lib/datetime";

const POLL_MS = 15_000;
type Tab = "live" | "tankers" | "overview" | "financials";

interface FleetHeadViewProps {
  onBack: () => void;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "bg-success/15 text-success",
    delivering: "bg-primary/15 text-primary",
    loading: "bg-warning/15 text-warning",
    assigned: "bg-blue-500/15 text-blue-500",
    arrived: "bg-violet-500/15 text-violet-500",
    completed: "bg-success/15 text-success",
    forming: "bg-border text-muted-foreground",
    near_ready: "bg-warning/15 text-warning",
    ready_for_assignment: "bg-primary/15 text-primary",
    expired: "bg-border text-muted-foreground",
    failed: "bg-destructive/15 text-destructive",
    offline: "bg-border text-muted-foreground",
    inactive: "bg-border text-muted-foreground",
    pending: "bg-warning/15 text-warning",
    searching_driver: "bg-warning/15 text-warning",
  };
  const cls = map[status] ?? "bg-border text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────

function FleetHeadLoginScreen({
  onLogin,
  onBack,
}: {
  onLogin: (token: string) => void;
  onBack: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError("Username and password required"); return; }
    setLoading(true);
    setError(null);
    try {
      const token = await loginFleetHead(username, password);
      onLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold text-foreground">Fleet Dashboard</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">Fleet Head Login</h1>
              <p className="text-sm text-muted-foreground mt-1">Sign in to manage your fleet</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white hover:bg-violet-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Live tab ──────────────────────────────────────────────────────────────────

function LiveTab({
  live,
  pendingRequests,
  onAssignDriver,
}: {
  live: LiveData | null;
  pendingRequests: PendingRequestItem[];
  onAssignDriver: (req: PendingRequestItem) => void;
}) {
  if (!live) {
    return <EmptyCard message="No live data available. Refresh to try again." />;
  }

  const { batches, tankers, deliveries, priority_requests } = live;
  const activeTankers = tankers.filter((t) => t.status !== "available" && t.status !== "inactive");

  return (
    <div className="space-y-5">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat
          label="Online"
          value={tankers.filter((t) => t.is_online).length}
          icon={<Truck className="h-4 w-4" />}
          color="text-primary"
        />
        <MiniStat
          label="Active Jobs"
          value={activeTankers.length}
          icon={<Activity className="h-4 w-4" />}
          color="text-violet-500"
        />
        <MiniStat
          label="Deliveries"
          value={deliveries.length}
          icon={<Package className="h-4 w-4" />}
          color="text-success"
        />
      </div>

      {/* Pending queue — requests waiting to be dispatched to a driver */}
      {pendingRequests.length > 0 && (
        <Section title="Waiting for Driver" count={pendingRequests.length}>
          {pendingRequests.map((r) => {
            const d = r.created_at ? parseApiDate(r.created_at) : null;
            const timeStr = d ? d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
            return (
              <div key={r.id} className="bg-card rounded-2xl border border-amber-500/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">Request #{r.id}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.volume_liters.toLocaleString()}L · {timeStr}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={r.status} />
                    <button
                      onClick={() => onAssignDriver(r)}
                      className="bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                    >
                      Assign Driver
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* Active tankers */}
      <Section title="Active Tankers" count={activeTankers.length}>
        {activeTankers.length === 0 ? (
          <EmptyCard message="No tankers currently active." />
        ) : (
          activeTankers.map((t) => {
            const isPunished = !!t.paused_until && new Date(t.paused_until) > new Date();
            return (
              <div key={t.id} className={`bg-card rounded-2xl border p-4 ${isPunished ? "border-destructive" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{t.driver_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.phone} · {t.tank_plate_number}</p>
                    {(t.active_batch_id || t.current_request_id) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.active_batch_id ? `Batch #${t.active_batch_id}` : `Request #${t.current_request_id}`}
                      </p>
                    )}
                    {isPunished && (
                      <p className="text-xs font-medium text-destructive mt-1">⛔ Suspended until {formatNigeriaTime(t.paused_until)}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge status={t.status} />
                    <span className={`text-xs font-medium ${t.is_online ? "text-success" : "text-muted-foreground"}`}>
                      {t.is_online ? "● Online" : "○ Offline"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Section>

      {/* Active batches */}
      {batches.length > 0 && (
        <Section title="Active Batches" count={batches.length}>
          {batches.map((b) => (
            <BatchRow key={b.id} batch={b} />
          ))}
        </Section>
      )}

      {/* Active priority requests */}
      {priority_requests.length > 0 && (
        <Section title="Priority Requests" count={priority_requests.length}>
          {priority_requests.map((r) => (
            <div key={r.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">Request #{r.id}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(r.volume_liters ?? 0).toLocaleString()}L
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </Section>
      )}

      {/* Active deliveries */}
      {deliveries.length > 0 && (
        <Section title="Active Deliveries" count={deliveries.length}>
          {deliveries.map((d) => (
            <DeliveryRow key={d.id} delivery={d} />
          ))}
        </Section>
      )}

      {batches.length === 0 && deliveries.length === 0 && priority_requests.length === 0 && activeTankers.length === 0 && pendingRequests.length === 0 && (
        <EmptyCard message="No active jobs right now. Everything is quiet." />
      )}
    </div>
  );
}

function BatchRow({ batch }: { batch: BatchCard }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">Batch #{batch.id}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {batch.member_count} members · {(batch.current_volume ?? 0).toLocaleString()}L
          </p>
          {batch.deliveries_total > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Delivered: {batch.deliveries_completed}/{batch.deliveries_total}
            </p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <StatusBadge status={batch.status} />
          {batch.fill_percent > 0 && (
            <span className="text-xs text-muted-foreground">{batch.fill_percent}% full</span>
          )}
        </div>
      </div>
      {batch.fill_percent > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${Math.min(batch.fill_percent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: DeliveryCard }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">
          Delivery #{delivery.id}
          {delivery.stop_order != null && (
            <span className="text-muted-foreground font-normal"> · Stop {delivery.stop_order + 1}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {delivery.job_type === "batch" ? `Batch #${delivery.batch_id}` : `Request #${delivery.request_id}`}
          {delivery.user_name && ` · ${delivery.user_name}`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {delivery.planned_liters.toLocaleString()}L planned
          {delivery.otp_verified && (
            <span className="ml-2 inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3 w-3" /> OTP verified
            </span>
          )}
        </p>
      </div>
      <StatusBadge status={delivery.delivery_status} />
    </div>
  );
}

// ── Tankers tab ───────────────────────────────────────────────────────────────

function TankersTab({
  tankers,
  onTankerAdded,
}: {
  tankers: TankerCard[];
  onTankerAdded: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ driver_name: "", phone: "", tank_plate_number: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [forgiveLoadingId, setForgiveLoadingId] = useState<number | null>(null);
  const [punishLoadingId, setPunishLoadingId] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: number; ok: boolean; msg: string } | null>(null);
  const [punishHours, setPunishHours] = useState<Record<number, 2 | 24 | 48>>({});

  const handleForgive = async (tankerId: number) => {
    setForgiveLoadingId(tankerId);
    setActionFeedback(null);
    try {
      await fleetForgiveDriver(tankerId);
      setActionFeedback({ id: tankerId, ok: true, msg: "Punishment cleared." });
      onTankerAdded();
    } catch {
      setActionFeedback({ id: tankerId, ok: false, msg: "Failed — try again." });
    } finally {
      setForgiveLoadingId(null);
    }
  };

  const handlePunish = async (tankerId: number) => {
    const hours = punishHours[tankerId] ?? 2;
    setPunishLoadingId(tankerId);
    setActionFeedback(null);
    try {
      await fleetPunishDriver(tankerId, hours);
      setActionFeedback({ id: tankerId, ok: true, msg: `Punished for ${hours}h.` });
      onTankerAdded();
    } catch {
      setActionFeedback({ id: tankerId, ok: false, msg: "Failed — try again." });
    } finally {
      setPunishLoadingId(null);
    }
  };

  const statusOptions = ["all", "available", "assigned", "queued", "loading", "delivering", "arrived", "offline", "inactive"];

  const filtered = filter === "all" ? tankers : tankers.filter((t) => t.status === filter);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.driver_name || !formData.phone || !formData.tank_plate_number) {
      setFormError("All fields are required");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await registerTanker(formData);
      setFormData({ driver_name: "", phone: "", tank_plate_number: "" });
      setFormSuccess(true);
      setShowForm(false);
      onTankerAdded();
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to register tanker");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2 pb-1">
            {statusOptions.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                  filter === s
                    ? "bg-violet-500 text-white"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 transition"
        >
          {showForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Register"}
        </button>
      </div>

      {formSuccess && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-3">
          <p className="text-success text-sm font-medium">Tanker registered successfully.</p>
        </div>
      )}

      {/* Register form */}
      {showForm && (
        <form onSubmit={handleRegister} className="bg-card border border-violet-500/30 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">Register New Tanker</p>

          {formError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
              <p className="text-destructive text-sm">{formError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Driver Name</label>
              <input
                type="text"
                value={formData.driver_name}
                onChange={(e) => setFormData((p) => ({ ...p, driver_name: e.target.value }))}
                placeholder="Full name"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="08012345678"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Plate Number</label>
              <input
                type="text"
                value={formData.tank_plate_number}
                onChange={(e) => setFormData((p) => ({ ...p, tank_plate_number: e.target.value.toUpperCase() }))}
                placeholder="ABC-123-XY"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-violet-500 py-2.5 text-sm font-semibold text-white hover:bg-violet-600 transition disabled:opacity-60"
          >
            {submitting ? "Registering..." : "Register Tanker"}
          </button>
        </form>
      )}

      {/* Tanker list */}
      {filtered.length === 0 ? (
        <EmptyCard message={filter === "all" ? "No tankers registered yet." : `No tankers with status "${filter}".`} />
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const isPunished = !!t.paused_until && new Date(t.paused_until) > new Date();
            const isForgiving = forgiveLoadingId === t.id;
            const isPunishing = punishLoadingId === t.id;
            const feedback = actionFeedback?.id === t.id ? actionFeedback : null;
            return (
              <div key={t.id} className={`bg-card rounded-2xl border p-4 ${isPunished ? "border-destructive" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{t.driver_name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{t.phone}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Plate: {t.tank_plate_number}</p>
                    {(t.active_batch_id || t.current_request_id) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.active_batch_id
                          ? `Active batch: #${t.active_batch_id}`
                          : `Active request: #${t.current_request_id}`}
                      </p>
                    )}
                    {t.pending_offer_type && (
                      <p className="text-xs text-warning mt-1">
                        Awaiting driver response ({t.pending_offer_type})
                      </p>
                    )}
                    {isPunished && (
                      <p className="text-xs text-destructive mt-1 font-medium">⛔ Suspended until {formatNigeriaTime(t.paused_until)}</p>
                    )}
                    {feedback && (
                      <p className={`text-xs mt-1 font-medium ${feedback.ok ? "text-success" : "text-destructive"}`}>
                        {feedback.msg}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge status={t.status} />
                    <span className={`text-xs font-medium ${t.is_online ? "text-success" : "text-muted-foreground"}`}>
                      {t.is_online ? "● Online" : "○ Offline"}
                    </span>
                    <span className={`text-xs ${t.is_available ? "text-primary" : "text-muted-foreground"}`}>
                      {t.is_available ? "Available" : "Busy"}
                    </span>
                    {isPunished ? (
                      <button
                        disabled={isForgiving}
                        onClick={() => handleForgive(t.id)}
                        className="mt-1 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition disabled:opacity-50"
                      >
                        {isForgiving ? "Forgiving…" : "Forgive"}
                      </button>
                    ) : (
                      <div className="mt-1 flex items-center gap-1">
                        <select
                          value={punishHours[t.id] ?? 2}
                          onChange={(e) => setPunishHours((p) => ({ ...p, [t.id]: Number(e.target.value) as 2 | 24 | 48 }))}
                          className="rounded-lg border border-border bg-card px-1.5 py-1 text-xs text-muted-foreground focus:outline-none"
                        >
                          <option value={2}>2h</option>
                          <option value={24}>24h</option>
                          <option value={48}>48h</option>
                        </select>
                        <button
                          disabled={isPunishing}
                          onClick={() => handlePunish(t.id)}
                          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition disabled:opacity-50"
                        >
                          {isPunishing ? "…" : "Punish"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: OverviewData | null }) {
  if (!overview) {
    return <EmptyCard message="No overview data available. Refresh to try again." />;
  }

  const t = overview.totals ?? {};
  const sb = overview.status_breakdown ?? {};

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Last updated: {new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", timeStyle: "short", hour12: true }).format(parseApiDate(overview.generated_at) ?? new Date())}
      </p>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Online Tankers" value={t.online_tankers ?? 0} color="text-primary" />
        <StatCard label="Available" value={t.available_tankers ?? 0} color="text-success" />
        <StatCard label="Active Batches" value={t.active_batches ?? 0} color="text-violet-500" />
        <StatCard label="Active Deliveries" value={t.active_deliveries ?? 0} color="text-warning" />
        <StatCard label="Priority Jobs" value={t.active_priority_requests ?? 0} color="text-primary" />
        <StatCard label="Total Tankers" value={t.tankers ?? 0} color="text-foreground" />
      </div>

      {/* Tanker status breakdown */}
      {sb.tankers && Object.keys(sb.tankers).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tanker Status</p>
          <div className="space-y-2">
            {Object.entries(sb.tankers).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>
                <span className="text-sm font-semibold text-foreground">{String(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch status breakdown */}
      {sb.batches && Object.keys(sb.batches).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Batch Status</p>
          <div className="space-y-2">
            {Object.entries(sb.batches).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>
                <span className="text-sm font-semibold text-foreground">{String(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery status breakdown */}
      {sb.deliveries && Object.keys(sb.deliveries).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Delivery Status</p>
          <div className="space-y-2">
            {Object.entries(sb.deliveries).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>
                <span className="text-sm font-semibold text-foreground">{String(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
      <div className={`${color}`}>{icon}</div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function FleetHeadView({ onBack }: FleetHeadViewProps) {
  const [token, setToken] = useState<string | null>(() => getFleetHeadToken() || null);
  const [tab, setTab] = useState<Tab>("live");
  const [live, setLive] = useState<LiveData | null>(null);
  const [tankers, setTankers] = useState<TankerCard[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [financials, setFinancials] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequestItem[]>([]);
  const [assignModalRequest, setAssignModalRequest] = useState<PendingRequestItem | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [liveData, tankersData, overviewData, financialsData, pendingData] = await Promise.all([
        getFleetHeadLive(),
        getFleetHeadTankers(),
        getFleetHeadOverview(),
        getFleetHeadFinancials(),
        getFleetHeadPendingRequests(),
      ]);
      setLive(liveData);
      setTankers(tankersData.items ?? []);
      setOverview(overviewData);
      setFinancials(financialsData);
      setPendingRequests(pendingData.items ?? []);
      setLastUpdated(new Date());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load fleet data";
      setError(message);
      if (message.includes("401") || message.includes("403")) {
        handleLogout();
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchAll();
    pollRef.current = setInterval(() => fetchAll(true), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token, fetchAll]);

  const handleLogin = (tok: string) => {
    setFleetHeadToken(tok);
    setToken(tok);
  };

  const handleLogout = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    clearFleetHeadToken();
    setToken(null);
    setLive(null);
    setTankers([]);
    setOverview(null);
    setFinancials(null);
    onBack();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll(true);
    setRefreshing(false);
  };

  const handleForceOffer = async (requestId: number, tanker: TankerCard) => {
    setOfferLoading(true);
    try {
      const result = await forceOfferToTanker(requestId, tanker.id);
      toast.success(result.message);
      setAssignModalRequest(null);
      fetchAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send offer");
    } finally {
      setOfferLoading(false);
    }
  };

  if (!token) {
    return <FleetHeadLoginScreen onLogin={handleLogin} onBack={onBack} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-muted transition text-foreground"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Users className="h-4 w-4 text-violet-500" />
              </div>
              <span className="font-bold text-foreground">Fleet Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", timeStyle: "short", hour12: true }).format(lastUpdated)}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-border">
          {(["live", "tankers", "overview", "financials"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition border-b-2 ${
                tab === t
                  ? "border-violet-500 text-violet-500"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full max-w-2xl p-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
          </div>
        ) : (
          <>
            {tab === "live" && (
              <LiveTab
                live={live}
                pendingRequests={pendingRequests}
                onAssignDriver={setAssignModalRequest}
              />
            )}
            {tab === "tankers" && (
              <TankersTab tankers={tankers} onTankerAdded={() => fetchAll(true)} />
            )}
            {tab === "overview" && <OverviewTab overview={overview} />}
            {tab === "financials" && <FleetHeadFinancialsTab data={financials} />}
          </>
        )}
      </main>

      {/* Assign Driver Dialog */}
      <Dialog open={assignModalRequest !== null} onOpenChange={(open) => !open && setAssignModalRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Driver</DialogTitle>
          </DialogHeader>

          {assignModalRequest && (
            <div className="bg-muted rounded-xl p-3 space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                Request #{assignModalRequest.id} · {assignModalRequest.volume_liters.toLocaleString()}L
              </p>
              <StatusBadge status={assignModalRequest.status} />
            </div>
          )}

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Available Drivers</p>

          {(() => {
            const available = tankers.filter((t) => t.status === "available" && !t.pending_offer_type);
            return available.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available drivers right now. Check the Tankers tab or wait for one to become free.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2">
                {available.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 bg-background border border-border rounded-xl p-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm">{t.driver_name}</p>
                      <p className="text-xs text-muted-foreground">{t.phone}</p>
                    </div>
                    <button
                      onClick={() => assignModalRequest && handleForceOffer(assignModalRequest.id, t)}
                      disabled={offerLoading}
                      className="bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition min-w-[64px] flex items-center justify-center"
                    >
                      {offerLoading ? (
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        "Assign"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
