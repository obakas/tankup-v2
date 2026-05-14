import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loginDriver, signupDriver } from "@/lib/driverApi";

interface DriverAuthModalProps {
  onLogin: (driver: {
    id: number;
    name: string;
    phone: string;
    tankerId: number;
  }) => void;
}

const DriverAuthModal = ({ onLogin }: DriverAuthModalProps) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tankPlateNumber, setTankPlateNumber] = useState("");
  // const [latitude, setLatitude] = useState("");
  // const [longitude, setLongitude] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  const resetForm = () => {
    setName("");
    setPhone("");
    setTankPlateNumber("");
    // setLatitude("");
    // setLongitude("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    if (!isLogin) {
      if (!name.trim()) {
        toast.error("Full name is required");
        return;
      }

      if (!tankPlateNumber.trim()) {
        toast.error("Tank plate number is required");
        return;
      }
    }

    try {
      setLoading(true);

      const result = isLogin
        ? await loginDriver(phone.trim())
        : await signupDriver(
            name.trim(),
            phone.trim(),
            tankPlateNumber.trim(),
            // latitude.trim() ? Number(latitude) : null,
            // longitude.trim() ? Number(longitude) : null
          );

      onLogin({
        id: result.id,
        name: result.name,
        phone: result.phone,
        tankerId: result.tankerId,
      });

      toast.success(
        isLogin
          ? "Driver logged in successfully"
          : "Driver account created successfully"
      );

      resetForm();
    } catch (error) {
      console.error("Driver auth error:", error);
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold">
        {isLogin ? "Driver Login" : "Driver Sign Up"}
      </h2>

      <p className="mb-4 text-sm text-muted-foreground">
        {isLogin
          ? "Login to go online and accept jobs"
          : "Create an account to start delivering"}
      </p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {!isLogin && (
          <>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="Tank plate number"
              value={tankPlateNumber}
              onChange={(e) => setTankPlateNumber(e.target.value)}
            />

            {/* <input
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="Latitude (optional for now)"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              inputMode="decimal"
            /> */}

            {/* <input
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="Longitude (optional for now)"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              inputMode="decimal"
            /> */}
          </>
        )}

        <input
          className="w-full rounded-md border bg-background px-3 py-2"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
        </Button>

        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => setMode((prev) => (prev === "login" ? "signup" : "login"))}
        >
          {isLogin ? "No account? Sign up" : "Already have an account? Login"}
        </button>
      </form>
    </div>
  );
};

export default DriverAuthModal;