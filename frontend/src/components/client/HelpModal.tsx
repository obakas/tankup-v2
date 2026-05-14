import { Button } from "@/components/ui/button";

interface HelpModalProps {
    onClose: () => void;
}

const HelpModal = ({ onClose }: HelpModalProps) => {
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
                    <button className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/30 transition-colors">
                        <p className="font-medium text-foreground">Payment Issue</p>
                        <p className="text-muted-foreground mt-1">
                            Report a failed charge or payment confirmation problem
                        </p>
                    </button>

                    <button className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/30 transition-colors">
                        <p className="font-medium text-foreground">Delivery Delay</p>
                        <p className="text-muted-foreground mt-1">
                            Get help if your delivery is taking too long
                        </p>
                    </button>

                    <button className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/30 transition-colors">
                        <p className="font-medium text-foreground">OTP / Driver Issue</p>
                        <p className="text-muted-foreground mt-1">
                            Resolve issues with delivery confirmation or the assigned driver
                        </p>
                    </button>

                    <button className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/30 transition-colors">
                        <p className="font-medium text-foreground">Cancellation Question</p>
                        <p className="text-muted-foreground mt-1">
                            Learn more about refunds, penalties, and leaving a batch
                        </p>
                    </button>
                </div>

                <Button variant="hero" className="w-full h-12 rounded-xl">
                    Contact Support
                </Button>
            </div>
        </div>
    );
};

export default HelpModal;