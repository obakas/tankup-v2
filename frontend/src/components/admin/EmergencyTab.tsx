import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminCancelPriorityRequest,
  adminCleanupExpired,
  adminForceExpireBatch,
  adminForceOfferBatch,
  adminForceOfferPriority,
  adminForgiveDriver,
  adminPunishDriver,
  adminResetTanker,
} from "@/lib/admin";

type AskConfirm = (title: string, description: string, action: () => Promise<unknown>) => void;

type Props = {
  isActionLoading: boolean;
  askConfirm: AskConfirm;
};

export function EmergencyTab({ isActionLoading, askConfirm }: Props) {
  const [offerPriorityRequestId, setOfferPriorityRequestId] = useState("");
  const [offerPriorityTankerId, setOfferPriorityTankerId] = useState("");
  const [cancelPriorityRequestId, setCancelPriorityRequestId] = useState("");
  const [offerBatchId, setOfferBatchId] = useState("");
  const [offerTankerId, setOfferTankerId] = useState("");
  const [expireBatchId, setExpireBatchId] = useState("");
  const [resetTankerId, setResetTankerId] = useState("");
  const [forgiveTankerId, setForgiveTankerId] = useState("");
  const [punishTankerId, setPunishTankerId] = useState("");
  const [punishHours, setPunishHours] = useState<2 | 24 | 48>(2);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <p className="font-semibold text-amber-700 dark:text-amber-300">Emergency controls</p>
        </div>
        <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
          Manual tools for when real-life decides to freestyle. Every action requires confirmation
          before it runs.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Force offer priority */}
        <ControlCard title="Force offer priority to tanker">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={offerPriorityRequestId}
              onChange={(e) => setOfferPriorityRequestId(e.target.value)}
              placeholder="Priority Request ID"
            />
            <Input
              value={offerPriorityTankerId}
              onChange={(e) => setOfferPriorityTankerId(e.target.value)}
              placeholder="Tanker ID"
            />
          </div>
          <Button
            disabled={isActionLoading || !offerPriorityRequestId || !offerPriorityTankerId}
            onClick={() =>
              askConfirm(
                "Force priority offer",
                "This will push a priority request offer directly to the selected tanker.",
                () =>
                  adminForceOfferPriority(
                    Number(offerPriorityRequestId),
                    Number(offerPriorityTankerId),
                  ),
              )
            }
          >
            Send priority offer
          </Button>
        </ControlCard>

        {/* Cancel priority */}
        <ControlCard title="Cancel priority request">
          <Input
            value={cancelPriorityRequestId}
            onChange={(e) => setCancelPriorityRequestId(e.target.value)}
            placeholder="Priority Request ID"
          />
          <Button
            variant="destructive"
            disabled={isActionLoading || !cancelPriorityRequestId}
            onClick={() =>
              askConfirm(
                "Cancel priority request",
                "Cancels the priority request, clears pending offers, frees the tanker, and marks it refund-eligible.",
                () =>
                  adminCancelPriorityRequest(
                    Number(cancelPriorityRequestId),
                    "Cancelled manually by admin",
                  ),
              )
            }
          >
            Cancel priority
          </Button>
        </ControlCard>

        {/* Force offer batch */}
        <ControlCard title="Force offer batch to tanker">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={offerBatchId}
              onChange={(e) => setOfferBatchId(e.target.value)}
              placeholder="Batch ID"
            />
            <Input
              value={offerTankerId}
              onChange={(e) => setOfferTankerId(e.target.value)}
              placeholder="Tanker ID"
            />
          </div>
          <Button
            disabled={isActionLoading || !offerBatchId || !offerTankerId}
            onClick={() =>
              askConfirm(
                "Force offer batch",
                "This will push a batch offer directly to the selected tanker.",
                () => adminForceOfferBatch(Number(offerBatchId), Number(offerTankerId)),
              )
            }
          >
            Send batch offer
          </Button>
        </ControlCard>

        {/* Force expire batch */}
        <ControlCard title="Force expire batch">
          <Input
            value={expireBatchId}
            onChange={(e) => setExpireBatchId(e.target.value)}
            placeholder="Batch ID"
          />
          <Button
            variant="destructive"
            disabled={isActionLoading || !expireBatchId}
            onClick={() =>
              askConfirm(
                "Expire batch",
                "Expires the batch and triggers refunds for all paid active members.",
                () => adminForceExpireBatch(Number(expireBatchId), true),
              )
            }
          >
            Expire batch + refund
          </Button>
        </ControlCard>

        {/* Forgive driver */}
        <ControlCard title="Forgive driver (clear punishment)">
          <p className="text-sm text-muted-foreground">
            Clears the driver's <code>paused_until</code> penalty and offline grace state without touching their
            current delivery or batch. Use when a driver went offline briefly mid-job and came back.
          </p>
          <Input
            value={forgiveTankerId}
            onChange={(e) => setForgiveTankerId(e.target.value)}
            placeholder="Tanker ID"
          />
          <Button
            variant="outline"
            disabled={isActionLoading || !forgiveTankerId}
            onClick={() =>
              askConfirm(
                "Forgive driver",
                `Clear punishment for tanker #${forgiveTankerId}? This lets them take new jobs immediately without resetting their active delivery or batch.`,
                () => adminForgiveDriver(Number(forgiveTankerId)),
              )
            }
          >
            Forgive driver
          </Button>
        </ControlCard>

        {/* Punish driver */}
        <ControlCard title="Punish driver (set penalty)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={punishTankerId}
              onChange={(e) => setPunishTankerId(e.target.value)}
              placeholder="Tanker ID"
            />
            <select
              value={punishHours}
              onChange={(e) => setPunishHours(Number(e.target.value) as 2 | 24 | 48)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value={2}>2 hours (mild)</option>
              <option value={24}>24 hours (moderate)</option>
              <option value={48}>48 hours (severe)</option>
            </select>
          </div>
          <Button
            variant="destructive"
            disabled={isActionLoading || !punishTankerId}
            onClick={() =>
              askConfirm(
                "Punish driver",
                `Block tanker #${punishTankerId} from receiving new offers for ${punishHours}h. Their active delivery or batch is unaffected.`,
                () => adminPunishDriver(Number(punishTankerId), punishHours),
              )
            }
          >
            Punish driver
          </Button>
        </ControlCard>

        {/* Reset tanker */}
        <ControlCard title="Reset tanker to available">
          <Input
            value={resetTankerId}
            onChange={(e) => setResetTankerId(e.target.value)}
            placeholder="Tanker ID"
          />
          <Button
            variant="outline"
            disabled={isActionLoading || !resetTankerId}
            onClick={() =>
              askConfirm(
                "Reset tanker",
                "Clears pending offer state and returns the tanker to available when safe.",
                () => adminResetTanker(Number(resetTankerId)),
              )
            }
          >
            Reset tanker
          </Button>
        </ControlCard>

        {/* Cleanup */}
        <ControlCard title="Expired-member cleanup">
          <p className="text-sm text-muted-foreground">
            Runs the expired-member cleanup job immediately. Normally runs on a background schedule.
          </p>
          <Button
            variant="outline"
            disabled={isActionLoading}
            onClick={() =>
              askConfirm(
                "Run cleanup",
                "This runs expired-member cleanup immediately.",
                () => adminCleanupExpired(),
              )
            }
          >
            Run now
          </Button>
        </ControlCard>
      </div>
    </div>
  );
}

function ControlCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
