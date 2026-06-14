import { CalendarClock, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  scheduledFor: string;
  onCancel: () => void;
};

function formatBlock(scheduledFor: string): string {
  if (!scheduledFor) return "your scheduled window";
  const d = new Date(scheduledFor);
  if (isNaN(d.getTime())) return "your scheduled window";
  const hour = d.getHours();
  const block = hour < 12 ? "Morning (7am – 12pm)" : "Afternoon (12pm – 5pm)";
  const day = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return `${day} · ${block}`;
}

export default function ScheduledStep({ scheduledFor, onCancel }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <CalendarClock className="w-10 h-10 text-primary" />
      </div>

      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Delivery Scheduled</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Payment confirmed. We'll start searching for a driver when your window opens.
        </p>
      </div>

      <div className="w-full rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Your delivery window</p>
            <p className="font-semibold text-foreground mt-0.5">
              {formatBlock(scheduledFor)}
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            We'll notify you when a driver is confirmed. No need to keep this tab open.
          </p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full text-destructive border-border"
          onClick={onCancel}
        >
          <XCircle className="w-4 h-4 mr-2" />
          Cancel Scheduled Delivery
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          You can cancel before your window opens for a full refund.
        </p>
      </div>
    </div>
  );
}
