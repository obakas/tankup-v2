import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Droplets, Loader2, MapPin, Plus, Users, Zap, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TANK_SIZES,
  BATCH_PRICE_PER_LITER,
  PRIORITY_FULL_TANKER_PRICE,
  PLATFORM_BATCH_COMMISSION_RATE,
  PLATFORM_PRIORITY_COMMISSION_RATE,
} from "@/constants/water";
import type { RequestMode } from "@/types/client";
import { formatScheduledDateTime } from "@/lib/utils";
import type { SiteProfileResponse } from "@/lib/api";

interface RequestStepProps {
  requestMode: RequestMode;
  selectedSize: number | null;
  canContinueToPayment: boolean;
  onSelectMode: (mode: RequestMode) => void;
  onSelectSize: (size: number) => void;
  onContinue: () => void;
  onCancel: () => void;

  priorityMode: "asap" | "scheduled";
  scheduledFor: string;
  onSelectPriorityMode: (mode: "asap" | "scheduled") => void;
  onSetScheduledFor: (value: string) => void;

  userSites: SiteProfileResponse[];
  selectedSiteId: number | null;
  loadingSites: boolean;
  onSelectSite: (siteId: number) => void;
  onAddSite: () => void;
}

const RequestStep = ({
  requestMode,
  selectedSize,
  canContinueToPayment,
  onSelectMode,
  onSelectSize,
  onContinue,
  onCancel,
  priorityMode,
  scheduledFor,
  onSelectPriorityMode,
  onSetScheduledFor,
  userSites,
  selectedSiteId,
  loadingSites,
  onSelectSite,
  onAddSite,
}: RequestStepProps) => {
  const selectedSite = userSites.find(s => s.id === selectedSiteId);

  const ac = requestMode === "priority"
    ? { text: "text-warning", selectedCard: "border-warning bg-warning/5 shadow-md shadow-warning/10", unselectedCard: "border-border bg-card hover:border-warning/30", iconBg: "bg-warning/10", iconText: "text-warning" }
    : { text: "text-primary", selectedCard: "border-primary bg-primary/5 shadow-md shadow-primary/10", unselectedCard: "border-border bg-card hover:border-primary/30", iconBg: "bg-primary/10", iconText: "text-primary" };

  const [batchTimingMode, setBatchTimingMode] = useState<"now" | "schedule">("now");
  const [selectedDay, setSelectedDay] = useState<0 | 1 | 2>(1);
  const [selectedBlock, setSelectedBlock] = useState<"morning" | "afternoon">("morning");

  useEffect(() => {
    if (requestMode !== "batch" || batchTimingMode === "now") {
      if (requestMode === "batch") onSetScheduledFor("");
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + selectedDay);
    d.setHours(selectedBlock === "morning" ? 7 : 12, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    onSetScheduledFor(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
    );
  }, [requestMode, batchTimingMode, selectedDay, selectedBlock]);

  useEffect(() => {
    setBatchTimingMode("now");
    onSetScheduledFor("");
  }, [requestMode]);

  const effectiveSize =
    requestMode === "priority" && selectedSite?.tank_capacity_liters
      ? selectedSite.tank_capacity_liters
      : selectedSize;

  useEffect(() => {
    if (requestMode === "priority" && selectedSite?.tank_capacity_liters) {
      onSelectSize(selectedSite.tank_capacity_liters);
    }
  }, [requestMode, selectedSite?.tank_capacity_liters]);

  const price =
    requestMode === "priority"
      ? PRIORITY_FULL_TANKER_PRICE * PLATFORM_PRIORITY_COMMISSION_RATE +
      PRIORITY_FULL_TANKER_PRICE
      : effectiveSize
        ? effectiveSize * BATCH_PRICE_PER_LITER * PLATFORM_BATCH_COMMISSION_RATE +
        effectiveSize * BATCH_PRICE_PER_LITER
        : 0;

  const isOverCapacity =
    requestMode === "batch" &&
    selectedSize !== null &&
    (selectedSite?.tank_capacity_liters ?? 0) > 0 &&
    selectedSize > selectedSite!.tank_capacity_liters!;

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Droplets className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Choose your delivery option
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick the plan that works best for you
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => onSelectMode("batch")}
          className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-200 ${requestMode === "batch"
            ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
            : "border-border bg-card hover:border-primary/30"
            }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Standard Delivery</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  Lower Cost
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Share a tanker with nearby customers and pay less. Delivery
                starts once the route is filled.
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onSelectMode("priority")}
          className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-200 ${requestMode === "priority"
            ? "border-warning bg-warning/5 shadow-md"
            : "border-border bg-card hover:border-warning/30"
            }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-warning" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  Exclusive Delivery
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
                  Premium
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                A tanker is reserved exclusively for you. Full delivery to your
                registered site capacity.
              </p>
            </div>
          </div>
        </button>
      </div>

      {requestMode === "priority" && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">
              Choose delivery timing
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Priority delivery requires either ASAP dispatch or an exact delivery
              time.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                onSelectPriorityMode("asap");
                onSetScheduledFor("");
              }}
              className={`rounded-lg border p-3 text-left text-sm transition-all ${priorityMode === "asap"
                ? "border-warning bg-warning/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-warning/30"
                }`}
            >
              <div className="font-medium">ASAP</div>
              <p className="mt-1 text-xs text-muted-foreground">
                We calculate the earliest realistic delivery time after loading
                and dispatch.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSelectPriorityMode("scheduled")}
              className={`rounded-lg border p-3 text-left text-sm transition-all ${priorityMode === "scheduled"
                ? "border-warning bg-warning/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-warning/30"
                }`}
            >
              <div className="font-medium">Schedule Time</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose an exact date and time for delivery.
              </p>
            </button>
          </div>

          {priorityMode === "asap" && (
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
              <p className="text-sm font-medium text-foreground">
                ASAP includes a realistic loading and dispatch buffer
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tankers usually load after a request is placed, so the system
                calculates the earliest realistic delivery time.
              </p>
            </div>
          )}

          {priorityMode === "scheduled" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Select exact delivery date and time
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => onSetScheduledFor(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-warning"
              />
              <p className="text-xs text-muted-foreground">
                Choose a realistic time that gives enough room for loading and
                movement.
              </p>
            </div>
          )}
        </div>
      )}

      {requestMode === "batch" && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-foreground">When do you want delivery?</h3>

          <div className="grid grid-cols-2 gap-3">
            {(["now", "schedule"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setBatchTimingMode(t)}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${batchTimingMode === t
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/30"
                  }`}
              >
                <div className="font-medium">{t === "now" ? "Order now" : "Schedule"}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t === "now" ? "Join the next available batch." : "Pick a future delivery window."}
                </p>
              </button>
            ))}
          </div>

          {batchTimingMode === "schedule" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Day</p>
                <div className="grid grid-cols-3 gap-2">
                  {([0, 1, 2] as const).map((offset) => (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => setSelectedDay(offset)}
                      className={`rounded-lg border py-2 text-sm font-medium transition-all ${selectedDay === offset
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/30"
                        }`}
                    >
                      {offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : "Day after"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Block</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["morning", "afternoon"] as const).map((block) => (
                    <button
                      key={block}
                      type="button"
                      onClick={() => setSelectedBlock(block)}
                      className={`rounded-lg border py-3 text-sm font-medium transition-all ${selectedBlock === block
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/30"
                        }`}
                    >
                      <div>{block === "morning" ? "Morning" : "Afternoon"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {block === "morning" ? "7am – 12pm" : "12pm – 5pm"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {scheduledFor && (
                <div className="flex items-center gap-2 text-primary text-sm">
                  <CalendarClock className="w-4 h-4" />
                  <span className="font-medium">{formatScheduledDateTime(scheduledFor)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {requestMode === "batch" && (
        <div>
          <div className="mb-3">
            <h3 className="font-semibold text-foreground">
              How much water do you need?
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Select your tank size
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TANK_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => onSelectSize(size)}
                className={`rounded-xl border-2 p-4 text-center transition-all duration-200 active:scale-95 ${selectedSize === size
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-border bg-card hover:border-primary/30"
                  }`}
              >
                <span className="text-2xl font-bold text-foreground">
                  {Number(size / 1000).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}
                  k
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {size.toLocaleString()} Liters
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {requestMode === "priority" && selectedSite?.tank_capacity_liters && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Full tank capacity</p>
            <p className="text-xs text-muted-foreground mt-0.5">From your registered site</p>
          </div>
          <span className="text-xl font-bold text-foreground">
            {selectedSite.tank_capacity_liters.toLocaleString()}L
          </span>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Delivery site</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Where should we deliver the water?
            </p>
          </div>
          <button
            onClick={onAddSite}
            className={`flex items-center gap-1 text-sm ${ac.text} hover:underline`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add site
          </button>
        </div>

        {loadingSites ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : userSites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-center">
            <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No sites saved yet.</p>
            <button
              onClick={onAddSite}
              className={`mt-2 text-sm ${ac.text} hover:underline`}
            >
              Add your first delivery site
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {userSites.map((site) => (
              <button
                key={site.id}
                onClick={() => onSelectSite(site.id)}
                className={`w-full rounded-xl border-2 p-3 text-left transition-all duration-200 ${
                  selectedSiteId === site.id ? ac.selectedCard : ac.unselectedCard
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${ac.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <MapPin className={`h-4 w-4 ${ac.iconText}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm">
                      {site.label ?? "Unnamed site"}
                    </p>
                    {site.address && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {site.address}
                      </p>
                    )}
                    {site.tank_capacity_liters != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tank: {site.tank_capacity_liters.toLocaleString()}L
                      </p>
                    )}
                  </div>
                  {selectedSiteId === site.id && (
                    <CheckCircle2 className={`h-[18px] w-[18px] shrink-0 mt-0.5 ${ac.iconText}`} />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {effectiveSize && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery type</span>
            <span className="font-medium text-foreground">
              {requestMode === "batch" ? "Standard Delivery" : "Exclusive Delivery"}
            </span>
          </div>

          {selectedSiteId && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery site</span>
              <span className="font-medium text-foreground truncate max-w-[60%] text-right">
                {userSites.find((s) => s.id === selectedSiteId)?.label ?? "Selected site"}
              </span>
            </div>
          )}

          {requestMode === "priority" && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Priority timing</span>
              <span className="font-medium text-foreground">
                {priorityMode === "asap"
                  ? "ASAP"
                  : scheduledFor
                    ? formatScheduledDateTime(scheduledFor)
                    : "Not selected"}
              </span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Water quantity</span>
            <span className="font-medium text-foreground">
              {effectiveSize.toLocaleString()}L
            </span>
          </div>

          {isOverCapacity && selectedSite?.tank_capacity_liters && (
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
              <p className="text-sm font-medium text-foreground">
                Volume exceeds registered tank capacity
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You selected {selectedSize.toLocaleString()}L but your site's registered capacity is{" "}
                {selectedSite.tank_capacity_liters.toLocaleString()}L. You can still proceed.
              </p>
            </div>
          )}

          {requestMode === "batch" ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Platform Commission Rate
              </span>
              <span className="font-medium text-foreground">
                {PLATFORM_BATCH_COMMISSION_RATE}%
              </span>
            </div>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Platform Commission Rate
              </span>
              <span className="font-medium text-foreground">
                {PLATFORM_PRIORITY_COMMISSION_RATE}%
              </span>
            </div>
          )}

          {requestMode === "batch" ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-medium text-foreground">
                ₦{BATCH_PRICE_PER_LITER}/liter
              </span>
            </div>
          ) : (
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
              <p className="text-sm font-medium text-foreground">
                Exclusive delivery — full tanker reserved for you
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The tanker delivers to your site only. You pay the full tanker fee.
              </p>
            </div>
          )}

          <div className="border-t border-border pt-3 flex justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-foreground text-xl">
              ₦{price.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Button
          variant="hero"
          className="w-full h-14 rounded-xl text-base"
          disabled={!canContinueToPayment}
          onClick={onContinue}
        >
          Continue to Payment
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl text-base"
          onClick={onCancel}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Cancel Request
        </Button>
      </div>
    </div>
  );
};

export default RequestStep;