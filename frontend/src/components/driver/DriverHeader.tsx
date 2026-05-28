import { ArrowLeft, CircleHelp, LogOut, Truck } from "lucide-react";
import type { DriverStep } from "@/types/driver";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface DriverHeaderProps {
  step: DriverStep;
  driverName?: string;
  onBack: () => void;
  onLogout: () => void;
  onOpenHelp: () => void;
  isOnline?: boolean;
  onToggleOnline?: () => void;
  showOnlineToggle?: boolean;
}

const stepTitles: Record<DriverStep, string> = {
  offline: "Driver Dashboard",
  available: "Driver Dashboard",
  assigned: "New Assignment",
  loading: "Loading Water",
  delivering: "Deliveries",
  arrived: "Arrival Confirmation",
  completed: "Trip Complete",
};

export const DriverHeader = ({
  step,
  driverName,
  onBack,
  onLogout,
  onOpenHelp,
  isOnline = true,
  onToggleOnline,
  showOnlineToggle = false,
}: DriverHeaderProps) => {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            className="text-foreground transition-opacity hover:opacity-80"
            aria-label="Go back"
            type="button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground">
              {stepTitles[step]}
            </h1>

            {driverName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                <span className="truncate">{driverName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showOnlineToggle && onToggleOnline && (
            <button
              onClick={onToggleOnline}
              type="button"
              className={
                isOnline
                  ? "inline-flex h-9 items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 text-xs font-semibold text-success transition-colors hover:bg-success/20"
                  : "inline-flex h-9 items-center gap-2 rounded-full border border-border bg-muted px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/80"
              }
              aria-label={isOnline ? "Go offline" : "Go online"}
              title={isOnline ? "You're online — tap to go offline" : "You're offline — tap to go online"}
            >
              <span
                className={
                  isOnline
                    ? "inline-block h-2 w-2 rounded-full bg-success animate-pulse"
                    : "inline-block h-2 w-2 rounded-full bg-muted-foreground"
                }
              />
              {isOnline ? "Online" : "Offline"}
            </button>
          )}

          <button
            onClick={onOpenHelp}
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-success/30 hover:bg-muted"
            aria-label="Help"
            title="Help"
          >
            <CircleHelp className="h-4.5 w-4.5" />
          </button>

          <button
            onClick={onLogout}
            type="button"
            className="rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

