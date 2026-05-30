import { buildHelpMessage, buildWhatsAppUrl } from "@/lib/support";
import { Button } from "@/components/ui/button";

interface HelpModalProps {
    onClose: () => void;
    batchId?: number | null;
    requestId?: number | null;
}

const CATEGORIES = [
    { label: "Payment Issue", description: "Report a failed charge or payment confirmation problem" },
    { label: "Delivery Delay", description: "Get help if your delivery is taking too long" },
    { label: "OTP / Driver Issue", description: "Resolve issues with delivery confirmation or the assigned driver" },
    { label: "Cancellation Question", description: "Learn more about refunds, penalties, and leaving a batch" },
];

const HelpModal = ({ onClose, batchId, requestId }: HelpModalProps) => {
    const openWhatsApp = (category: string) => {
        const msg = buildHelpMessage(category, { batchId, requestId });
        window.open(buildWhatsAppUrl(msg), "_blank");
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center sm:items-center">
            <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">Need Help?</h2>
                    <button
                        onClick={onClose}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        Close
                    </button>
                </div>

                <div className="space-y-3 text-sm">
                    {CATEGORIES.map(({ label, description }) => (
                        <button
                            key={label}
                            onClick={() => openWhatsApp(label)}
                            className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
                        >
                            <p className="font-medium text-foreground">{label}</p>
                            <p className="text-muted-foreground mt-1">{description}</p>
                        </button>
                    ))}
                </div>

                <Button
                    variant="hero"
                    className="w-full h-12 rounded-xl"
                    onClick={() => openWhatsApp("General")}
                >
                    Contact Support
                </Button>
            </div>
        </div>
    );
};

export default HelpModal;
