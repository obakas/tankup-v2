import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, CircleAlert, Droplets, Eye, Moon, RefreshCw, Shield, Sun, Truck, Wallet } from "lucide-react";

import {
  adminCleanupExpired,
  adminForceExpireBatch,
  adminForceOfferBatch,
  adminManualCompleteDelivery,
  adminManualFailDelivery,
  adminManualSkipDelivery,
  adminRefundMember,
  adminResetTanker,
  clearAdminToken,
  getAdminDeliveries,
  getAdminLive,
  getAdminMe,
  getAdminOverview,
  getAdminPayments,
  getAdminRequestDetail,
  getAdminRequests,
  getAdminTankers,
  getAdminToken,
  loginAdmin,
  setAdminToken,
  type AdminDeliveryCard,
  getAdminOperationAlerts,
  adminReassignOperationAlert,
  adminCancelPriorityRequest,
  adminForceOfferPriority,
} from "@/lib/admin";
import { formatNigeriaDateTime } from "@/lib/datetime";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const POLL_MS = 10000;

const statusTone = (status?: string | null) => {
  const s = (status || "").toLowerCase();
  if (["completed", "delivered", "paid", "available"].includes(s)) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["failed", "expired", "cancelled", "skipped", "refunded"].includes(s)) return "bg-red-500/10 text-red-700 dark:text-red-300";
  if (["assigned", "loading", "delivering", "arrived", "awaiting_otp", "measuring"].includes(s)) return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
};

const formatNumber = (value?: number | null) => new Intl.NumberFormat("en-NG").format(Number(value || 0));

function StatusPill({ status }: { status?: string | null }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusTone(status)}`}>{status || "unknown"}</span>;
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  // const [secretInput, setSecretInput] = useState(getAdminSecret());
  // const [authEnabled, setAuthEnabled] = useState(Boolean(getAdminSecret()));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authEnabled, setAuthEnabled] = useState(Boolean(getAdminToken()));

  const [offerBatchId, setOfferBatchId] = useState("");
  const [offerTankerId, setOfferTankerId] = useState("");
  const [expireBatchId, setExpireBatchId] = useState("");
  const [resetTankerId, setResetTankerId] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [requestType, setRequestType] = useState("");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [tankerSearch, setTankerSearch] = useState("");
  const [tankerStatus, setTankerStatus] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; description: string; action: () => Promise<unknown> } | null>(null);
  const [reasonModal, setReasonModal] = useState<{ type: "fail" | "skip"; delivery: AdminDeliveryCard } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [offerPriorityRequestId, setOfferPriorityRequestId] = useState("");
  const [offerPriorityTankerId, setOfferPriorityTankerId] = useState("");
  const [cancelPriorityRequestId, setCancelPriorityRequestId] = useState("");

  const [theme, setTheme] = useState<"light" | "dark">("light");

  // const sessionQuery = useQuery({ queryKey: ["admin-session", authEnabled], queryFn: getAdminSession, enabled: authEnabled, retry: false });
  const sessionQuery = useQuery({
    queryKey: ["admin-me", authEnabled],
    queryFn: getAdminMe,
    enabled: authEnabled,
    retry: false,
  });
  const canLoad = authEnabled && sessionQuery.isSuccess;

  const overviewQuery = useQuery({ queryKey: ["admin-overview"], queryFn: getAdminOverview, refetchInterval: POLL_MS, enabled: canLoad });
  const liveQuery = useQuery({ queryKey: ["admin-live"], queryFn: () => getAdminLive(20), refetchInterval: POLL_MS, enabled: canLoad });
  const requestsQuery = useQuery({ queryKey: ["admin-requests", requestSearch, requestStatus, requestType], queryFn: () => getAdminRequests({ limit: 100, search: requestSearch, status: requestStatus || undefined, deliveryType: requestType || undefined }), refetchInterval: POLL_MS, enabled: canLoad });
  const paymentsQuery = useQuery({ queryKey: ["admin-payments", paymentSearch, paymentStatus], queryFn: () => getAdminPayments({ limit: 100, search: paymentSearch, status: paymentStatus || undefined }), refetchInterval: POLL_MS, enabled: canLoad });
  const tankersQuery = useQuery({ queryKey: ["admin-tankers", tankerSearch, tankerStatus], queryFn: () => getAdminTankers({ limit: 100, search: tankerSearch, status: tankerStatus || undefined }), refetchInterval: POLL_MS, enabled: canLoad });
  const deliveriesQuery = useQuery({ queryKey: ["admin-deliveries", deliverySearch, deliveryStatus, deliveryType], queryFn: () => getAdminDeliveries({ limit: 100, search: deliverySearch, status: deliveryStatus || undefined, jobType: deliveryType || undefined }), refetchInterval: POLL_MS, enabled: canLoad });
  const requestDetailQuery = useQuery({ queryKey: ["admin-request-detail", selectedRequestId], queryFn: () => getAdminRequestDetail(selectedRequestId as number), enabled: canLoad && selectedRequestId !== null });

  const operationAlertsQuery = useQuery({
    queryKey: ["admin-operation-alerts"],
    queryFn: () => getAdminOperationAlerts({ limit: 50, status: "open" }),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const loading = canLoad && [overviewQuery, liveQuery, requestsQuery, paymentsQuery, tankersQuery, deliveriesQuery].some((query) => query.isLoading);
  const anyError = [sessionQuery, overviewQuery, liveQuery, requestsQuery, paymentsQuery, tankersQuery, deliveriesQuery, operationAlertsQuery].find((query) => query.error);


  useEffect(() => {
    const savedTheme = localStorage.getItem("tankup-theme") as "light" | "dark" | null;

    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialTheme = prefersDark ? "dark" : "light";
      setTheme(initialTheme);
      document.documentElement.classList.toggle("dark", initialTheme === "dark");
    }

  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("tankup-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };


  const metricCards = useMemo(() => {
    const totals = overviewQuery.data?.totals || {};
    return [
      { label: "Active batches", value: totals.active_batches ?? 0, icon: Droplets },
      { label: "Active deliveries", value: totals.active_deliveries ?? 0, icon: Activity },
      { label: "Online tankers", value: totals.online_tankers ?? 0, icon: Truck },
      { label: "Paid value", value: overviewQuery.data?.payment_value?.paid ?? 0, icon: Wallet, currency: true },
    ];
  }, [overviewQuery.data]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-session"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-live"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-request-detail"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-tankers"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-deliveries"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-operation-alerts"] }),
    ]);
  };

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      setIsActionLoading(true);
      await action();
      toast.success(successMessage);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsActionLoading(false);
      setConfirmState(null);
      setReasonModal(null);
      setReasonText("");
    }
  };

  const askConfirm = (title: string, description: string, action: () => Promise<unknown>) => {
    setConfirmState({ title, description, action });
  };

  // const connectAdmin = async () => {
  //   if (!secretInput.trim()) {
  //     toast.error("Enter the admin secret first");
  //     return;
  //   }
  //   setAdminSecret(secretInput);
  //   setAuthEnabled(true);
  //   try {
  //     await queryClient.invalidateQueries({ queryKey: ["admin-session"] });
  //     await sessionQuery.refetch();
  //     toast.success("Admin access granted");
  //   } catch (error) {
  //     clearAdminSecret();
  //     setAuthEnabled(false);
  //     toast.error(error instanceof Error ? error.message : "Could not unlock admin dashboard");
  //   }
  // };
  const connectAdmin = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Enter username and password");
      return;
    }

    try {
      const data = await loginAdmin({
        username: username.trim(),
        password: password.trim(),
      });

      setAdminToken(data.access_token);
      setAuthEnabled(true);

      await queryClient.invalidateQueries({ queryKey: ["admin-me"] });
      await sessionQuery.refetch();

      toast.success("Admin access granted");
    } catch (error) {
      clearAdminToken();
      setAuthEnabled(false);
      toast.error(error instanceof Error ? error.message : "Could not log in to admin dashboard");
    }
  };

  // const logoutAdmin = () => {
  //   clearAdminSecret();
  //   setAuthEnabled(false);
  //   setSelectedRequestId(null);
  //   toast.success("Admin secret cleared");
  // };

  const logoutAdmin = () => {
    clearAdminToken();
    setAuthEnabled(false);
    setSelectedRequestId(null);
    setUsername("");
    setPassword("");
    toast.success("Admin logged out");
  };

  if (!authEnabled || sessionQuery.isError) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="mx-auto max-w-xl space-y-6 rounded-3xl border bg-card p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Shield className="h-4 w-4" /> Admin gate</div>
            <h1 className="text-2xl font-bold text-foreground">Unlock admin dashboard</h1>
            {/* <p className="text-sm text-muted-foreground">This page now expects the backend admin secret through the X-Admin-Secret header. Good. The front door should at least have a lock.</p> */}
            <p className="text-sm text-muted-foreground">
              Sign in with your admin username and password. The dashboard now uses JWT auth, not the old shared secret.
            </p>
          </div>
          {/* <Input value={secretInput} onChange={(e) => setSecretInput(e.target.value)} placeholder="Enter admin secret" type="password" /> */}
          <div className="space-y-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              type="password"
            />
          </div>
          {sessionQuery.error ? <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">{(sessionQuery.error as Error).message}</div> : null}
          <div className="flex gap-3">
            <Button onClick={connectAdmin}>Unlock</Button>
            <Button variant="outline" asChild><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back home</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex justify-end">
          <button
            onClick={toggleTheme}
            className="h-11 w-11 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:scale-105 transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Shield className="h-4 w-4" />Operations control room</div>
            <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">Admin Dashboard</h1>
            {/* <p className="text-sm text-muted-foreground">Hardened with a secret gate, tabular views, drill-downs, and confirmation rails for the scary buttons.</p> */}
            <p className="text-sm text-muted-foreground">
              Hardened with JWT auth, tabular views, drill-downs, and confirmation rails for the scary buttons.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back home</Link></Button>
            <Button variant="outline" onClick={logoutAdmin}>Lock dashboard</Button>
            <Button onClick={refreshAll}><RefreshCw className="mr-2 h-4 w-4" />Refresh now</Button>
          </div>
        </div>

        {loading ? <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Loading admin data…</div> : null}
        {anyError ? <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">{(anyError.error as Error)?.message || "Could not load admin dashboard data."}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-extrabold text-foreground">{item.currency ? `₦${formatNumber(item.value)}` : formatNumber(item.value)}</p>
              </div>
            );
          })}
        </div>

        <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Operations Alerts</h2>
              <p className="text-sm text-muted-foreground">
                Timeout and failure signals from the backend. This is your anti-zombie-request board.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-operation-alerts"] })}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Tanker</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {(operationAlertsQuery.data?.items || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      No open operation alerts. Beautiful silence — for now.
                    </TableCell>
                  </TableRow>
                ) : (
                  (operationAlertsQuery.data?.items || []).map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">{alert.alert_type}</TableCell>
                      <TableCell>
                        <StatusPill status={alert.severity} />
                      </TableCell>
                      <TableCell>
                        {alert.job_type} #{alert.job_id}
                      </TableCell>
                      <TableCell>{alert.tanker_id ? `#${alert.tanker_id}` : "—"}</TableCell>
                      <TableCell className="min-w-[260px] text-sm text-muted-foreground">
                        {alert.message}
                      </TableCell>
                      <TableCell>{formatNigeriaDateTime(alert.created_at)}</TableCell>
                      <TableCell>
                        {["loading_timeout", "offer_expiry_repeated_failure"].includes(alert.alert_type) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isActionLoading}
                            onClick={() =>
                              runAction(
                                () => adminReassignOperationAlert(alert.id),
                                "Manual reassignment triggered"
                              )
                            }
                          >
                            Reassign
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Live operations</h2>
              <p className="text-sm text-muted-foreground">Updated {formatNigeriaDateTime(liveQuery.data?.generated_at)}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Active batches</h3>
                {(liveQuery.data?.batches || []).map((batch) => (
                  <div key={batch.id} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2"><div className="font-semibold text-foreground">Batch #{batch.id}</div><StatusPill status={batch.status} /></div>
                    <p className="text-sm text-muted-foreground">{formatNumber(batch.current_volume)}L / {formatNumber(batch.target_volume)}L • {batch.fill_percent}% full</p>
                    <p className="text-sm text-muted-foreground">Members: {batch.member_count} • Paid: {batch.paid_member_count}</p>
                    <p className="text-sm text-muted-foreground">Tanker: {batch.tanker_id ? `#${batch.tanker_id}` : "Unassigned"}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Active tankers</h3>
                {(liveQuery.data?.tankers || []).map((tanker) => (
                  <div key={tanker.id} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2"><div className="font-semibold text-foreground">{tanker.driver_name}</div><StatusPill status={tanker.status} /></div>
                    <p className="text-sm text-muted-foreground">Plate: {tanker.tank_plate_number}</p>
                    <p className="text-sm text-muted-foreground">Online: {tanker.is_online ? "Yes" : "No"} • Available: {tanker.is_available ? "Yes" : "No"}</p>
                    <p className="text-xs text-muted-foreground">Last location: {formatNigeriaDateTime(tanker.last_location_update_at)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Active deliveries</h3>
                {(liveQuery.data?.deliveries || []).map((delivery) => (
                  <div key={delivery.id} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2"><div className="font-semibold text-foreground">Delivery #{delivery.id}</div><StatusPill status={delivery.delivery_status} /></div>
                    <p className="text-sm text-muted-foreground">{delivery.job_type} • Tanker #{delivery.tanker_id} • Stop {delivery.stop_order ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">Planned: {formatNumber(delivery.planned_liters)}L • OTP: {delivery.otp_verified ? "Verified" : "Pending"}</p>
                    {delivery.anomaly_flagged ? <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />Anomaly flagged.</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Emergency controls</h2>
              <p className="text-sm text-muted-foreground">Manual tools for when real life decides to freestyle.</p>
            </div>
            <div className="rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold text-foreground">Force offer priority to tanker</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={offerPriorityRequestId}
                  onChange={(e) => setOfferPriorityRequestId(e.target.value)}
                  placeholder="Priority Request ID"
                />
                <Input
                  value={offerPriorityTankerId}
                  onChange={(e) => setOfferPriorityTankerId(e.target.value)}
                  placeholder="Tanker ID"
                />
              </div>
              <Button
                disabled={isActionLoading || !offerPriorityRequestId || !offerPriorityTankerId}
                onClick={() =>
                  askConfirm(
                    "Force offer priority",
                    "This will push a priority request offer directly to the selected tanker.",
                    () => adminForceOfferPriority(Number(offerPriorityRequestId), Number(offerPriorityTankerId))
                  )
                }
              >
                Send priority offer
              </Button>
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold text-foreground">Cancel priority request</h3>
              <Input
                value={cancelPriorityRequestId}
                onChange={(e) => setCancelPriorityRequestId(e.target.value)}
                placeholder="Priority Request ID"
              />
              <Button
                variant="destructive"
                disabled={isActionLoading || !cancelPriorityRequestId}
                onClick={() =>
                  askConfirm(
                    "Cancel priority request",
                    "This cancels the priority request, clears pending offers, frees the tanker, and marks it refund-eligible.",
                    () => adminCancelPriorityRequest(Number(cancelPriorityRequestId), "Cancelled manually by admin")
                  )
                }
              >
                Cancel priority
              </Button>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Force offer batch to tanker</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={offerBatchId} onChange={(e) => setOfferBatchId(e.target.value)} placeholder="Batch ID" />
                  <Input value={offerTankerId} onChange={(e) => setOfferTankerId(e.target.value)} placeholder="Tanker ID" />
                </div>
                <Button disabled={isActionLoading || !offerBatchId || !offerTankerId} onClick={() => askConfirm("Force offer batch", "This will push a batch offer directly to the selected tanker.", () => adminForceOfferBatch(Number(offerBatchId), Number(offerTankerId)))}>Send offer</Button>
              </div>
              <div className="rounded-xl border p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Force expire batch</h3>
                <Input value={expireBatchId} onChange={(e) => setExpireBatchId(e.target.value)} placeholder="Batch ID" />
                <Button variant="destructive" disabled={isActionLoading || !expireBatchId} onClick={() => askConfirm("Expire batch", "This expires the batch and triggers refunds for paid active members.", () => adminForceExpireBatch(Number(expireBatchId), true))}>Expire batch + refund</Button>
              </div>
              <div className="rounded-xl border p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Reset tanker to available</h3>
                <Input value={resetTankerId} onChange={(e) => setResetTankerId(e.target.value)} placeholder="Tanker ID" />
                <Button variant="outline" disabled={isActionLoading || !resetTankerId} onClick={() => askConfirm("Reset tanker", "This clears pending offer state and returns the tanker to available when safe.", () => adminResetTanker(Number(resetTankerId)))}>Reset tanker</Button>
              </div>
              <Button variant="outline" disabled={isActionLoading} onClick={() => askConfirm("Run cleanup", "This runs expired-member cleanup immediately.", () => adminCleanupExpired())}>Run expired-member cleanup</Button>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Order history log</h2>
              <p className="text-sm text-muted-foreground">Tabular request log with drill-down. This doubles as your admin-side order history.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[760px]">
              <Input value={requestSearch} onChange={(e) => setRequestSearch(e.target.value)} placeholder="Search request, user, status" />
              <Input value={requestStatus} onChange={(e) => setRequestStatus(e.target.value)} placeholder="Status filter" />
              <Input value={requestType} onChange={(e) => setRequestType(e.target.value)} placeholder="Type: batch / priority" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>User</TableHead><TableHead>Volume</TableHead><TableHead>Retry</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {(requestsQuery.data?.items || []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>#{item.id}</TableCell>
                    <TableCell className="capitalize">{item.delivery_type}</TableCell>
                    <TableCell><StatusPill status={item.status} /></TableCell>
                    <TableCell>#{item.user_id}</TableCell>
                    <TableCell>{formatNumber(item.volume_liters)}L</TableCell>
                    <TableCell>{item.retry_count}</TableCell>
                    <TableCell>{formatNigeriaDateTime(item.created_at)}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => setSelectedRequestId(item.id)}><Eye className="mr-2 h-4 w-4" />Details</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Delivery history log</h2>
              <p className="text-sm text-muted-foreground">This is the gritty stop-level truth table. Exactly where issues tend to hide.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[760px]">
              <Input value={deliverySearch} onChange={(e) => setDeliverySearch(e.target.value)} placeholder="Search delivery, batch, tanker" />
              <Input value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} placeholder="Status filter" />
              <Input value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)} placeholder="Type: batch / priority" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Tanker</TableHead><TableHead>User</TableHead><TableHead>Planned</TableHead><TableHead>Updated</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {(deliveriesQuery.data?.items || []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>#{item.id}</TableCell>
                    <TableCell className="capitalize">{item.job_type}</TableCell>
                    <TableCell><StatusPill status={item.delivery_status} /></TableCell>
                    <TableCell>#{item.tanker_id}</TableCell>
                    <TableCell>{item.user_name || `#${item.user_id ?? "—"}`}</TableCell>
                    <TableCell>{formatNumber(item.planned_liters)}L</TableCell>
                    <TableCell>{formatNigeriaDateTime(item.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {!["delivered", "failed", "skipped"].includes(item.delivery_status) ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => askConfirm("Manual complete delivery", `This will force delivery #${item.id} to delivered and bypass missing OTP/measurement if necessary.`, () => adminManualCompleteDelivery(item.id, { notes: "Manual admin completion" }))}>Complete</Button>
                            <Button size="sm" variant="outline" onClick={() => { setReasonModal({ type: "fail", delivery: item }); setReasonText(""); }}>Fail</Button>
                            <Button size="sm" variant="outline" onClick={() => { setReasonModal({ type: "skip", delivery: item }); setReasonText(""); }}>Skip</Button>
                          </>
                        ) : <span className="text-xs text-muted-foreground">Resolved</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="text-lg font-bold text-foreground">Payments</h2><p className="text-sm text-muted-foreground">Payment log with quick refund visibility.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:w-[460px]"><Input value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} placeholder="Search payment, batch, member" /><Input value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} placeholder="Status filter" /></div>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Status</TableHead><TableHead>User</TableHead><TableHead>Batch</TableHead><TableHead>Member</TableHead><TableHead>Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {(paymentsQuery.data?.items || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>#{item.id}</TableCell>
                      <TableCell><StatusPill status={item.status} /></TableCell>
                      <TableCell>#{item.user_id ?? "—"}</TableCell>
                      <TableCell>#{item.batch_id ?? "—"}</TableCell>
                      <TableCell>#{item.member_id ?? "—"}</TableCell>
                      <TableCell>₦{formatNumber(item.amount)}</TableCell>
                      <TableCell>{item.member_id && item.status === "paid" ? <Button size="sm" variant="outline" onClick={() => askConfirm("Refund member", `This will attempt a refund for batch member #${item.member_id}.`, () => adminRefundMember(item.member_id as number))}>Refund</Button> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="text-lg font-bold text-foreground">Tankers</h2><p className="text-sm text-muted-foreground">Presence, state, and operational reset view.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:w-[460px]"><Input value={tankerSearch} onChange={(e) => setTankerSearch(e.target.value)} placeholder="Search driver, phone, plate" /><Input value={tankerStatus} onChange={(e) => setTankerStatus(e.target.value)} placeholder="Status filter" /></div>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Driver</TableHead><TableHead>Status</TableHead><TableHead>Online</TableHead><TableHead>Available</TableHead><TableHead>Plate</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {(tankersQuery.data?.items || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>#{item.id}</TableCell>
                      <TableCell>{item.driver_name}</TableCell>
                      <TableCell><StatusPill status={item.status} /></TableCell>
                      <TableCell>{item.is_online ? "Yes" : "No"}</TableCell>
                      <TableCell>{item.is_available ? "Yes" : "No"}</TableCell>
                      <TableCell>{item.tank_plate_number}</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => askConfirm("Reset tanker", `This will clear pending offer/current assignment pointers for tanker #${item.id} when possible.`, () => adminResetTanker(item.id))}>Reset</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </div>

      <Sheet open={selectedRequestId !== null} onOpenChange={(open) => !open && setSelectedRequestId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Request detail</SheetTitle>
            <SheetDescription>Single-request source of truth: customer, payments, batch link, tanker, and delivery trail.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {requestDetailQuery.isLoading ? <div className="text-sm text-muted-foreground">Loading request detail…</div> : null}
            {requestDetailQuery.data ? (
              <>
                <div className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center justify-between"><div className="font-semibold text-foreground">Request #{requestDetailQuery.data.request.id}</div><StatusPill status={requestDetailQuery.data.request.status} /></div>
                  <p className="text-sm text-muted-foreground">{requestDetailQuery.data.request.delivery_type} • {formatNumber(requestDetailQuery.data.request.volume_liters)}L • User #{requestDetailQuery.data.request.user_id}</p>
                  <p className="text-sm text-muted-foreground">Created: {formatNigeriaDateTime(requestDetailQuery.data.request.created_at)}</p>
                </div>
                {requestDetailQuery.data.user ? <div className="rounded-xl border p-4 space-y-1"><div className="font-semibold text-foreground">Customer</div><p className="text-sm text-muted-foreground">{requestDetailQuery.data.user.name} • {requestDetailQuery.data.user.phone}</p><p className="text-sm text-muted-foreground">{requestDetailQuery.data.user.address}</p></div> : null}
                {requestDetailQuery.data.member ? <div className="rounded-xl border p-4 space-y-1"><div className="font-semibold text-foreground">Batch member</div><p className="text-sm text-muted-foreground">Member #{requestDetailQuery.data.member.id} • Status: {requestDetailQuery.data.member.status || "—"}</p><p className="text-sm text-muted-foreground">Payment: {requestDetailQuery.data.member.payment_status || "—"} • Amount: ₦{formatNumber(requestDetailQuery.data.member.amount_paid)}</p></div> : null}
                {requestDetailQuery.data.batch ? <div className="rounded-xl border p-4 space-y-1"><div className="font-semibold text-foreground">Batch</div><p className="text-sm text-muted-foreground">Batch #{requestDetailQuery.data.batch.id} • {requestDetailQuery.data.batch.fill_percent}% full • Tanker {requestDetailQuery.data.batch.tanker_id ? `#${requestDetailQuery.data.batch.tanker_id}` : "Unassigned"}</p></div> : null}
                {requestDetailQuery.data.tanker ? <div className="rounded-xl border p-4 space-y-1"><div className="font-semibold text-foreground">Tanker</div><p className="text-sm text-muted-foreground">{requestDetailQuery.data.tanker.driver_name} • {requestDetailQuery.data.tanker.tank_plate_number}</p><p className="text-sm text-muted-foreground">Status: {requestDetailQuery.data.tanker.status}</p></div> : null}
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="font-semibold text-foreground">Payments</div>
                  {(requestDetailQuery.data.payments || []).length === 0 ? <p className="text-sm text-muted-foreground">No linked payments.</p> : requestDetailQuery.data.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between rounded-lg border p-3"><div className="text-sm text-muted-foreground">Payment #{payment.id}</div><div className="flex items-center gap-3"><span className="text-sm font-medium text-foreground">₦{formatNumber(payment.amount)}</span><StatusPill status={payment.status} /></div></div>)}
                </div>
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="font-semibold text-foreground">Delivery trail</div>
                  {(requestDetailQuery.data.deliveries || []).length === 0 ? <p className="text-sm text-muted-foreground">No linked delivery records.</p> : requestDetailQuery.data.deliveries.map((delivery) => <div key={delivery.id} className="rounded-lg border p-3"><div className="flex items-center justify-between"><div className="font-medium text-foreground">Delivery #{delivery.id}</div><StatusPill status={delivery.delivery_status} /></div><p className="mt-1 text-sm text-muted-foreground">Stop {delivery.stop_order ?? "—"} • Tanker #{delivery.tanker_id} • Planned {formatNumber(delivery.planned_liters)}L</p></div>)}
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(confirmState)} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmState && runAction(confirmState.action, `${confirmState.title} successful`)}>Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(reasonModal)} onOpenChange={(open) => !open && setReasonModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{reasonModal?.type === "fail" ? "Mark delivery as failed" : "Skip delivery"}</AlertDialogTitle>
            <AlertDialogDescription>Give a real reason. Future you will need the paper trail.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Reason" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!reasonModal || reasonText.trim().length < 3) {
                toast.error("Reason must be at least 3 characters");
                return;
              }
              if (reasonModal.type === "fail") {
                runAction(() => adminManualFailDelivery(reasonModal.delivery.id, reasonText.trim()), "Delivery marked as failed");
              } else {
                runAction(() => adminManualSkipDelivery(reasonModal.delivery.id, reasonText.trim()), "Delivery skipped");
              }
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}