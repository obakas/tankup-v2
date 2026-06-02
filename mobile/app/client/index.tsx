// app/(client)/index.tsx

import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { router } from "expo-router";

import { useClientFlow } from "@/hooks/useClientFlow";

import { ClientHeader } from "@/components/client/ClientHeader";
import { AuthStep } from "@/components/client/AuthStep";
import { RequestStep } from "@/components/client/RequestStep";
import { PaymentStep } from "@/components/client/PaymentStep";
import { BatchStep } from "@/components/client/BatchStep";
import { TankerStep } from "@/components/client/TankerStep";
import { DeliveryStep } from "@/components/client/DeliveryStep";
import { CompletedStep } from "@/components/client/CompletedStep";
import { FailedStep } from "@/components/client/FailedStep";
import { HelpModal } from "@/components/client/HelpModal";
import { ReportIncidentModal } from "@/components/client/ReportIncidentModal";
import { useAppTheme } from "@/hooks/useAppTheme";
import { OrderHistoryModal } from "@/components/client/OrderHistoryModal";
import { ProfileModal } from "@/components/client/ProfileModal";
import { SitesModal } from "@/components/client/SitesModal";

export default function ClientFlow() {
  const flow = useClientFlow();
  const { theme, themeMode, toggleTheme } = useAppTheme();
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [sitesVisible, setSitesVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [incidentVisible, setIncidentVisible] = useState(false);


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ClientHeader
        title={flow.titles[flow.step]}
        user={flow.user}
        onBack={flow.back}
        onLogout={flow.goRoleHome}
        onEditProfile={() => setProfileVisible(true)}
        onOpenSites={() => setSitesVisible(true)}
        onOpenHelp={() => setHelpVisible(true)}
        theme={theme}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        alertsEnabled={alertsEnabled}
        onToggleAlerts={() => setAlertsEnabled((prev) => !prev)}
        onOpenHistory={() => setHistoryVisible(true)}
        onOpenNotificationSettings={() => router.push("/client/settings")}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
      >

        {flow.step === "auth" && (
          <AuthStep
            onComplete={(user, isSignup) => {
              flow.handleAuthComplete(user);
              if (isSignup) setSitesVisible(true);
            }}
          />
        )}

        {flow.step === "request" && (
          <RequestStep
            mode={flow.mode}
            setMode={flow.setMode}
            size={flow.size}
            setSize={flow.setSize}
            priorityMode={flow.priorityMode}
            setPriorityMode={flow.setPriorityMode}
            onContinue={flow.handleSubmitRequest}
            loading={flow.loading}
            scheduledFor={flow.scheduledFor}
            setScheduledFor={flow.setScheduledFor}
            userSites={flow.userSites}
            selectedSiteId={flow.selectedSiteId}
            loadingSites={flow.loadingSites}
            onSelectSite={flow.setSelectedSiteId}
            onAddSite={() => setSitesVisible(true)}
          />
        )}

        {flow.step === "payment" && (
          <PaymentStep
            price={flow.price}
            size={flow.size!}
            mode={flow.mode}
            priorityMode={flow.priorityMode}
            scheduledFor={flow.scheduledFor}
            onPay={flow.handleConfirmPayment}
            onCancel={flow.handleCancelBeforePayment}
            loading={flow.loading}
          />
        )}

        {flow.step === "batch" && flow.requestResp && (
          <BatchStep
            requestResp={flow.requestResp}
            liveData={flow.liveData}
            liveLoading={flow.liveLoading}
            liveError={flow.liveError}
            size={flow.size!}
            price={flow.price}
            paymentDeadline={flow.requestResp.payment_deadline}
            onLeave={flow.handleLeave}
            onRefresh={flow.fetchLive}
            onViewTanker={() => flow.setStep("tanker")}
          />
        )}

        {(flow.step === "searching" || flow.step === "tanker") && (
          <TankerStep
            mode={flow.mode}
            liveData={flow.liveData}
            requestResp={flow.requestResp}
            liveLoading={flow.liveLoading}
            liveError={flow.liveError}
            size={flow.size}
            onArrived={() => flow.setStep("delivery")}
            onRefresh={flow.fetchLive}
          />
        )}

        {flow.step === "delivery" && flow.requestResp && (
          <DeliveryStep
            mode={flow.mode}
            liveData={flow.liveData}
            liveLoading={flow.liveLoading}
            liveError={flow.liveError}
            onConfirm={() => flow.setStep("completed")}
            onReportIncident={() => setIncidentVisible(true)}
          />
        )}

        {flow.step === "completed" && (
          <CompletedStep
            size={flow.size!}
            requestMode={flow.mode}
            priorityMode={flow.priorityMode}
            scheduledFor={flow.scheduledFor}
            price={flow.price}
            otp={flow.otp}
            onHome={flow.handleStartNewRequest}
          />
        )}

        {flow.step === "failed" && (
          <FailedStep onHome={flow.handleStartNewRequest} />
        )}
      </ScrollView>

      <OrderHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        user={flow.user}
        theme={theme}
      />

      {flow.user && (
        <ProfileModal
          visible={profileVisible}
          user={flow.user}
          theme={theme}
          onClose={() => setProfileVisible(false)}
          onSaved={(updated) => { flow.setUser(updated); setProfileVisible(false); }}
        />
      )}

      {flow.user && (
        <SitesModal
          visible={sitesVisible}
          user={flow.user}
          theme={theme}
          onClose={() => {
            setSitesVisible(false);
            if (flow.step === "request") flow.loadSites(flow.user!.id);
          }}
        />
      )}

      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        batchId={flow.requestResp?.batch_id ?? null}
        requestId={flow.requestResp?.request_id ?? null}
      />

      <ReportIncidentModal
        visible={incidentVisible}
        onClose={() => setIncidentVisible(false)}
        batchId={flow.requestResp?.batch_id ?? null}
        userId={flow.user?.id ?? null}
      />
    </SafeAreaView>
  );
}
