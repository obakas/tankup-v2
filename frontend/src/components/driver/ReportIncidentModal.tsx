import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

const DRIVER_CATEGORIES = [
    { key: "TANKER_BREAKDOWN", label: "Tanker Breakdown" },
    { key: "PUMP_FAILURE", label: "Pump Failure" },
    { key: "SITE_INACCESSIBLE", label: "Site Inaccessible" },
    { key: "CUSTOMER_UNAVAILABLE", label: "Customer Unavailable" },
    { key: "OTP_REFUSAL", label: "OTP Refusal" },
    { key: "QUANTITY_DISPUTE", label: "Quantity Dispute" },
    { key: "SAFETY_ISSUE", label: "Safety Issue" },
    { key: "WRONG_LOCATION", label: "Wrong Location" },
    { key: "PAYMENT_CONFLICT", label: "Payment Conflict" },
    { key: "CUSTOMER_AGGRESSION", label: "Customer Aggression" },
    { key: "DRIVER_MISCONDUCT", label: "Driver Misconduct" },
];

interface Props {
    onClose: () => void;
    batchId?: number | null;
    tankerId?: number | null;
    deliveryRecordId?: number | null;
}

const DriverReportIncidentModal = ({ onClose, batchId, tankerId, deliveryRecordId }: Props) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const submit = async () => {
        if (!selected) { setError("Please select an incident type."); return; }
        setLoading(true);
        setError(null);
        try {
            await apiRequest("/incidents", {
                method: "POST",
                body: {
                    incident_type: selected,
                    description: description.trim() || null,
                    batch_id: batchId ?? null,
                    tanker_id: tankerId ?? null,
                    delivery_record_id: deliveryRecordId ?? null,
                    reported_by_driver_id: tankerId ?? null,
                    source: "driver_app",
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
                    <h2 className="text-lg font-bold text-foreground">Report Incident</h2>
                    <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
                        Close
                    </button>
                </div>

                {submitted ? (
                    <div className="text-center space-y-3 py-4">
                        <p className="font-semibold text-foreground">Incident reported</p>
                        <p className="text-sm text-muted-foreground">
                            Your report has been received. The fleet head will be notified.
                        </p>
                        <Button variant="hero" className="w-full h-12 rounded-xl" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">Select the type of incident:</p>

                        <div className="grid grid-cols-2 gap-2">
                            {DRIVER_CATEGORIES.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSelected(key)}
                                    className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                                        selected === key
                                            ? "border-destructive bg-destructive/5"
                                            : "border-border hover:border-destructive/30"
                                    }`}
                                >
                                    <p className={`font-medium text-sm ${selected === key ? "text-destructive" : "text-foreground"}`}>
                                        {label}
                                    </p>
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Additional details (optional)"
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

export default DriverReportIncidentModal;
