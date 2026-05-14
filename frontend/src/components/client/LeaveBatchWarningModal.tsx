import { Button } from "@/components/ui/button";

interface LeaveBatchWarningModalProps {
  onClose: () => void;
  onConfirmLeave: () => void;
}

const LeaveBatchWarningModal = ({
  onClose,
  onConfirmLeave,
}: LeaveBatchWarningModalProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Leave Batch?</h2>
          <p className="text-sm text-muted-foreground mt-2">
            You are already part of a shared batch. Leaving now will cancel your request,
            affect the batch, and your payment will be forfeited.
          </p>
        </div>

        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
          <p className="text-sm text-foreground font-medium">Penalty applies</p>
          <p className="text-xs text-muted-foreground mt-1">
            This action removes you from the batch and you will lose the money already paid.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={onClose}
          >
            Keep My Spot
          </Button>
          <Button
            variant="destructive"
            className="flex-1 h-12 rounded-xl"
            onClick={onConfirmLeave}
          >
            Leave Batch
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeaveBatchWarningModal;