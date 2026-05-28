import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDriverFlow } from "@/hooks/useDriverFlow";
import { DriverHeader } from "@/components/driver/DriverHeader";
import { DriverAuthStep } from "@/components/driver/DriverAuthStep";
import { DriverOfflineStep } from "@/components/driver/DriverOfflineStep";
import { DriverAvailableStep } from "@/components/driver/DriverAvailableStep";
import { IncomingOfferStep } from "@/components/driver/IncomingOfferStep";
import { DriverLoadingStep } from "@/components/driver/DriverLoadingStep";
import { DriverDeliveringStep } from "@/components/driver/DriverDeliveringStep";
import { DriverCompletedStep } from "@/components/driver/DriverCompletedStep";
import { DriverProfileModal } from "@/components/driver/ProfileModal";
import { useState } from "react";

export default function DriverFlow() {
  const flow = useDriverFlow();
  const { theme, themeMode, toggleTheme } = useAppTheme();
  const [profileVisible, setProfileVisible] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <DriverHeader
        title={flow.titles[flow.step]}
        driver={flow.driver}
        online={flow.online}
        onBack={flow.back}
        onToggleOnline={flow.toggleOnline}
        onEditProfile={() => setProfileVisible(true)}
        onLogout={flow.goRoleHome}
        theme={theme}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        {flow.error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-red-600">{flow.error}</Text>
          </View>
        )}

        {flow.loading && (
          <View className="items-center py-8">
            <ActivityIndicator color={theme.success} size="large" />
          </View>
        )}

        {!flow.loading && flow.step === "auth" && (
          <DriverAuthStep onComplete={flow.handleAuthComplete} />
        )}

        {!flow.loading && flow.step === "offline" && <DriverOfflineStep />}

        {!flow.loading && flow.step === "available" && (
          <DriverAvailableStep onRefresh={flow.pollOffer} />
        )}

        {!flow.loading && flow.step === "incoming" && flow.offer && (
          <IncomingOfferStep
            offer={flow.offer}
            onAccept={flow.handleAcceptOffer}
            onDecline={flow.handleRejectOffer}
            loading={flow.actionLoading}
          />
        )}

        {!flow.loading && flow.step === "loading" && flow.job && (
          <DriverLoadingStep
            job={flow.job}
            onLoaded={flow.handleLoaded}
            loading={flow.actionLoading}
          />
        )}

        {!flow.loading && flow.step === "delivering" && flow.driver && (
          <DriverDeliveringStep
            driver={flow.driver}
            job={flow.job}
            currentStop={flow.currentStop}
            onRefresh={flow.pollJob}
            onCompleteJob={flow.handleCompleteJob}
            actionLoading={flow.actionLoading}
            setError={flow.setError}
          />
        )}

        {!flow.loading && flow.step === "completed" && (
          <DriverCompletedStep onBackOnline={flow.markCompletedAsAvailable} />
        )}
      </ScrollView>

      {flow.driver && (
        <DriverProfileModal
          visible={profileVisible}
          driver={flow.driver}
          theme={theme}
          onClose={() => setProfileVisible(false)}
          onSaved={(updated) => { flow.setDriver(updated); setProfileVisible(false); }}
        />
      )}
    </SafeAreaView>
  );
}
