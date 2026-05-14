import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DriverJob, DriverStop } from "@/types/driver";

interface DriverCompletedStepProps {
  job: DriverJob;
  deliveries: DriverStop[];
  onBackToDashboard: () => void;
}

export const DriverCompletedStep = ({
  job,
  deliveries,
  onBackToDashboard,
}: DriverCompletedStepProps) => {
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
        <p className="mt-2 text-xs text-muted-foreground">
          Job marked complete successfully
        </p>
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
            <span className="font-medium capitalize text-foreground">
              {job.jobType}
            </span>
          </div>

          {job.liquidName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Liquid</span>
              <span className="font-medium text-foreground">
                {job.liquidName}
              </span>
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
            <span className="font-medium text-foreground">
              {deliveries.length} completed
            </span>
          </div>
        </div>
      </div>

      <Button
        variant="default"
        className="h-14 w-full rounded-xl text-base"
        onClick={onBackToDashboard}
      >
        Back to Dashboard
      </Button>
    </div>
  );
};

