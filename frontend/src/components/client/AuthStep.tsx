import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { createUser, loginUser, createSite, type UserResponse } from "@/lib/api";
import { toast } from "sonner";

type AuthMode = "signup" | "login";

interface SiteFormData {
  label: string;
  landmarkNotes: string;
  tankCapacity: string;
  hasGate: boolean;
  gateNotes: string;
}

const newSite = (label = ""): SiteFormData => ({
  label,
  landmarkNotes: "",
  tankCapacity: "",
  hasGate: false,
  gateNotes: "",
});

const FALLBACK_COORDS = { latitude: 9.058, longitude: 7.5233 };

async function detectCoords(): Promise<typeof FALLBACK_COORDS> {
  if (typeof window === "undefined" || !navigator.geolocation) return FALLBACK_COORDS;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(FALLBACK_COORDS),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

interface AuthStepProps {
  onComplete: (user: UserResponse, isSignup: boolean) => void;
}

const AuthStep = ({ onComplete }: AuthStepProps) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<SiteFormData[]>([newSite("Home")]);

  const isSignup = mode === "signup";

  const updateSite = (index: number, patch: Partial<SiteFormData>) =>
    setSites((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const addSite = () => setSites((prev) => [...prev, newSite()]);

  const removeSite = (index: number) =>
    setSites((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!phone.trim()) { toast.error("Phone number is required"); return; }
    if (isSignup && (!name.trim() || !address.trim())) {
      toast.error("Name, phone number, and address are required");
      return;
    }

    try {
      setLoading(true);

      const user = isSignup
        ? await createUser({ name: name.trim(), phone: phone.trim(), address: address.trim() })
        : await loginUser({ phone: phone.trim() });

      if (isSignup) {
        try {
          const coords = await detectCoords();
          await Promise.allSettled(
            sites.map((site) => {
              const rawCapacity = site.tankCapacity.trim();
              return createSite({
                user_id: user.id,
                latitude: coords.latitude,
                longitude: coords.longitude,
                label: site.label.trim() || "Home",
                address: address.trim(),
                landmark_notes: site.landmarkNotes.trim() || undefined,
                tank_capacity_liters: rawCapacity ? parseInt(rawCapacity, 10) : undefined,
                has_gate: site.hasGate,
                gate_notes: site.hasGate && site.gateNotes.trim() ? site.gateNotes.trim() : undefined,
              });
            })
          );
        } catch {
          // site creation is best-effort; account was created successfully
        }
      }

      onComplete(user, isSignup);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isSignup ? "Failed to create account" : "Failed to log in";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="py-4 text-center">
        <h2 className="text-xl font-bold text-foreground">Get Started</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in or create an account to request water delivery
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
        {/* Mode tabs */}
        <div className="flex rounded-xl border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isSignup ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              !isSignup ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Log In
          </button>
        </div>

        {/* Account fields */}
        <div className="space-y-3">
          {isSignup && (
            <>
              <input
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Delivery Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </>
          )}
          <input
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {/* Delivery sites — signup only */}
        {isSignup && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">Delivery Sites</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {sites.map((site, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Site {i + 1}</span>
                  {sites.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSite(i)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Remove site ${i + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <input
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Site label (e.g. Home, Office)"
                  value={site.label}
                  onChange={(e) => updateSite(i, { label: e.target.value })}
                />

                <input
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Landmark / notes (optional)"
                  value={site.landmarkNotes}
                  onChange={(e) => updateSite(i, { landmarkNotes: e.target.value })}
                />

                <input
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  type="number"
                  min="0"
                  placeholder="Tank capacity in liters (optional)"
                  value={site.tankCapacity}
                  onChange={(e) => updateSite(i, { tankCapacity: e.target.value })}
                />

                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <Label htmlFor={`has-gate-${i}`} className="cursor-pointer text-sm">
                    Has gate / barrier?
                  </Label>
                  <Switch
                    id={`has-gate-${i}`}
                    checked={site.hasGate}
                    onCheckedChange={(v) =>
                      updateSite(i, { hasGate: v, gateNotes: v ? site.gateNotes : "" })
                    }
                  />
                </div>

                {site.hasGate && (
                  <input
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Gate notes (optional) — e.g. call ahead, code is 1234"
                    value={site.gateNotes}
                    onChange={(e) => updateSite(i, { gateNotes: e.target.value })}
                  />
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addSite}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Add Another Site
            </button>
          </div>
        )}

        <Button
          type="button"
          variant="hero"
          className="w-full h-14 rounded-xl text-base"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading
            ? isSignup ? "Creating…" : "Logging in…"
            : isSignup ? "Create Account" : "Log In"}
        </Button>
      </div>
    </div>
  );
};

export default AuthStep;
