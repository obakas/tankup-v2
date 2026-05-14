interface DeliveryProgressProps {
  deliveredCount: number;
  totalCount: number;
}

export const DeliveryProgress = ({ deliveredCount, totalCount }: DeliveryProgressProps) => {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">Delivery Progress</span>
        <span className="text-sm font-bold text-primary">
          {deliveredCount}/{totalCount}
        </span>
      </div>
      <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-success rounded-full transition-all duration-500"
          style={{ width: `${(deliveredCount / totalCount) * 100}%` }}
        />
      </div>
    </div>
  );
};