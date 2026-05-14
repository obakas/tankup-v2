import { Clock3, Droplets, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface IncomingDriverOffer {
  type: "priority" | "batch";
  id: number;
  expires_in_seconds: number;
  request_id?: number;
  batch_id?: number;
  volume_liters?: number;
  total_volume?: number;
  member_count?: number;
  latitude?: number | null;
  longitude?: number | null;
  delivery_type?: string;
  scheduled_for?: string | null;
}

interface DriverIncomingOfferStepProps {
  offer: IncomingDriverOffer;
  isSubmitting?: boolean;
  onAccept: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

export const DriverIncomingOfferStep = ({
  offer,
  isSubmitting = false,
  onAccept,
  onReject,
  onRefresh,
}: DriverIncomingOfferStepProps) => {
  const isPriority = offer.type === "priority";

  return (
    <div className="space-y-6">
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Truck className="h-8 w-8 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-foreground">
          Incoming {isPriority ? "Priority" : "Batch"} Offer
        </h2>

        <p className="text-sm text-muted-foreground">
          You have a limited time to accept or reject this delivery.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              isPriority
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            {isPriority ? "Priority Delivery" : "Batch Delivery"}
          </span>

          <span className="text-xs text-muted-foreground">
            Job #{offer.id}
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">
            Expires in {offer.expires_in_seconds}s
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">
              {isPriority
                ? `${(offer.volume_liters ?? 0).toLocaleString()}L`
                : `${(offer.total_volume ?? 0).toLocaleString()}L total`}
            </span>
          </div>

          {!isPriority && (
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                {offer.member_count ?? 0} stop{(offer.member_count ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
          )}

          {(offer.latitude != null || offer.longitude != null) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                {offer.latitude ?? "?"}, {offer.longitude ?? "?"}
              </span>
            </div>
          )}

          {offer.scheduled_for && (
            <div className="text-sm text-muted-foreground">
              Scheduled for: {new Date(offer.scheduled_for).toLocaleString()}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 rounded-xl"
            onClick={onReject}
            disabled={isSubmitting}
          >
            Reject
          </Button>

          <Button
            className="h-12 rounded-xl"
            onClick={onAccept}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Accept Offer"}
          </Button>
        </div>

        {onRefresh && (
          <Button
            variant="ghost"
            className="h-11 w-full rounded-xl"
            onClick={onRefresh}
            disabled={isSubmitting}
          >
            Refresh Offer
          </Button>
        )}
      </div>
    </div>
  );
};

export default DriverIncomingOfferStep;