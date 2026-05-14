import { ArrowLeft, Bell, BellOff, CircleHelp, LogOut, UserCircle2 } from "lucide-react";
import RequestStep from "@/components/client/RequestStep";
import PaymentStep from "@/components/client/PaymentStep";
import BatchStep from "@/components/client/BatchStep";
import TankerStep from "@/components/client/TankerStep";
import DeliveryStep from "@/components/client/DeliveryStep";
import CompletedStep from "@/components/client/CompletedStep";
import ExpiredBatchStep from "@/components/client/ExpiredBatchStep";
import DeliveryOutcomeStep from "@/components/client/DeliveryOutcomeStep";
import HelpModal from "@/components/client/HelpModal";
import LeaveBatchWarningModal from "@/components/client/LeaveBatchWarningModal";
import AuthModal from "@/components/client/AuthModal";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useClientFlow } from "@/hooks/useClientFlow";
import type { ClientViewProps } from "@/types/client";
import OrderHistoryTab from "@/components/client/OrderHistoryTab";
import { useClientDeliveryAlerts } from "@/hooks/useClientDeliveryAlerts";
import { useWebPushNotifications } from "@/hooks/useWebPushNotifications";

const ClientView = ({ onBack }: ClientViewProps) => {
  const {
    step,
    setStep,
    selectedSize,
    setSelectedSize,
    requestMode,
    setRequestMode,
    priorityMode,
    setPriorityMode,
    scheduledFor,
    setScheduledFor,

    showHelp,
    setShowHelp,
    showLeaveBatchWarning,
    setShowLeaveBatchWarning,

    otp,
    price,
    canContinueToPayment,
    pageTitle,

    copyOtp,
    handleContinueToPayment,
    handlePayment,
    handleCancelBeforePayment,
    handleLeaveBatch,
    resetClientFlow,
    handleDeliveryConfirmed,
    handleBackClick,

    isRecoveringPriorityRequest,
    isSubmittingRequest,
    requestId,
    batchId,
    memberId,
    paymentDeadline,

    currentUser,
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,
    handleAuthSuccess,
    handleLogout,

    liveBatch,
    liveBatchLoading,
    liveBatchError,
    refreshLiveBatch,

    livePriorityRequest,
    livePriorityLoading,
    livePriorityError,
    refreshLivePriorityRequest,

    activeTab,
    setActiveTab,
  } = useClientFlow({ onBack });

  const {
    isSupported: webPushSupported,
    isSubscribed: webPushSubscribed,
    enableWebPush,
    disableWebPush,
  } = useWebPushNotifications({
    userType: "client",
    userId: null,
  });

  const {
    alertsEnabled,
    enableAlerts,
    disableAlerts,
  } = useClientDeliveryAlerts({
    mode: requestMode,
    batchStatus: liveBatch?.status,
    deliveryStatus:
      requestMode === "batch"
        ? liveBatch?.member_delivery_status
        : livePriorityRequest?.delivery_status,
    requestStatus: livePriorityRequest?.request_status,
    tankerStatus: livePriorityRequest?.tanker_status,
  });

  const renderLiveStep = () => {
    switch (step) {
      case "request":
        return (
          <RequestStep
            requestMode={requestMode}
            selectedSize={selectedSize}
            priorityMode={priorityMode}
            scheduledFor={scheduledFor}
            canContinueToPayment={canContinueToPayment}
            onSelectMode={setRequestMode}
            onSelectSize={setSelectedSize}
            onSelectPriorityMode={setPriorityMode}
            onSetScheduledFor={setScheduledFor}
            onContinue={handleContinueToPayment}
            onCancel={handleCancelBeforePayment}
          />
        );

      case "payment":
        return (
          <PaymentStep
            price={price}
            selectedSize={selectedSize}
            requestMode={requestMode}
            priorityMode={priorityMode}
            scheduledFor={scheduledFor}
            onPay={handlePayment}
            onCancel={handleCancelBeforePayment}
            isLoading={isSubmittingRequest}
          />
        );

      case "batch":
        return (
          <BatchStep
            otp={otp}
            selectedSize={selectedSize}
            price={price}
            onCopyOtp={copyOtp}
            onViewTanker={() => setStep("tanker")}
            onLeaveBatch={() => setShowLeaveBatchWarning(true)}
            batchId={batchId}
            requestId={requestId}
            paymentDeadline={paymentDeadline}
            liveBatch={liveBatch}
            liveBatchLoading={liveBatchLoading}
            liveBatchError={liveBatchError}
          />
        );

      case "tanker":
        return (
          <TankerStep
            requestMode={requestMode}
            priorityMode={priorityMode}
            scheduledFor={scheduledFor}
            selectedSize={selectedSize ?? 0}
            onArrived={() => setStep("delivery")}
            liveBatch={liveBatch}
            liveBatchLoading={liveBatchLoading}
            liveBatchError={liveBatchError}
            livePriorityRequest={livePriorityRequest}
            livePriorityLoading={livePriorityLoading}
            livePriorityError={livePriorityError}
            refreshLivePriorityRequest={refreshLivePriorityRequest}
          />
        );

      case "delivery":
        return (
          <DeliveryStep
            requestMode={requestMode}
            otp={otp}
            onConfirm={handleDeliveryConfirmed}
            onCopyOtp={copyOtp}
            livePriorityRequest={livePriorityRequest}
            livePriorityLoading={livePriorityLoading}
            livePriorityError={livePriorityError}
            liveBatch={liveBatch}
            liveBatchLoading={liveBatchLoading}
            liveBatchError={liveBatchError}
          />
        );

      case "completed":
        return (
          <CompletedStep
            selectedSize={selectedSize}
            requestMode={requestMode}
            priorityMode={priorityMode}
            scheduledFor={scheduledFor}
            price={price}
            otp={otp}
            onBackHome={resetClientFlow}
          />
        );

      case "failed":
        return (
          <DeliveryOutcomeStep
            status="failed"
            requestMode={requestMode}
            selectedSize={selectedSize}
            price={price}
            failureReason={livePriorityRequest?.failure_reason ?? liveBatch?.failure_reason ?? liveBatch?.notes}
            refundEligible={liveBatch?.refund_eligible ?? null}
            refundStatus={liveBatch?.refund_status ?? null}
            actualLitersDelivered={livePriorityRequest?.actual_liters_delivered ?? null}
            plannedLiters={livePriorityRequest?.planned_liters ?? null}
            onBackHome={resetClientFlow}
          />
        );

      case "partial":
        return (
          <DeliveryOutcomeStep
            status="partial"
            requestMode={requestMode}
            selectedSize={selectedSize}
            price={price}
            failureReason={livePriorityRequest?.failure_reason ?? liveBatch?.failure_reason ?? liveBatch?.notes}
            refundEligible={liveBatch?.refund_eligible ?? null}
            refundStatus={liveBatch?.refund_status ?? null}
            actualLitersDelivered={livePriorityRequest?.actual_liters_delivered ?? null}
            plannedLiters={livePriorityRequest?.planned_liters ?? null}
            onBackHome={resetClientFlow}
          />
        );

      case "expired":
        return (
          <ExpiredBatchStep
            liveBatch={liveBatch}
            memberId={memberId}
            onBackHome={resetClientFlow}
            refreshLiveBatch={refreshLiveBatch}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackClick}
                className={`text-foreground ${step === "batch" ? "text-red-500" : ""}`}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <h1 className="text-lg font-bold text-foreground">
                {activeTab === "history" ? "Order History" : pageTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {currentUser ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                    <div className="leading-tight">
                      <p className="text-sm font-medium text-foreground">
                        {currentUser.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {currentUser.phone}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setShowAuthModal(true);
                  }}
                  className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  Sign In
                </button>
              )}

              <button
                onClick={() => setShowHelp(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/30"
                aria-label="Open help"
              >
                <CircleHelp className="h-4.5 w-4.5" />
              </button>

              <ThemeToggle />

              <button
                onClick={alertsEnabled ? disableAlerts : enableAlerts}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                title={alertsEnabled ? "Disable delivery alerts" : "Enable delivery alerts"}
              >
                {alertsEnabled ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {alertsEnabled ? "Alerts on" : "Enable alerts"}
                </span>
              </button>

              <button
                onClick={webPushSubscribed ? disableWebPush : enableWebPush}
                disabled={!webPushSupported}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  webPushSubscribed
                    ? "Disable background notifications"
                    : "Enable background notifications"
                }
              >
                {webPushSubscribed ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {webPushSubscribed ? "Push on" : "Enable push"}
                </span>
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="grid grid-cols-2 rounded-2xl border bg-background p-1">
              <button
                onClick={() => setActiveTab("request")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === "request"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
                  }`}
              >
                New Order
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === "history"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
                  }`}
                disabled={!currentUser}
              >
                Order History
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md p-5">
        {/* {activeTab === "history" && currentUser ? (
          <OrderHistoryTab userId={currentUser.id} />
        ) : (
          renderLiveStep()
        )} */}
        {isRecoveringPriorityRequest ? (
          <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
            Checking for your active priority delivery...
          </div>
        ) : activeTab === "history" && currentUser ? (
          <OrderHistoryTab userId={currentUser.id} />
        ) : (
          renderLiveStep()
        )}
      </main>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {showLeaveBatchWarning && (
        <LeaveBatchWarningModal
          onClose={() => setShowLeaveBatchWarning(false)}
          onConfirmLeave={handleLeaveBatch}
        />
      )}

      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          onModeChange={setAuthMode}
        />
      )}
    </div>
  );
};

export default ClientView;
