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
      <View className="flex-row gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: value === n ? theme.success : theme.border,
              backgroundColor: value === n ? theme.successSoft : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: value === n ? theme.success : theme.mutedForeground,
                fontWeight: value === n ? "700" : "400",
                fontSize: 13,
              }}
            >
              {n}
            </Text>
          </Pressable>
        ))}
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
        label="Hose difficulty (1=easy, 5=very hard)"
        value={hoseDiff}
        onChange={setHoseDiff}
        theme={theme}
      />

      <DifficultyRow
        label="Road condition (1=easy, 5=very bad)"
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
}: {
  onBackOnline: () => void;
  tankerId: number | null;
}) {
  const { theme } = useAppTheme();
  const { toast, showToast } = useToast();

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
        const pending = data.jobs
          .flatMap((g) => g.stops)
          .filter((s) => s.site_bonus === null);
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

      {allFormsDone && (
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

      {/* Show button immediately if no pending forms and not loading */}
      {!loadingEarnings && pendingEarnings.length === 0 && (
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
