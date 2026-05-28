import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Moon, RefreshCw, Shield, Sun } from "lucide-react";
import { toast } from "sonner";

import {
  adminManualFailDelivery,
  adminManualSkipDelivery,
  clearAdminToken,
  getAdminMe,
  getAdminToken,
  loginAdmin,
  setAdminToken,
  type AdminDeliveryCard,
} from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OverviewTab } from "@/components/admin/OverviewTab";
import { LiveTab } from "@/components/admin/LiveTab";
import { HistoryTab } from "@/components/admin/HistoryTab";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { EmergencyTab } from "@/components/admin/EmergencyTab";

type ConfirmState = {
  title: string;
  description: string;
  action: () => Promise<unknown>;
};

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authEnabled, setAuthEnabled] = useState(Boolean(getAdminToken()));
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [reasonModal, setReasonModal] = useState<{
    type: "fail" | "skip";
    delivery: AdminDeliveryCard;
  } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("tankup-theme") as "light" | "dark" | null;
    const initial = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", initial === "dark");
    return initial;
  });

  const sessionQuery = useQuery({
    queryKey: ["admin", "session"],
    queryFn: getAdminMe,
    enabled: authEnabled,
    retry: false,
  });

  const canLoad = authEnabled && sessionQuery.isSuccess;

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("tankup-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setIsActionLoading(true);
    try {
      await action();
      toast.success(successMessage);
      refreshAll();
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

  const connectAdmin = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Enter username and password");
      return;
    }
    try {
      const data = await loginAdmin({ username: username.trim(), password: password.trim() });
      setAdminToken(data.access_token);
      setAuthEnabled(true);
      await sessionQuery.refetch();
      toast.success("Admin access granted");
    } catch (error) {
      clearAdminToken();
      setAuthEnabled(false);
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  };

  const logoutAdmin = () => {
    clearAdminToken();
    setAuthEnabled(false);
    setUsername("");
    setPassword("");
    queryClient.clear();
    toast.success("Admin logged out");
  };

  // ── Login gate ───────────────────────────────────────────────────────────────

  if (!authEnabled || sessionQuery.isError) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="mx-auto max-w-xl space-y-6 rounded-3xl border bg-card p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-500/10 p-2">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
              <span className="text-sm font-medium text-red-500">Admin gate</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Unlock admin dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with your admin username and password.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              onKeyDown={(e) => e.key === "Enter" && connectAdmin()}
            />
          </div>
          {sessionQuery.error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
              {(sessionQuery.error as Error).message}
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={connectAdmin} className="bg-red-500 hover:bg-red-600 text-white">Unlock</Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-red-500">
              <Shield className="h-4 w-4" />
              Operations control room
            </div>
            <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:scale-105"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button variant="outline" onClick={refreshAll}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back home
              </Link>
            </Button>
            <Button variant="outline" onClick={logoutAdmin}>
              Lock dashboard
            </Button>
          </div>
        </div>

        {/* Tab layout */}
        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start border bg-card">
            <TabsTrigger value="overview" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">Overview</TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">Live</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">History</TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">Payments &amp; Tankers</TabsTrigger>
            <TabsTrigger value="emergency" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">Emergency</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab
              canLoad={canLoad}
              isActionLoading={isActionLoading}
              runAction={runAction}
            />
          </TabsContent>

          <TabsContent value="live" className="mt-6">
            <LiveTab canLoad={canLoad} />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <HistoryTab
              canLoad={canLoad}
              isActionLoading={isActionLoading}
              askConfirm={askConfirm}
              onOpenReasonModal={(type, delivery) => {
                setReasonModal({ type, delivery });
                setReasonText("");
              }}
            />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <PaymentsTab
              canLoad={canLoad}
              isActionLoading={isActionLoading}
              askConfirm={askConfirm}
            />
          </TabsContent>

          <TabsContent value="emergency" className="mt-6">
            <EmergencyTab isActionLoading={isActionLoading} askConfirm={askConfirm} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm modal */}
      <AlertDialog open={Boolean(confirmState)} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmState && runAction(confirmState.action, `${confirmState.title} successful`)
              }
            >
              {isActionLoading ? "Running…" : "Proceed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reason modal (fail / skip delivery) */}
      <AlertDialog open={Boolean(reasonModal)} onOpenChange={(open) => !open && setReasonModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reasonModal?.type === "fail" ? "Mark delivery as failed" : "Skip delivery"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Give a real reason — future you will need the paper trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!reasonModal || reasonText.trim().length < 3) {
                  toast.error("Reason must be at least 3 characters");
                  return;
                }
                const { type, delivery } = reasonModal;
                runAction(
                  () =>
                    type === "fail"
                      ? adminManualFailDelivery(delivery.id, reasonText.trim())
                      : adminManualSkipDelivery(delivery.id, reasonText.trim()),
                  `Delivery ${type === "fail" ? "failed" : "skipped"}`,
                );
              }}
            >
              {isActionLoading ? "Running…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
