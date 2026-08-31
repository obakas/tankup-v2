import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loginDriver } from "@/lib/driverApi";

interface DriverAuthModalProps {
  onLogin: (driver: {
    id: number;
    name: string;
    phone: string;
    tankerId: number;
  }) => void;
}

const DriverAuthModal = ({ onLogin }: DriverAuthModalProps) => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    try {
      setLoading(true);

      const result = await loginDriver(phone.trim());

      onLogin({
        id: result.id,
        name: result.name,
        phone: result.phone,
        tankerId: result.tankerId,
      });

      toast.success("Driver logged in successfully");

      setPhone("");
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
      <h2 className="mb-2 text-xl font-semibold text-foreground">Driver Login</h2>

      <p className="mb-4 text-sm text-muted-foreground">
        Login to go online and accept jobs
      </p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-md border bg-background px-3 py-2"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <Button className="w-full bg-success text-success-foreground" type="submit" disabled={loading}>
          {loading ? "Please wait..." : "Login"}
        </Button>

        <p className="text-sm text-muted-foreground">
          New driver signups are paused — ask your fleet head to add you.
        </p>
      </form>
    </div>
  );
};

export default DriverAuthModal;