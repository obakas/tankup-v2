import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useToast } from "@/hooks/useToast";
import { ToastMessage } from "@/components/ui/ToastMessage";
import {
  fetchDriverEarnings,
  submitSiteReport,
  skipSiteReport,
  type DriverEarningOut,
  type SiteReportPayload,
} from "@/lib/api";

type TankHeight = "ground" | "first_floor" | "second_floor" | "third_floor" | "rooftop";

const DIFF_COLORS: Record<number, string> = {
  1: "#22c55e",
  2: "#84cc16",
  3: "#f59e0b",
  4: "#f97316",
  5: "#ef4444",
};

const TANK_HEIGHTS: { key: TankHeight; label: string }[] = [
  { key: "ground", label: "Ground" },
  { key: "first_floor", label: "1st Fl." },
  { key: "second_floor", label: "2nd Fl." },
  { key: "third_floor", label: "3rd Fl." },
  { key: "rooftop", label: "Rooftop" },
];

function DifficultyRow({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  return (
    <View className="gap-2">
      <Text style={{ color: theme.mutedForeground }} className="text-xs">
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Easy</Text>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          const color = DIFF_COLORS[n];
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: active ? color : theme.border,
                backgroundColor: active ? color + "28" : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: active ? color : theme.mutedForeground,
                  fontWeight: active ? "700" : "400",
                  fontSize: 13,
                }}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
        <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Very bad</Text>
      </View>
    </View>
  );
}

function SiteForm({
  earning,
  stopIndex,
  total,
  tankerId,
  onDone,
  theme,
}: {
  earning: DriverEarningOut;
  stopIndex: number;
  total: number;
  tankerId: number;
  onDone: (credited: boolean) => void;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  const [tankHeight, setTankHeight] = useState<TankHeight | null>(null);
  const [hoseDiff, setHoseDiff] = useState<number | null>(null);
  const [roadDiff, setRoadDiff] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload: SiteReportPayload = {
        tank_height_category: tankHeight,
        hose_difficulty: hoseDiff,
        road_difficulty: roadDiff,
      };
      await submitSiteReport(tankerId, earning.delivery_record_id, payload);
      onDone(true);
    } catch {
      onDone(false);
    } finally {
      setSubmitting(false);
    }
  }, [tankerId, earning.delivery_record_id, tankHeight, hoseDiff, roadDiff, onDone]);

  const handleSkip = useCallback(async () => {
    try {
      await skipSiteReport(tankerId, earning.delivery_record_id);
    } catch {
      // silent
    }
    onDone(false);
  }, [tankerId, earning.delivery_record_id, onDone]);

  return (
    <View
      style={{
        backgroundColor: theme.successSoft,
        borderRadius: 16,
        padding: 16,
        gap: 16,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-1">
          <Text style={{ color: theme.foreground }} className="text-sm font-bold">
            Site notes {total > 1 ? `(stop ${stopIndex + 1}/${total})` : ""}
          </Text>
          <Text style={{ color: theme.success }} className="text-xs font-semibold">
            Submit to earn +₦1,000 bonus
          </Text>
        </View>
      </View>

      {/* Tank height pills */}
      <View className="gap-2">
        <Text style={{ color: theme.mutedForeground }} className="text-xs">
          Tank height
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {TANK_HEIGHTS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setTankHeight(key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: tankHeight === key ? theme.success : theme.border,
                backgroundColor: tankHeight === key ? theme.successSoft : theme.card,
              }}
            >
              <Text
                style={{
                  color: tankHeight === key ? theme.success : theme.mutedForeground,
                  fontSize: 12,
                  fontWeight: tankHeight === key ? "700" : "400",
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <DifficultyRow
        label="Hose difficulty"
        value={hoseDiff}
        onChange={setHoseDiff}
        theme={theme}
      />

      <DifficultyRow
        label="Road condition"
        value={roadDiff}
        onChange={setRoadDiff}
        theme={theme}
      />

      <View className="flex-row gap-3 items-center">
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            flex: 1,
            backgroundColor: submitting ? theme.border : theme.success,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          {submitting ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text style={{ color: theme.primaryForeground }} className="font-semibold">
              Submit (+₦1,000)
            </Text>
          )}
        </Pressable>

        <Pressable onPress={handleSkip} disabled={submitting} className="px-4 py-3">
          <Text style={{ color: theme.mutedForeground }} className="text-sm">
            Skip
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function DriverCompletedStep({
  onBackOnline,
  tankerId,
  deliveryType,
}: {
  onBackOnline: () => void;
  tankerId: number | null;
  deliveryType?: string;
}) {
  const { theme } = useAppTheme();
  const { toast, showToast } = useToast();

  const [allEarnings, setAllEarnings] = useState<DriverEarningOut[]>([]);
  const [pendingEarnings, setPendingEarnings] = useState<DriverEarningOut[]>([]);
  const [formIndex, setFormIndex] = useState(0);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [bonusCredited, setBonusCredited] = useState(0);

  useEffect(() => {
    if (!tankerId) {
      setLoadingEarnings(false);
      return;
    }
    let mounted = true;
    async function load() {
      try {
        const data = await fetchDriverEarnings(tankerId!, "today");
        if (!mounted) return;
        const all = data.jobs.flatMap((g) => g.stops);
        const pending = all.filter((s) => s.site_bonus === null);
        setAllEarnings(all);
        setPendingEarnings(pending);
      } catch {
        // don't block completion on fetch failure
      } finally {
        if (mounted) setLoadingEarnings(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [tankerId]);

  const handleFormDone = useCallback(
    (credited: boolean) => {
      if (credited) {
        const newTotal = bonusCredited + 1000;
        setBonusCredited(newTotal);
        showToast(`₦1,000 site bonus credited! Total: ₦${newTotal.toLocaleString("en-NG")}`);
      }
      setFormIndex((i) => i + 1);
    },
    [bonusCredited, showToast]
  );

  const formsRemaining = pendingEarnings.length - formIndex;
  const allFormsDone = !loadingEarnings && formsRemaining <= 0;

  return (
    <View className="gap-5 items-center py-8">
      <ToastMessage toast={toast} theme={theme} />

      <View
        className="w-24 h-24 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.successSoft }}
      >
        <CheckCircle2 color={theme.success} size={48} />
      </View>

      <View className="items-center gap-2">
        <Text className="text-2xl font-bold" style={{ color: theme.foreground }}>
          Job Complete!
        </Text>
        <Text className="text-center text-sm leading-5" style={{ color: theme.mutedForeground }}>
          All stops delivered. Great work!
        </Text>
        {bonusCredited > 0 && (
          <Text className="text-sm font-semibold" style={{ color: theme.success }}>
            +₦{bonusCredited.toLocaleString("en-NG")} site bonus earned
          </Text>
        )}
      </View>

      {/* Trip Summary */}
      {!loadingEarnings && (
        <View
          className="w-full rounded-2xl p-4 gap-3"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <Text style={{ color: theme.foreground }} className="font-bold text-sm">
            Trip Summary
          </Text>
          <View style={{ gap: 8 }}>
            <View className="flex-row justify-between">
              <Text style={{ color: theme.mutedForeground }} className="text-sm">Delivery type</Text>
              <Text style={{ color: theme.foreground }} className="text-sm font-semibold capitalize">
                {deliveryType ?? "—"}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text style={{ color: theme.mutedForeground }} className="text-sm">Stops completed</Text>
              <Text style={{ color: theme.foreground }} className="text-sm font-semibold">
                {allEarnings.length} {allEarnings.length === 1 ? "stop" : "stops"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Site forms */}
      {!loadingEarnings && pendingEarnings.length > 0 && formIndex < pendingEarnings.length && tankerId && (
        <View className="w-full">
          <SiteForm
            earning={pendingEarnings[formIndex]}
            stopIndex={formIndex}
            total={pendingEarnings.length}
            tankerId={tankerId}
            onDone={handleFormDone}
            theme={theme}
          />
        </View>
      )}

      {/* Earnings summary — shown after all forms resolved */}
      {allFormsDone && allEarnings.length > 0 && (() => {
        const alreadyCredited = allEarnings.filter((s) => s.site_bonus === 1000).length * 1000;
        const totalVolume = allEarnings.reduce((s, e) => s + e.volume_earnings, 0);
        const totalStop = allEarnings.reduce((s, e) => s + e.stop_bonus, 0);
        const grandTotal = totalVolume + totalStop + alreadyCredited + bonusCredited;
        const fmt = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
        return (
          <View
            className="w-full rounded-2xl p-4 gap-3"
            style={{ backgroundColor: theme.successSoft, borderWidth: 1, borderColor: theme.success + "30" }}
          >
            <Text style={{ color: theme.foreground }} className="font-bold text-sm">
              Job Earnings
            </Text>

            <View style={{ gap: 8 }}>
              <View className="flex-row justify-between">
                <Text style={{ color: theme.mutedForeground }} className="text-sm">Delivery pay</Text>
                <Text style={{ color: theme.foreground }} className="text-sm font-semibold">{fmt(totalVolume)}</Text>
              </View>

              {totalStop > 0 && (
                <View className="flex-row justify-between">
                  <Text style={{ color: theme.mutedForeground }} className="text-sm">
                    Stop bonuses ({allEarnings.length} stop{allEarnings.length !== 1 ? "s" : ""})
                  </Text>
                  <Text style={{ color: theme.foreground }} className="text-sm font-semibold">+{fmt(totalStop)}</Text>
                </View>
              )}

              {(alreadyCredited + bonusCredited) > 0 && (
                <View className="flex-row justify-between">
                  <Text style={{ color: theme.success }} className="text-sm">Site verification bonuses</Text>
                  <Text style={{ color: theme.success }} className="text-sm font-semibold">+{fmt(alreadyCredited + bonusCredited)}</Text>
                </View>
              )}

              <View
                style={{ borderTopWidth: 1, borderTopColor: theme.success + "40", paddingTop: 8, marginTop: 2 }}
                className="flex-row justify-between"
              >
                <Text style={{ color: theme.foreground }} className="font-bold">Total earnings</Text>
                <Text style={{ color: theme.success }} className="font-bold text-base">{fmt(grandTotal)}</Text>
              </View>
            </View>
          </View>
        );
      })()}

      {(allFormsDone || (!loadingEarnings && pendingEarnings.length === 0)) && (
        <Pressable
          onPress={onBackOnline}
          className="w-full rounded-xl py-4 items-center"
          style={{ backgroundColor: theme.success }}
        >
          <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
            Back Online
          </Text>
        </Pressable>
      )}
    </View>
  );
}
