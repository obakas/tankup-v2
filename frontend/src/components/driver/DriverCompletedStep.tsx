import { useState, useEffect } from "react";
import { CheckCircle2, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DriverJob, DriverStop } from "@/types/driver";
import {
  fetchDriverEarnings,
  submitSiteReport,
  skipSiteReport,
  type DriverEarningOut,
  type SiteReportPayload,
} from "@/lib/driverApi";

type TankHeight = "ground" | "first_floor" | "second_floor" | "third_floor" | "rooftop";

const TANK_HEIGHTS: { key: TankHeight; label: string }[] = [
  { key: "ground", label: "Ground" },
  { key: "first_floor", label: "1st Floor" },
  { key: "second_floor", label: "2nd Floor" },
  { key: "third_floor", label: "3rd Floor" },
  { key: "rooftop", label: "Rooftop" },
];

function DifficultyPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-full text-sm font-semibold border transition ${
              value === n
                ? "bg-success text-success-foreground border-success"
                : "border-border text-muted-foreground hover:border-success/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function SiteForm({
  earning,
  stopIndex,
  total,
  tankerId,
  onDone,
}: {
  earning: DriverEarningOut;
  stopIndex: number;
  total: number;
  tankerId: number;
  onDone: (credited: boolean) => void;
}) {
  const [tankHeight, setTankHeight] = useState<TankHeight | null>(null);
  const [hoseDiff, setHoseDiff] = useState<number | null>(null);
  const [roadDiff, setRoadDiff] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: SiteReportPayload = {
        tank_height_category: tankHeight,
        hose_difficulty: hoseDiff,
        road_difficulty: roadDiff,
      };
      await submitSiteReport(tankerId, earning.delivery_record_id, payload);
      toast.success("₦1,000 site bonus credited!");
      onDone(true);
    } catch {
      toast.error("Failed to submit site report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      await skipSiteReport(tankerId, earning.delivery_record_id);
    } catch {
      // silently ignore skip errors
    }
    onDone(false);
  };

  return (
    <div className="rounded-xl border border-success/20 bg-success/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            Site notes {total > 1 ? `(stop ${stopIndex + 1}/${total})` : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submit to earn <span className="font-bold text-success">+₦1,000 bonus</span>
          </p>
        </div>
        <Leaf className="h-5 w-5 text-success" />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Tank height</p>
        <div className="flex flex-wrap gap-2">
          {TANK_HEIGHTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTankHeight(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                tankHeight === key
                  ? "bg-success text-success-foreground border-success"
                  : "border-border text-muted-foreground hover:border-success/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <DifficultyPicker label="Hose difficulty (1=easy, 5=very hard)" value={hoseDiff} onChange={setHoseDiff} />
      <DifficultyPicker label="Road condition (1=easy, 5=very bad)" value={roadDiff} onChange={setRoadDiff} />

      <div className="flex gap-3 pt-1">
        <Button
          className="flex-1 h-11 rounded-xl"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit (+₦1,000)"}
        </Button>
        <button
          onClick={handleSkip}
          disabled={submitting}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

interface DriverCompletedStepProps {
  job: DriverJob;
  deliveries: DriverStop[];
  onBackToDashboard: () => void;
  tankerId: number;
}

export const DriverCompletedStep = ({
  job,
  deliveries,
  onBackToDashboard,
  tankerId,
}: DriverCompletedStepProps) => {
  const [allEarnings, setAllEarnings] = useState<DriverEarningOut[]>([]);
  const [pendingEarnings, setPendingEarnings] = useState<DriverEarningOut[]>([]);
  const [formIndex, setFormIndex] = useState(0);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [bonusCredited, setBonusCredited] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await fetchDriverEarnings(tankerId, "today");
        if (!mounted) return;
        const all = data.jobs.flatMap((g) => g.stops);
        const pending = all.filter((s) => s.site_bonus === null);
        setAllEarnings(all);
        setPendingEarnings(pending);
      } catch {
        // if fetch fails, just show no forms — don't block completion
      } finally {
        if (mounted) setLoadingEarnings(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [tankerId]);

  const formsShown = !loadingEarnings;
  const formsRemaining = pendingEarnings.length - formIndex;
  const allFormsDone = formsShown && formsRemaining <= 0;

  const handleFormDone = (credited: boolean) => {
    if (credited) setBonusCredited((n) => n + 1000);
    setFormIndex((i) => i + 1);
  };

  return (
    <div className="space-y-6 py-10 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-12 w-12 text-success" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">Delivery Complete!</h2>
        <p className="mt-2 text-muted-foreground">
          {deliveries.length} {deliveries.length === 1 ? "delivery" : "deliveries"} confirmed
        </p>
      </div>

      <div className="rounded-xl border border-success/20 bg-success/5 p-6">
        <p className="text-sm text-muted-foreground">Total delivered</p>
        <p className="text-4xl font-extrabold text-success">
          {(job.totalVolumeLiters ?? 0).toLocaleString()}L
        </p>
        {bonusCredited > 0 && (
          <p className="mt-2 text-sm font-semibold text-success">
            +₦{bonusCredited.toLocaleString("en-NG")} site bonus earned!
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 text-left">
        <h3 className="mb-3 font-semibold text-foreground">Trip Summary</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Job</span>
            <span className="font-medium text-foreground">#{job.jobId}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium capitalize text-foreground">{job.jobType}</span>
          </div>

          {job.liquidName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Liquid</span>
              <span className="font-medium text-foreground">{job.liquidName}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Total delivered</span>
            <span className="font-medium text-foreground">
              {(job.totalVolumeLiters ?? 0).toLocaleString()}L
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Stops</span>
            <span className="font-medium text-foreground">{deliveries.length} completed</span>
          </div>
        </div>
      </div>

      {/* Site intelligence forms — shown one at a time */}
      {formsShown && pendingEarnings.length > 0 && formIndex < pendingEarnings.length && (
        <SiteForm
          earning={pendingEarnings[formIndex]}
          stopIndex={formIndex}
          total={pendingEarnings.length}
          tankerId={tankerId}
          onDone={handleFormDone}
        />
      )}

      {/* Earnings summary — shown after all forms resolved */}
      {allFormsDone && allEarnings.length > 0 && (() => {
        const alreadyCredited = allEarnings.filter((s) => s.site_bonus === 1000).length * 1000;
        const totalVolume = allEarnings.reduce((s, e) => s + e.volume_earnings, 0);
        const totalStop = allEarnings.reduce((s, e) => s + e.stop_bonus, 0);
        const grandTotal = totalVolume + totalStop + alreadyCredited + bonusCredited;
        const fmt = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
        return (
          <div className="rounded-xl border border-success/30 bg-success/5 p-5 text-left">
            <h3 className="mb-3 font-semibold text-foreground">Job Earnings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery pay</span>
                <span className="font-medium">{fmt(totalVolume)}</span>
              </div>
              {totalStop > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Stop bonuses ({allEarnings.length} stop{allEarnings.length !== 1 ? "s" : ""})
                  </span>
                  <span className="font-medium">+{fmt(totalStop)}</span>
                </div>
              )}
              {(alreadyCredited + bonusCredited) > 0 && (
                <div className="flex justify-between">
                  <span className="text-success">Site verification bonuses</span>
                  <span className="font-semibold text-success">+{fmt(alreadyCredited + bonusCredited)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/60 pt-2 mt-1 font-bold text-base">
                <span>Total earnings</span>
                <span className="text-success">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {(allFormsDone || !formsShown) && (
        <Button
          variant="default"
          className="h-14 w-full rounded-xl text-base"
          onClick={onBackToDashboard}
        >
          Back to Dashboard
        </Button>
      )}
    </div>
  );
};
