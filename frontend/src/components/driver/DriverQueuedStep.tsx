import { Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DriverJob } from "@/types/driver";

interface DriverQueuedStepProps {
  job: DriverJob;
  isLoading: boolean;
  onStartLoading: () => void | Promise<void>;
}

export const DriverQueuedStep = ({
  job,
  isLoading,
  onStartLoading,
}: DriverQueuedStepProps) => {
  return (
    <div className="space-y-6">
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
          <Clock className="h-8 w-8 text-warning" />
        </div>

        <h2 className="text-xl font-bold text-foreground">
          In the Queue to Load
        </h2>

        <p className="text-sm text-muted-foreground">
          You're waiting your turn at the loading point. Tap below once you
          start filling the tanker.
        </p>
      </div>

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

      <Button
        variant="warning"
        className="h-14 w-full rounded-xl text-base"
        onClick={onStartLoading}
        disabled={isLoading}
      >
        <CheckCircle2 className="mr-2 h-5 w-5" />
        {isLoading ? "Updating..." : "I'm Loading"}
      </Button>
    </div>
  );
};
