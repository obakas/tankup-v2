import { ArrowLeft, Users } from "lucide-react";

interface FleetHeadViewProps {
  onBack: () => void;
}

export default function FleetHeadView({ onBack }: FleetHeadViewProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted transition text-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold text-foreground">Fleet Management</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-20 h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center">
          <Users className="h-9 w-9 text-violet-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-foreground">Fleet Head</h2>
        <p className="text-muted-foreground text-center max-w-xs leading-relaxed">
          The fleet management dashboard is on its way. Check back soon.
        </p>
      </div>
    </div>
  );
}
