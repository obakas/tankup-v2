import { MapPin, Phone, Droplets, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveDeliveryMap from "@/components/shared/LiveDeliveryMap";
import type { DriverStop } from "@/types/driver";

interface DriverDeliveringStepProps {
  currentDelivery: DriverStop | null;
  activeDeliveryIdx: number;
  deliveredCount: number;
  totalStops: number;
  allDelivered: boolean;

  allowedActions?: string[];
  currentStopStatus?: string | null;

  otpInput: string;
  setOtpInput: (value: string) => void;

  meterStartReading: string;
  setMeterStartReading: (value: string) => void;

  meterEndReading: string;
  setMeterEndReading: (value: string) => void;

  deliveryNotes: string;
  setDeliveryNotes: (value: string) => void;

  failureReason: string;
  setFailureReason: (value: string) => void;

  skipReason: string;
  setSkipReason: (value: string) => void;

  isLoading: boolean;

  otpVerified?: boolean;

  onMarkArrived: () => void | Promise<void>;
  onBeginMeasurement: () => void | Promise<void>;
  onFinishMeasurement: () => void | Promise<void>;
  onVerifyOtp: () => void | Promise<void>;
  onCompleteDelivery: () => void | Promise<void>;
  onFailStop: () => void | Promise<void>;
  onSkipStop: () => void | Promise<void>;
  onReset: () => void;
}

export const DriverDeliveringStep = ({
  currentDelivery,
  activeDeliveryIdx,
  deliveredCount,
  totalStops,
  allDelivered,
  allowedActions = [],

  currentStopStatus,
  otpInput,
  otpVerified = false,

  setOtpInput,
  meterStartReading,
  setMeterStartReading,
  meterEndReading,
  setMeterEndReading,
  deliveryNotes,
  setDeliveryNotes,
  failureReason,
  setFailureReason,
  skipReason,
  setSkipReason,
  isLoading,
  onMarkArrived,
  onBeginMeasurement,
  onFinishMeasurement,
  onVerifyOtp,
  onCompleteDelivery,
  onFailStop,
  onSkipStop,
  onReset,

  // driverLatitude,
  // driverLongitude,
  // lastLocationUpdateAt,
}: DriverDeliveringStepProps) => {
  const canArrive = allowedActions.includes("arrive");
  const canStartMeasurement = allowedActions.includes("start_measurement");
  const canFinishMeasurement = allowedActions.includes("finish_measurement");
  // const canVerifyOtp = allowedActions.includes("confirm_otp");
  // const canComplete = allowedActions.includes("complete");
  const canFail = allowedActions.includes("fail");
  const canSkip = allowedActions.includes("skip");

  const isAwaitingOtp = currentStopStatus === "awaiting_otp";
  const canVerifyOtp = allowedActions.includes("confirm_otp");
  const canComplete = allowedActions.includes("complete");

  const shouldShowOtp =
    isAwaitingOtp &&
    canVerifyOtp &&
    !otpVerified &&
    !canComplete;

  if (allDelivered || !currentDelivery) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>

          <h2 className="text-2xl font-bold text-foreground">Delivery Completed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All available stops for this job have been resolved. No hanging stops. No ghost drama.
          </p>

          <div className="mt-6">
            <Button onClick={onReset}>Back to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const stopNumber = activeDeliveryIdx >= 0 ? activeDeliveryIdx + 1 : 1;

  const handleVerifyOtp = async () => {
    if (!otpInput.trim()) return;

    await onVerifyOtp();

    setOtpInput(""); // 🔥 clear immediately
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Stop {stopNumber} of {Math.max(totalStops, 1)}
            </p>
            <h2 className="text-2xl font-bold text-foreground">{currentDelivery.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Completed stops: {deliveredCount} / {Math.max(totalStops, 1)}
            </p>
            {currentStopStatus ? (
              <p className="mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize text-foreground">
                Status: {currentStopStatus.replace(/_/g, " ")}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl bg-secondary px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Planned Volume
            </p>
            <p className="text-lg font-bold text-foreground">
              {currentDelivery.volumeLiters}L
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Address</p>
            <p className="text-sm text-muted-foreground">{currentDelivery.address}</p>
          </div>
        </div>

        {currentDelivery.phone ? (
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Phone</p>
              <a
                href={`tel:${currentDelivery.phone}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {currentDelivery.phone}
              </a>
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-3">
          <Droplets className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Delivery OTP</p>
            <p className="text-sm text-muted-foreground">
              Ask the customer for the OTP only after measurement is complete.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Delivery Actions</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Follow the stop flow in order: arrive, measurement, OTP, then complete. If real life misbehaves, fail or skip the stop with a reason.
          </p>
        </div>

        {canArrive ? (
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="font-medium text-foreground">1. Arrive at Stop</h4>
            <p className="text-sm text-muted-foreground">
              Confirm that the tanker has reached the customer location.
            </p>
            <Button onClick={onMarkArrived} disabled={isLoading}>
              {isLoading ? "Processing..." : "Mark Arrived"}
            </Button>
          </div>
        ) : null}

        {canStartMeasurement ? (
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="font-medium text-foreground">2. Start Measurement</h4>
            <p className="text-sm text-muted-foreground">
              Enter the current meter reading before dispensing water.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Meter Start Reading
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={meterStartReading}
                onChange={(e) => setMeterStartReading(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button onClick={onBeginMeasurement} disabled={isLoading}>
              {isLoading ? "Processing..." : "Start Measurement"}
            </Button>
          </div>
        ) : null}

        {canFinishMeasurement ? (
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="font-medium text-foreground">3. Finish Measurement</h4>
            <p className="text-sm text-muted-foreground">
              Enter the final meter reading after dispensing the water.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Meter End Reading
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={meterEndReading}
                onChange={(e) => setMeterEndReading(e.target.value)}
                placeholder="e.g. 12000"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Notes (optional)
              </label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Any note about the measurement or delivery..."
                rows={3}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button onClick={onFinishMeasurement} disabled={isLoading}>
              {isLoading ? "Processing..." : "Finish Measurement"}
            </Button>
          </div>
        ) : null}

        {/* {isAwaitingOtp && canVerifyOtp ? (
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="font-medium text-foreground">4. Verify Customer OTP</h4>
            <p className="text-sm text-muted-foreground">
              Collect the OTP from the customer after measurement is completed.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">OTP Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="Enter customer OTP"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button onClick={onVerifyOtp} disabled={isLoading}>
              {isLoading ? "Processing..." : "Verify OTP"}
            </Button>
          </div>
        ) : null} */}


        {shouldShowOtp ? (
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="font-medium text-foreground">4. Verify Customer OTP</h4>
            <p className="text-sm text-muted-foreground">
              Collect the OTP from the customer after measurement is completed.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">OTP Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="Enter customer OTP"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* <Button onClick={onVerifyOtp} disabled={isLoading || !otpInput.trim()}>
              {isLoading ? "Processing..." : "Verify OTP"}
            </Button> */}
            <Button onClick={handleVerifyOtp} disabled={isLoading || !otpInput.trim()}>
              {isLoading ? "Processing..." : "Verify OTP"}
            </Button>
          </div>
        ) : null}

        {canComplete ? (
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="font-medium text-foreground">5. Complete Stop</h4>
            <p className="text-sm text-muted-foreground">
              Finish this stop after OTP verification succeeds.
            </p>

            <Button onClick={onCompleteDelivery} disabled={isLoading}>
              {isLoading ? "Processing..." : "Complete Stop"}
            </Button>
          </div>
        ) : null}

        {canFail ? (
          <div className="rounded-xl border border-destructive/20 p-4 space-y-3">
            <h4 className="font-medium text-foreground">Fail Stop</h4>
            <p className="text-sm text-muted-foreground">
              Use this when the customer is absent or the stop cannot be completed.
            </p>
            <textarea
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              placeholder="Why did this stop fail?"
              rows={3}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button variant="outline" onClick={onFailStop} disabled={isLoading}>
              {isLoading ? "Processing..." : "Mark Stop Failed"}
            </Button>
          </div>
        ) : null}

        {canSkip ? (
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="font-medium text-foreground">Skip Stop</h4>
            <p className="text-sm text-muted-foreground">
              Use this when you must move on but still need a recorded reason.
            </p>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Why are you skipping this stop?"
              rows={3}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button variant="outline" onClick={onSkipStop} disabled={isLoading}>
              {isLoading ? "Processing..." : "Skip Stop"}
            </Button>
          </div>
        ) : null}

        {!canArrive &&
          !canStartMeasurement &&
          !canFinishMeasurement &&
          !canVerifyOtp &&
          !canComplete &&
          !canFail &&
          !canSkip ? (
          <div className="rounded-xl border border-dashed p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">No actions available</p>
                <p className="text-sm text-muted-foreground">
                  This stop is waiting for the backend to move to the next valid state.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
