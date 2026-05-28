// app/(client)/index.tsx

import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
import { useAppTheme } from "@/hooks/useAppTheme";
import { useState } from "react";
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


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ClientHeader
        title={flow.titles[flow.step]}
        // stepLabel={flow.step.toUpperCase()}
        user={flow.user}
        onBack={flow.back}
        onLogout={flow.goRoleHome}
        onEditProfile={() => setProfileVisible(true)}
        onOpenSites={() => setSitesVisible(true)}
        theme={theme}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        alertsEnabled={alertsEnabled}
        onToggleAlerts={() => setAlertsEnabled((prev) => !prev)}
        onOpenHistory={() => setHistoryVisible(true)}
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

        {flow.step === "payment" && flow.requestResp && (
          <PaymentStep
            price={flow.price}
            size={flow.size!}
            mode={flow.mode}
            requestResp={flow.requestResp}
            onPay={flow.handleConfirmPayment}
            onCancel={() => flow.setStep("request")}
            loading={flow.loading}
          />
        )}

        {flow.step === "batch" && flow.requestResp && (
          <BatchStep
            requestResp={flow.requestResp}
            liveData={flow.liveData}
            liveLoading={flow.liveLoading}
            size={flow.size!}
            price={flow.price}
            onLeave={flow.handleLeave}
            onRefresh={flow.fetchLive}
            onViewTanker={() => flow.setStep("tanker")}
          />
        )}

        {flow.step === "tanker" && (
          <TankerStep
            mode={flow.mode}
            liveData={flow.liveData}
            requestResp={flow.requestResp}
          />
        )}

        {flow.step === "delivery" && flow.requestResp && (
          <DeliveryStep
            mode={flow.mode}
            liveData={flow.liveData}
            requestResp={flow.requestResp}
          />
        )}

        {flow.step === "completed" && (
          <CompletedStep
            size={flow.size!}
            price={flow.price}
            liveData={flow.liveData}
            onHome={flow.goRoleHome}
          />
        )}

        {flow.step === "failed" && (
          <FailedStep onHome={flow.goRoleHome} />
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
    </SafeAreaView>
  );
}