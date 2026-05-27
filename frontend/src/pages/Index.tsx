import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Droplets, Truck, Users, Sun, Moon } from "lucide-react";
import ClientView from "@/components/ClientView";
import DriverView from "@/components/DriverView";
import FleetHeadView from "@/components/FleetHeadView";

const ROLE_KEY = "tankup_active_role";
const DRIVER_AUTH_KEY = "driver_auth";
const CLIENT_USER_KEY = "water_user";
const CLIENT_SESSION_KEY = "water_client_session";
const FLEET_HEAD_AUTH_KEY = "fleet_head_auth";

type Role = "select" | "client" | "driver" | "fleet_head";

const Index = () => {
  const [role, setRole] = useState<Role>("select");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isHydrated, setIsHydrated] = useState(false);
  const navigate = useNavigate();
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const savedRole = localStorage.getItem(ROLE_KEY) as Role | null;
    const hasDriverAuth = !!localStorage.getItem(DRIVER_AUTH_KEY);
    const hasClientUser = !!localStorage.getItem(CLIENT_USER_KEY);
    const hasClientSession = !!localStorage.getItem(CLIENT_SESSION_KEY);
    const hasFleetHeadAuth = !!localStorage.getItem(FLEET_HEAD_AUTH_KEY);

    if (savedRole === "driver" && hasDriverAuth) { setRole("driver"); }
    else if (savedRole === "client" && (hasClientUser || hasClientSession)) { setRole("client"); }
    else if (savedRole === "fleet_head" && hasFleetHeadAuth) { setRole("fleet_head"); }
    else if (hasDriverAuth) { setRole("driver"); }
    else if (hasClientUser || hasClientSession) { setRole("client"); }
    else if (hasFleetHeadAuth) { setRole("fleet_head"); }
    else { setRole("select"); }

    setIsHydrated(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("tankup-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const selectRole = (nextRole: "client" | "driver" | "fleet_head") => {
    setRole(nextRole);
    localStorage.setItem(ROLE_KEY, nextRole);
  };

  const goHome = () => {
    setRole("select");
    localStorage.removeItem(ROLE_KEY);
  };

  // 5 rapid clicks on the logo within 2 seconds opens the admin panel
  const handleLogoClick = () => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);

    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      navigate("/admin");
      return;
    }

    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, 2000);
  };

  if (!isHydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (role === "client") return <ClientView onBack={goHome} />;
  if (role === "driver") return <DriverView onBack={goHome} />;
  if (role === "fleet_head") return <FleetHeadView onBack={goHome} />;

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
          <button
            onClick={handleLogoClick}
            className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/30 focus:outline-none active:scale-95 transition"
            aria-label="TankUp"
          >
            <Droplets className="h-10 w-10 text-primary-foreground" />
          </button>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">TankUp</h1>
          <p className="text-muted-foreground">Water delivery, coordinated.</p>
        </div>

        <div className="space-y-4">
          <RoleCard
            icon={<Droplets className="h-7 w-7 text-primary" />}
            iconBg="bg-primary/10"
            title="I Need Water"
            subtitle="Request water delivery to your tank"
            onClick={() => selectRole("client")}
          />
          <RoleCard
            icon={<Truck className="h-7 w-7 text-success" />}
            iconBg="bg-success/10"
            title="I'm a Tanker Driver"
            subtitle="Accept jobs, deliver water, & get paid"
            onClick={() => selectRole("driver")}
          />
          <RoleCard
            icon={<Users className="h-7 w-7 text-violet-500" />}
            iconBg="bg-violet-500/10"
            title="Manage My Fleet"
            subtitle="Coordinate drivers, tankers & operations"
            onClick={() => selectRole("fleet_head")}
          />
        </div>

      </div>
    </div>
  );
};

function RoleCard({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 active:scale-[0.98]"
    >
      <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="text-left">
        <h2 className="font-bold text-foreground text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  );
}

export default Index;
