import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

const CUSTOMER_CATEGORIES = [
    { key: "DRIVER_MISCONDUCT", label: "Driver Misconduct", description: "Unsafe, rude, or unprofessional driver behaviour" },
    { key: "QUANTITY_DISPUTE", label: "Quantity Dispute", description: "Volume delivered doesn't match what was ordered" },
    { key: "PAYMENT_CONFLICT", label: "Payment Conflict", description: "Charged incorrectly or payment not confirmed" },
    { key: "WRONG_LOCATION", label: "Wrong Location", description: "Driver went to the wrong address" },
    { key: "SAFETY_ISSUE", label: "Safety Issue", description: "Safety concern during or after delivery" },
];

interface Props {
    onClose: () => void;
    batchId?: number | null;
    userId?: number | null;
    deliveryRecordId?: number | null;
}

const ReportIncidentModal = ({ onClose, batchId, userId, deliveryRecordId }: Props) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const submit = async () => {
        if (!selected) { setError("Please select a category."); return; }
        setLoading(true);
        setError(null);
        try {
            await apiRequest("/incidents", {
                method: "POST",
                body: {
                    incident_type: selected,
                    description: description.trim() || null,
                    batch_id: batchId ?? null,
                    delivery_record_id: deliveryRecordId ?? null,
                    reported_by_user_id: userId ?? null,
                    source: "customer_app",
                },
            });
            setSubmitted(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to submit. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center sm:items-center">
            <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">Report a Problem</h2>
                    <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
                        Close
                    </button>
                </div>

                {submitted ? (
                    <div className="text-center space-y-3 py-4">
                        <p className="font-semibold text-foreground">Report received</p>
                        <p className="text-sm text-muted-foreground">
                            Thank you for letting us know. Our team will review this and follow up.
                        </p>
                        <Button variant="hero" className="w-full h-12 rounded-xl" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">What happened?</p>

                        <div className="space-y-2">
                            {CUSTOMER_CATEGORIES.map(({ key, label, description: desc }) => (
                                <button
                                    key={key}
                                    onClick={() => setSelected(key)}
                                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                                        selected === key
                                            ? "border-destructive bg-destructive/5"
                                            : "border-border hover:border-destructive/30"
                                    }`}
                                >
                                    <p className={`font-medium text-sm ${selected === key ? "text-destructive" : "text-foreground"}`}>
                                        {label}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Tell us more (optional)"
                            rows={3}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-destructive/40"
                        />

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <Button
                            variant="destructive"
                            className="w-full h-12 rounded-xl"
                            onClick={submit}
                            disabled={loading}
                        >
                            {loading ? "Submitting…" : "Submit Report"}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReportIncidentModal;
