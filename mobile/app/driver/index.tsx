import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef, useState } from "react";
import { router } from "expo-router";
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
import { DriverHelpModal } from "@/components/driver/HelpModal";
import { ReportIncidentModal } from "@/components/driver/ReportIncidentModal";
import { DeliveryHistoryModal } from "@/components/driver/DeliveryHistoryModal";
import { EarningsModal } from "@/components/driver/EarningsModal";

const OFFLINE_REASONS = [
  { key: "breakdown", label: "Breakdown / Vehicle issue" },
  { key: "emergency", label: "Personal emergency" },
  { key: "technical", label: "Technical problem" },
  { key: "other", label: "Other" },
] as const;

export default function DriverFlow() {
  const flow = useDriverFlow();
  const { theme, themeMode, toggleTheme } = useAppTheme();
  const [profileVisible, setProfileVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [incidentVisible, setIncidentVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [earningsVisible, setEarningsVisible] = useState(false);
  const [selectedOfflineReason, setSelectedOfflineReason] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

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
        onOpenHelp={() => setHelpVisible(true)}
        onOpenHistory={() => setHistoryVisible(true)}
        onOpenEarnings={() => setEarningsVisible(true)}
        onOpenNotificationSettings={() =>
          router.push(
            flow.driver
              ? `/driver/settings?actor_id=${flow.driver.tankerId}`
              : "/driver/settings"
          )
        }
        theme={theme}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
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
            onStartLoading={flow.handleStartLoading}
            onLoaded={flow.handleLoaded}
            loading={flow.actionLoading}
            driverLat={flow.driverLocation?.latitude ?? null}
            driverLon={flow.driverLocation?.longitude ?? null}
          />
        )}

        {!flow.loading && flow.step === "delivering" && flow.driver && (
          <DriverDeliveringStep
            key={flow.currentStop?.current_stop?.delivery_id}
            driver={flow.driver}
            currentStop={flow.currentStop}
            onRefresh={flow.pollJob}
            setError={flow.setError}
            onReportIncident={() => setIncidentVisible(true)}
            driverLat={flow.driverLocation?.latitude}
            driverLon={flow.driverLocation?.longitude}
            stopLat={flow.currentStop?.current_stop?.location?.latitude}
            stopLon={flow.currentStop?.current_stop?.location?.longitude}
            scrollViewRef={scrollViewRef}
          />
        )}

        {!flow.loading && flow.step === "completed" && (
          <DriverCompletedStep
            onBackOnline={flow.markCompletedAsAvailable}
            tankerId={flow.driver?.tankerId ?? null}
            deliveryType={flow.job?.assignment_type}
          />
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {flow.driver && (
        <DriverProfileModal
          visible={profileVisible}
          driver={flow.driver}
          theme={theme}
          onClose={() => setProfileVisible(false)}
          onSaved={(updated) => { flow.setDriver(updated); setProfileVisible(false); }}
        />
      )}

      <DriverHelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        batchId={flow.job?.active_job?.batch_id ?? flow.job?.batch_id ?? null}
        tankerId={flow.driver?.tankerId ?? null}
      />

      <DeliveryHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        tankerId={flow.driver?.tankerId ?? null}
      />

      <EarningsModal
        visible={earningsVisible}
        onClose={() => setEarningsVisible(false)}
        tankerId={flow.driver?.tankerId ?? null}
      />

      <ReportIncidentModal
        visible={incidentVisible}
        onClose={() => setIncidentVisible(false)}
        batchId={flow.job?.active_job?.batch_id ?? flow.job?.batch_id ?? null}
        tankerId={flow.driver?.tankerId ?? null}
        deliveryRecordId={flow.currentStop?.current_stop?.id ?? null}
      />

      <Modal
        visible={flow.showOfflineModal}
        transparent
        animationType="fade"
        onRequestClose={flow.cancelOfflineModal}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
          onPress={flow.cancelOfflineModal}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: theme.foreground, marginBottom: 8 }}>
                Going offline during delivery?
              </Text>
              <Text style={{ fontSize: 14, color: theme.mutedForeground, marginBottom: 20, lineHeight: 20 }}>
                You have an active job. Going offline will cancel your current assignment and affect your driver rating. Please select a reason.
              </Text>

              {OFFLINE_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setSelectedOfflineReason(r.key)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    marginBottom: 8,
                    borderWidth: 1.5,
                    borderColor: selectedOfflineReason === r.key ? theme.primary : theme.border,
                    backgroundColor: selectedOfflineReason === r.key ? theme.primarySoft ?? theme.card : theme.card,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: selectedOfflineReason === r.key ? theme.primary : theme.mutedForeground,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    {selectedOfflineReason === r.key && (
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary }} />
                    )}
                  </View>
                  <Text style={{ color: theme.foreground, fontSize: 14 }}>{r.label}</Text>
                </TouchableOpacity>
              ))}

              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => { setSelectedOfflineReason(null); flow.cancelOfflineModal(); }}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: "center" }}
                >
                  <Text style={{ color: theme.foreground, fontWeight: "600" }}>Stay Online</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedOfflineReason) return;
                    flow.confirmOffline(selectedOfflineReason);
                    setSelectedOfflineReason(null);
                  }}
                  disabled={!selectedOfflineReason}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 10,
                    backgroundColor: selectedOfflineReason ? theme.destructive : theme.muted,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: selectedOfflineReason ? "#fff" : theme.mutedForeground, fontWeight: "600" }}>Go Offline</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
