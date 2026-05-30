import { useState } from "react";
import { DriverHeader } from "@/components/driver/DriverHeader";
import { DriverAvailableStep } from "@/components/driver/DriverAvailableStep";
import { DriverLoadingStep } from "@/components/driver/DriverLoadingStep";
import { DriverDeliveringStep } from "@/components/driver/DriverDeliveringStep";
import { DriverCompletedStep } from "@/components/driver/DriverCompletedStep";
import DriverIncomingOfferStep from "@/components/driver/DriverIncomingOfferStep";
import DriverAuthModal from "@/components/driver/DriverAuthModal";
import { DriverProfileDialog } from "@/components/driver/DriverProfileDialog";
import DriverHelpModal from "@/components/driver/DriverHelpModal";
import DriverReportIncidentModal from "@/components/driver/ReportIncidentModal";
import DeliveryHistoryTab from "@/components/driver/DeliveryHistoryTab";
import { useDriverFlow } from "@/hooks/useDriverFlow";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { useDriverOfferAlarm } from "@/hooks/useDriverOfferAlarm";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { Bell, BellOff } from "lucide-react";
import { useWebPushNotifications } from "@/hooks/useWebPushNotifications";

interface DriverViewProps {
  onBack: () => void;
}

function StateBridgeCard({
  title,
  message,
  onRefresh,
  isLoading,
}: {
  title: string;
  message: string;
  onRefresh: () => void | Promise<void>;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>

      <button
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium"
        onClick={onRefresh}
        disabled={isLoading}
      >
        {isLoading ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  );
}

function NextStepCard({
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel = "Refresh",
  onSecondary,
  isLoading,
}: {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void | Promise<void>;
  secondaryLabel?: string;
  onSecondary?: () => void | Promise<void>;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Next step
        </p>
        <h2 className="mt-1 text-xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>

      <div className="flex gap-3">
        <button
          className="inline-flex h-11 items-center justify-center rounded-xl bg-success px-4 text-sm font-medium text-success-foreground disabled:opacity-60"
          onClick={onPrimary}
          disabled={isLoading}
        >
          {isLoading ? "Please wait..." : primaryLabel}
        </button>

        {onSecondary && (
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium disabled:opacity-60"
            onClick={onSecondary}
            disabled={isLoading}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}



const DriverView = ({ onBack }: DriverViewProps) => {
  const [showHelp, setShowHelp] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("driver_is_online");
    return stored === null ? true : stored === "true";
  });

  const toggleOnline = () => {
    setIsOnline((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("driver_is_online", String(next));
      } catch {}
      return next;
    });
  };

  const { driver, isAuthenticated, isHydrated, loginDriver, logoutDriver, updateDriver } =
    useDriverAuth();

  const {
    isSupported: webPushSupported,
    isSubscribed: webPushSubscribed,
    enableWebPush,
    disableWebPush,
  } = useWebPushNotifications({
    userType: "driver",
    userId: driver?.tankerId ?? null,
  });

  // IMPORTANT:
  // Call hooks before any conditional return.
  // This fixes "Rendered more hooks than during the previous render."
  const {
    step,
    incomingOffer,
    acceptOffer,
    rejectOffer,
    activeJob,
    deliveries,
    currentDelivery,
    activeDeliveryIdx,
    deliveredCount,
    allDelivered,
    allowedActions,
    currentStop,
    jobResponse,
    otpInput,
    setOtpInput,
    meterStartReading,
    setMeterStartReading,
    meterEndReading,
    setMeterEndReading,
    deliveryNotes,
    setDeliveryNotes,
    failureReason,
    setFailureReason,
    skipReason,
    setSkipReason,
    isLoading,
    isActionLoading,
    refreshJob,
    markLoaded,
    markArrived,
    beginMeasurement,
    finishMeasurement,
    verifyOtp,
    completeDelivery,
    failCurrentStop,
    skipCurrentStop,
    resetToDashboard,
    activeTab,
    setActiveTab,
    startLoading,
    nextInstruction,
  } = useDriverFlow(driver);

  const { alertsEnabled, notificationPermission, enableAlerts, disableAlerts } =
    useDriverOfferAlarm(incomingOffer);

  const renderJobAlertBanner = () => {
    if (!isAuthenticated) return null;

    return (
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-success/10 p-2 text-success">
              <BellRing className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">
                Loud job alerts
              </p>

              <p className="text-xs text-muted-foreground">
                {alertsEnabled
                  ? notificationPermission === "granted"
                    ? "Alarm sound + browser notifications are active for incoming jobs."
                    : "Alarm sound is active. Browser notification permission is not granted."
                  : "Enable this once so incoming offers can ring loudly while this page is open."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={alertsEnabled ? disableAlerts : enableAlerts}
            className={
              alertsEnabled
                ? "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium"
                : "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-success px-4 text-sm font-medium text-success-foreground"
            }
          >
            {alertsEnabled ? (
              <>
                <VolumeX className="h-4 w-4" />
                Disable alarm
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                Enable loud alerts
              </>
            )}
          </button>

          <button
            type="button"
            onClick={webPushSubscribed ? disableWebPush : enableWebPush}
            disabled={!webPushSupported || !driver?.tankerId}
            className={
              webPushSubscribed
                ? "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium disabled:opacity-50"
                : "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-success px-4 text-sm font-medium text-success-foreground disabled:opacity-50"
            }
          >
            {webPushSubscribed ? (
              <>
                <BellOff className="h-4 w-4" />
                Disable push
              </>
            ) : (
              <>
                <Bell className="h-4 w-4" />
                {!driver?.tankerId ? "Login required" : "Enable push"}
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    if (isLoading && !incomingOffer && !activeJob && !currentStop) {
      return (
        <div className="rounded-xl border p-4 text-sm">
          Loading current job...
        </div>
      );
    }

    if (incomingOffer) {
      return (
        <DriverIncomingOfferStep
          offer={incomingOffer}
          isSubmitting={isActionLoading}
          onAccept={acceptOffer}
          onReject={rejectOffer}
          onRefresh={refreshJob}
        />
      );
    }

    switch (step) {
      case "offline":
      case "available":
        return (
          <DriverAvailableStep
            job={activeJob}
            isLoading={isActionLoading}
            onRefresh={refreshJob}
            onAcceptJob={acceptOffer}
            batchId={activeJob?.jobId || null}
          />
        );

      case "assigned":
        if (!activeJob) {
          return (
            <StateBridgeCard
              title="Assignment Received"
              message="Your assignment is syncing. Refresh to continue."
              onRefresh={refreshJob}
              isLoading={isActionLoading}
            />
          );
        }

        return (
          <NextStepCard
            title="Start loading water"
            message={
              nextInstruction ||
              "You already accepted this offer. Start loading water now."
            }
            primaryLabel="Start Loading"
            onPrimary={startLoading}
            onSecondary={refreshJob}
            isLoading={isActionLoading}
          />
        );

      case "loading":
        if (!activeJob) {
          return (
            <StateBridgeCard
              title="Preparing Loading Step"
              message="The app is syncing your accepted job. Refresh in a moment."
              onRefresh={refreshJob}
              isLoading={isActionLoading}
            />
          );
        }

        return (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-medium text-foreground">
                Load the tanker now.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {jobResponse?.message ||
                  nextInstruction ||
                  "You have up to 90 minutes to load water, then confirm the tanker is ready."}
              </p>
            </div>

            <DriverLoadingStep
              job={activeJob}
              isLoading={isActionLoading}
              onMarkLoaded={markLoaded}
            />
          </div>
        );

      case "delivering":
      case "arrived":
        if (!activeJob) {
          return (
            <StateBridgeCard
              title="Delivery In Progress"
              message="The stop is syncing. Refresh to pull the current customer and action state."
              onRefresh={refreshJob}
              isLoading={isActionLoading}
            />
          );
        }

        return (
          <div className="space-y-2">
            <DriverDeliveringStep
              currentDelivery={currentDelivery}
              activeDeliveryIdx={activeDeliveryIdx}
              deliveredCount={deliveredCount}
              totalStops={deliveries.length}
              allDelivered={allDelivered}
              allowedActions={allowedActions}
              currentStopStatus={currentStop?.delivery_status ?? null}
              otpVerified={currentStop?.otp_verified ?? false}
              otpInput={otpInput}
              setOtpInput={setOtpInput}
              meterStartReading={meterStartReading}
              setMeterStartReading={setMeterStartReading}
              meterEndReading={meterEndReading}
              setMeterEndReading={setMeterEndReading}
              deliveryNotes={deliveryNotes}
              setDeliveryNotes={setDeliveryNotes}
              failureReason={failureReason}
              setFailureReason={setFailureReason}
              skipReason={skipReason}
              setSkipReason={setSkipReason}
              isLoading={isActionLoading}
              onMarkArrived={markArrived}
              onBeginMeasurement={beginMeasurement}
              onFinishMeasurement={finishMeasurement}
              onVerifyOtp={verifyOtp}
              onCompleteDelivery={completeDelivery}
              onFailStop={failCurrentStop}
              onSkipStop={skipCurrentStop}
              onReset={resetToDashboard}
            />
            <button
              onClick={() => setShowReport(true)}
              className="w-full text-xs text-destructive py-2 hover:underline"
            >
              Report an incident
            </button>
          </div>
        );

      case "completed":
        if (!activeJob) {
          return (
            <StateBridgeCard
              title="Job Completed"
              message="The backend has already closed the job. Refresh or go back to dashboard."
              onRefresh={refreshJob}
              isLoading={isActionLoading}
            />
          );
        }

        return (
          <DriverCompletedStep
            job={activeJob}
            deliveries={deliveries}
            onBackToDashboard={resetToDashboard}
          />
        );

      default:
        return (
          <StateBridgeCard
            title="Driver State Unknown"
            message="The app could not decide the next step yet. Refresh and try again."
            onRefresh={refreshJob}
            isLoading={isActionLoading}
          />
        );
    }
  };

  if (!isHydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-5">
        <DriverAuthModal onLogin={loginDriver} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DriverHeader
        step={step}
        driverName={driver?.name}
        onBack={onBack}
        onLogout={logoutDriver}
        onOpenHelp={() => setShowHelp(true)}
        onEditProfile={isAuthenticated ? () => setProfileOpen(true) : undefined}
        showOnlineToggle={isAuthenticated}
        isOnline={isOnline}
        onToggleOnline={toggleOnline}
      />

      {/* <div className="mx-auto max-w-md p-5 space-y-4">
        <div className="grid grid-cols-2 rounded-2xl border bg-card p-1"> */}
      <div className="mx-auto max-w-md p-5 space-y-4">
        {renderJobAlertBanner()}

        <div className="grid grid-cols-2 rounded-2xl border bg-card p-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === "dashboard"
                ? "bg-success text-success-foreground"
                : "text-foreground"
              }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === "history"
                ? "bg-success text-success-foreground"
                : "text-foreground"
              }`}
          >
            Delivery History
          </button>
        </div>

        {activeTab === "history" && driver?.tankerId ? (
          <DeliveryHistoryTab tankerId={driver.tankerId} />
        ) : (
          renderDashboard()
        )}
      </div>

      {showHelp && <DriverHelpModal onClose={() => setShowHelp(false)} batchId={activeJob?.jobId || null} driverId={driver?.tankerId ?? null} />}

      {showReport && (
        <DriverReportIncidentModal
          onClose={() => setShowReport(false)}
          batchId={activeJob?.jobId ?? null}
          tankerId={driver?.tankerId ?? null}
          deliveryRecordId={currentStop?.id ?? null}
        />
      )}

      {driver && (
        <DriverProfileDialog
          open={profileOpen}
          driver={driver}
          onClose={() => setProfileOpen(false)}
          onSave={updateDriver}
        />
      )}
    </div>
  );
};

export default DriverView;
