import { Loader2, CheckCircle2, Droplets, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveDeliveryMap from "@/components/shared/LiveDeliveryMap";
import type { DriverJob } from "@/types/driver";

interface DriverLoadingStepProps {
  job: DriverJob;
  isLoading: boolean;
  onMarkLoaded: () => void | Promise<void>;
  driverLatitude?: number | null;
  driverLongitude?: number | null;
  nextStopLatitude?: number | null;
  nextStopLongitude?: number | null;
  lastLocationUpdateAt?: string | null;
}

export const DriverLoadingStep = ({
  job,
  isLoading,
  onMarkLoaded,
  driverLatitude,
  driverLongitude,
  nextStopLatitude,
  nextStopLongitude,
  lastLocationUpdateAt,
}: DriverLoadingStepProps) => {
  return (
    <div className="space-y-6">
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
          <Loader2 className="h-8 w-8 animate-spin text-warning" />
        </div>

        <h2 className="text-xl font-bold text-foreground">Loading Water</h2>

        <p className="text-sm text-muted-foreground">
          Confirm when the tanker is loaded and ready to move.
        </p>
      </div>

      <LiveDeliveryMap
        title="Driver map"
        subtitle="Your current location and the next delivery point."
        driver={{
          label: "Your tanker",
          latitude: driverLatitude,
          longitude: driverLongitude,
          kind: "driver",
          description: "Current tanker location",
        }}
        nextStop={{
          label: "Next stop",
          latitude: nextStopLatitude,
          longitude: nextStopLongitude,
          kind: "next_stop",
          description: "First delivery point after loading",
        }}
        lastUpdatedAt={lastLocationUpdateAt}
      />

      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Job</span>
          <span className="font-medium text-foreground">#{job.jobId}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Type</span>
          <span className="font-medium capitalize text-foreground">
            {job.jobType}
          </span>
        </div>

        {job.liquidName && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Liquid</span>
            <span className="font-medium text-foreground">
              {job.liquidName}
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total volume</span>
          <span className="font-medium text-foreground">
            {(job.totalVolumeLiters ?? 0).toLocaleString()}L
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Stops</span>
          <span className="font-medium text-foreground">
            {job.stops.length} {job.stops.length === 1 ? "stop" : "stops"}
          </span>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Droplets className="h-4 w-4" />
          <span>Tanker should be fully loaded before departure.</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>Make sure delivery details are ready before leaving.</span>
        </div>
      </div>

      <Button
        variant="warning"
        className="h-14 w-full rounded-xl text-base"
        onClick={onMarkLoaded}
        disabled={isLoading}
      >
        <CheckCircle2 className="mr-2 h-5 w-5" />
        {isLoading ? "Updating..." : "Water Loaded — Start Delivery"}
      </Button>
    </div>
  );
};


