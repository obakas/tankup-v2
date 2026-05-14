import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createUser, loginUser, type UserResponse } from "@/lib/api";

type AuthMode = "signup" | "login";

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  onSuccess: (user: UserResponse) => void;
  onModeChange: (mode: AuthMode) => void;
}

const AuthModal = ({
  mode,
  onClose,
  onSuccess,
  onModeChange,
}: AuthModalProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  const handleSubmit = async () => {
    if (!phone.trim()) {
      alert("Phone number is required");
      return;
    }

    if (isSignup && (!name.trim() || !address.trim())) {
      alert("Name, phone number, and address are required");
      return;
    }

    try {
      setLoading(true);

      const user = isSignup
        ? await createUser({
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
          })
        : await loginUser({
            phone: phone.trim(),
          });

      onSuccess(user);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isSignup
          ? "Failed to create account"
          : "Failed to log in";

      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {isSignup ? "Create Account" : "Log In"}
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="flex rounded-xl border border-border p-1 bg-muted/30">
          <button
            type="button"
            onClick={() => onModeChange("signup")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isSignup
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => onModeChange("login")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              !isSignup
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Log In
          </button>
        </div>

        <div className="space-y-3">
          {isSignup && (
            <>
              <input
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </>
          )}

          <input
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            className="flex-1 h-12 rounded-xl"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? isSignup
                ? "Creating..."
                : "Logging in..."
              : isSignup
              ? "Continue"
              : "Log In"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;