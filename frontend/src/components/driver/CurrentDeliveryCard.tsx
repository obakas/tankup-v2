import { Navigation } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DriverStop } from "@/types/driver";

interface CurrentDeliveryCardProps {
  delivery: DriverStop;
  otpInput: string;
  onOtpChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  isLoading?: boolean;
  showOtpInput?: boolean;
}

export const CurrentDeliveryCard = ({
  delivery,
  otpInput,
  onOtpChange,
  onConfirm,
  confirmLabel = "Confirm",
  isLoading = false,
  showOtpInput = true,
}: CurrentDeliveryCardProps) => {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
          Current Delivery
        </span>
        <span className="text-sm font-medium text-foreground">
          {delivery.volumeLiters.toLocaleString()}L
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">{delivery.name}</h3>
        <p className="text-sm text-muted-foreground">{delivery.address}</p>
        {delivery.phone && (
          <p className="text-sm text-muted-foreground">{delivery.phone}</p>
        )}
      </div>

      <Button variant="outline" className="w-full" type="button">
        <Navigation className="mr-2 h-4 w-4" />
        Open Navigation
      </Button>

      {showOtpInput && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Enter customer OTP
          </label>
          <Input
            value={otpInput}
            onChange={(e) => onOtpChange(e.target.value)}
            placeholder="Enter OTP"
          />
        </div>
      )}

      <Button
        className="w-full"
        onClick={onConfirm}
        disabled={isLoading || (showOtpInput && !otpInput.trim())}
      >
        {isLoading ? "Please wait..." : confirmLabel}
      </Button>
    </div>
  );
};
