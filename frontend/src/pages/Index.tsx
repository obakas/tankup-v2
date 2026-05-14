import { useEffect, useState } from "react";
import { Droplets, Truck, Sun, Moon } from "lucide-react";
import ClientView from "@/components/ClientView";
import DriverView from "@/components/DriverView";

const ROLE_KEY = "tankup_active_role";
const DRIVER_AUTH_KEY = "driver_auth";
const CLIENT_USER_KEY = "water_user";
const CLIENT_SESSION_KEY = "water_client_session";

const Index = () => {
  const [role, setRole] = useState<"select" | "client" | "driver">("select");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("tankup-theme") as "light" | "dark" | null;

    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialTheme = prefersDark ? "dark" : "light";
      setTheme(initialTheme);
      document.documentElement.classList.toggle("dark", initialTheme === "dark");
    }

    const savedRole = localStorage.getItem(ROLE_KEY) as "client" | "driver" | null;
    const hasDriverAuth = !!localStorage.getItem(DRIVER_AUTH_KEY);
    const hasClientUser = !!localStorage.getItem(CLIENT_USER_KEY);
    const hasClientSession = !!localStorage.getItem(CLIENT_SESSION_KEY);

    if (savedRole === "driver" && hasDriverAuth) {
      setRole("driver");
    } else if (savedRole === "client" && (hasClientUser || hasClientSession)) {
      setRole("client");
    } else if (hasDriverAuth) {
      setRole("driver");
    } else if (hasClientUser || hasClientSession) {
      setRole("client");
    } else {
      setRole("select");
    }

    setIsHydrated(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("tankup-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const selectRole = (nextRole: "client" | "driver") => {
    setRole(nextRole);
    localStorage.setItem(ROLE_KEY, nextRole);
  };

  const goHome = () => {
    setRole("select");
    localStorage.removeItem(ROLE_KEY);
  };

  if (!isHydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (role === "client") {
    return <ClientView onBack={goHome} />;
  }

  if (role === "driver") {
    return <DriverView onBack={goHome} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 transition-colors">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-end">
          <button
            onClick={toggleTheme}
            className="h-11 w-11 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:scale-105 transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/30">
            <Droplets className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">TankUp</h1>
          <p className="text-muted-foreground">Get water delivered to your tank</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => selectRole("client")}
            className="w-full bg-card rounded-2xl border border-border p-6 flex items-center gap-5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Droplets className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left">
              <h2 className="font-bold text-foreground text-lg">I Need Water</h2>
              <p className="text-sm text-muted-foreground">Request water delivery to your tank</p>
            </div>
          </button>

          <button
            onClick={() => selectRole("driver")}
            className="w-full bg-card rounded-2xl border border-border p-6 flex items-center gap-5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center shrink-0">
              <Truck className="h-7 w-7 text-success" />
            </div>
            <div className="text-left">
              <h2 className="font-bold text-foreground text-lg">I'm a Tanker Driver</h2>
              <p className="text-sm text-muted-foreground">Accept jobs, deliver water, & get paid</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;