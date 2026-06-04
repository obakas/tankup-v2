import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BatchLiveResponse } from "@/lib/batches";

const PRESET_VOLUMES = [500, 1000, 2000, 5000];

function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type UrgencyLevel = "calm" | "warning" | "critical";

function getUrgency(seconds: number | null | undefined): UrgencyLevel {
    if (seconds == null) return "calm";
    if (seconds < 600) return "critical";
    if (seconds < 1800) return "warning";
    return "calm";
}

interface BatchBoostCardProps {
    liveBatch: BatchLiveResponse;
    onBoost: (additionalVolume: number) => void;
    isLoading?: boolean;
}

export function BatchBoostCard({ liveBatch, onBoost, isLoading }: BatchBoostCardProps) {
    const remainingCapacity = liveBatch.remaining_capacity_liters ?? 0;
    const boostCostPerLiter = liveBatch.boost_cost_per_liter ?? 0;
    const [countdown, setCountdown] = useState(liveBatch.time_until_expiry_seconds ?? null);
    const [selected, setSelected] = useState<number | null>(null);

    useEffect(() => {
        const initial = liveBatch.time_until_expiry_seconds ?? null;
        setCountdown(initial);
        if (initial == null || initial <= 0) return undefined;
        const id = setInterval(() => {
            setCountdown((prev) => (prev != null && prev > 1 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(id);
    }, [liveBatch.time_until_expiry_seconds]);

    const urgency = getUrgency(countdown);

    const presets = PRESET_VOLUMES.filter((v) => v <= remainingCapacity);
    if (presets.length === 0) return null;

    const borderClass =
        urgency === "critical"
            ? "border-destructive/60 bg-destructive/5"
            : urgency === "warning"
            ? "border-orange-400/60 bg-orange-50 dark:bg-orange-950/20"
            : "border-amber-400/60 bg-amber-50 dark:bg-amber-950/20";

    const headingColor =
        urgency === "critical"
            ? "text-destructive"
            : urgency === "warning"
            ? "text-orange-600 dark:text-orange-400"
            : "text-amber-700 dark:text-amber-400";

    const headline =
        urgency === "critical"
            ? "Last chance — batch filling fast!"
            : urgency === "warning"
            ? `Only ${countdown != null ? formatCountdown(countdown) : "—"} left — boost now!`
            : "Boost your batch for faster delivery";

    const buttonClass =
        urgency === "critical"
            ? "bg-destructive hover:bg-destructive/90 text-white"
            : urgency === "warning"
            ? "bg-orange-500 hover:bg-orange-600 text-white"
            : "bg-amber-500 hover:bg-amber-600 text-white";

    return (
        <div className={`rounded-2xl border p-5 ${borderClass}`}>
            <div className="flex items-center gap-2 mb-1">
                <Zap className={`h-5 w-5 ${headingColor}`} fill="currentColor" />
                <p className={`font-bold text-base ${headingColor}`}>
                    {urgency === "calm" ? "Want faster dispatch?" : "Boost Your Batch"}
                </p>
            </div>

            <p className={`text-sm font-medium mb-1 ${headingColor}`}>{headline}</p>

            {countdown != null && urgency === "calm" && (
                <p className="text-xs text-muted-foreground mb-3">
                    {formatCountdown(countdown)} remaining
                </p>
            )}

            <p className="text-sm text-muted-foreground mb-4">
                {remainingCapacity.toLocaleString()}L still available. Claim more water to push this batch toward dispatch.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
                {presets.map((vol) => {
                    const cost = boostCostPerLiter * vol;
                    const isSelected = selected === vol;
                    return (
                        <button
                            key={vol}
                            type="button"
                            onClick={() => setSelected(vol)}
                            className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                                isSelected
                                    ? urgency === "critical"
                                        ? "border-destructive bg-destructive/10"
                                        : urgency === "warning"
                                        ? "border-orange-500 bg-orange-100 dark:bg-orange-950/40"
                                        : "border-amber-500 bg-amber-100 dark:bg-amber-950/40"
                                    : "border-border bg-card"
                            }`}
                        >
                            <p className={`text-sm font-bold ${isSelected ? headingColor : "text-foreground"}`}>
                                +{vol.toLocaleString()}L
                            </p>
                            <p className="text-xs text-muted-foreground">
                                ₦{cost.toLocaleString()}
                            </p>
                        </button>
                    );
                })}
            </div>

            <Button
                type="button"
                disabled={!selected || isLoading}
                onClick={() => { if (selected) onBoost(selected); }}
                className={`w-full gap-2 ${buttonClass}`}
            >
                <Zap className="h-4 w-4" fill="currentColor" />
                {isLoading
                    ? "Applying boost..."
                    : selected
                    ? `Boost +${selected.toLocaleString()}L`
                    : "Select an amount above"}
            </Button>
        </div>
    );
}
