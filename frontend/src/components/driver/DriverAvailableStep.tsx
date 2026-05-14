import { Truck, Droplets, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DriverJob } from "@/types/driver";

interface DriverAvailableStepProps {
  job: DriverJob | null;
  isLoading: boolean;
  onRefresh: () => void | Promise<void>;
  onAcceptJob: () => void | Promise<void>;
  batchId: number | null;
}

export const DriverAvailableStep = ({
  job,
  isLoading,
  onRefresh,
  onAcceptJob,
}: DriverAvailableStepProps) => {
  if (!job) {
    return (
      <div className="space-y-6">
        <div className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <Truck className="h-10 w-10 text-muted-foreground" />
          </div>

          <h2 className="text-xl font-bold text-foreground">
            No Current Assignment
          </h2>

          <p className="mt-2 text-muted-foreground">
            You don’t have any active delivery job right now.
          </p>
        </div>

        <Button
          variant="outline"
          className="h-12 w-full rounded-xl"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {isLoading ? "Refreshing..." : "Refresh Job"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Truck className="h-8 w-8 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-foreground">
          New {job.jobType === "priority" ? "Priority" : "Batch"} Assignment
        </h2>

        <p className="text-sm text-muted-foreground">
          Review the job details below and accept to continue.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              job.jobType === "batch"
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {job.jobType === "batch" ? "Batch Delivery" : "Priority Delivery"}
          </span>

          <span className="text-xs text-muted-foreground">
  {/* Job #{job.jobType === "batch" ? job.batchId : job.requestId} */}
  Job #{job.jobId}
</span>
        </div>

        <div className="space-y-3">
          {job.liquidName && (
            <div className="flex items-center gap-2 text-sm">
              <Droplets className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{job.liquidName}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">
              {(job.totalVolumeLiters ?? 0).toLocaleString()}L total
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">
              {job.stops.length} {job.stops.length === 1 ? "stop" : "stops"}
            </span>
          </div>
        </div>

        <Button
          className="h-12 w-full rounded-xl"
          onClick={onAcceptJob}
          disabled={isLoading}
        >
          {isLoading ? "Accepting..." : "Accept Job"}
        </Button>
      </div>
    </div>
  );
};

