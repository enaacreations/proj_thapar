import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  Bell,
  Home,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { ADMIN_ROLE_LABELS } from "@proj/shared";
import { useAuth } from "./auth";
import { useTheme } from "./theme";
import { SummaryProvider, useSummary } from "./summary";
import {
  GROUP_LABELS,
  SCOPE,
  groupsOf,
  moduleAt,
  modulesFor,
  type AppModule,
} from "./modules";
import { CommandPalette } from "./palette";
import { BackLink, Loading, greeting, initials, useClock } from "./ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Registrations from "./pages/Registrations";
import RegistrationDetail from "./pages/RegistrationDetail";
import Requests from "./pages/Requests";
import RequestDetail from "./pages/RequestDetail";
import Residents from "./pages/Residents";
import ResidentDetail from "./pages/ResidentDetail";
import Feedback from "./pages/Feedback";
import Onboarding from "./pages/Onboarding";
import OnboardingDetail from "./pages/OnboardingDetail";
import Finance from "./pages/Finance";
import Food from "./pages/Food";
import Laundry from "./pages/Laundry";
import Bookings from "./pages/Bookings";

export default function App() {
  const { admin, restoring } = useAuth();

  if (restoring) return <Loading label="Checking your session…" />;
  if (!admin) return <Login />;

  return (
    <SummaryProvider>
      <Shell />
    </SummaryProvider>
  );
}

function Shell() {
  const { admin, signOut } = useAuth();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A module route gets that module's sidebar; Home is the bare launcher.
  const activeModule = moduleAt(location.pathname);
  const allowed = admin ? modulesFor(admin.role) : [];
  const visibleModule =
    activeModule && allowed.some((m) => m.key === activeModule.key)
      ? activeModule
      : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Navigating always closes the mobile drawer, so it never traps the screen.
  useEffect(() => setDrawerOpen(false), [location.pathname, location.search]);

  if (!admin) return null;

  return (
    <div className="shell">
      <Topbar
        showDrawerToggle={visibleModule !== null}
        onOpenDrawer={() => setDrawerOpen((o) => !o)}
        onOpenPalette={() => setPaletteOpen(true)}
        onSignOut={() => void signOut()}
      />

      <div className="shell-body">
        {visibleModule && (
          <>
            <ModuleSidebar module={visibleModule} open={drawerOpen} />
            {drawerOpen && (
              <div
                className="drawer-backdrop"
                onClick={() => setDrawerOpen(false)}
              />
            )}
          </>
        )}

        <main className="page">
          <BackBar />
          <Routes>
            <Route path="/" element={<Dashboard />} />

            {/* Cross-module queue: one list of everything still waiting. */}
            <Route path="/requests" element={<Requests />} />
            <Route path="/requests/:kind/:id" element={<RequestDetail />} />

            <Route path="/registrations" element={<Registrations />} />
            <Route path="/registrations/:id" element={<RegistrationDetail />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/onboarding/:id" element={<OnboardingDetail />} />

            {/* One module per kind of request, each owning its own details. */}
            <Route path="/maintenance" element={<Requests kind="maintenance" />} />
            <Route
              path="/maintenance/:id"
              element={<RequestDetail kind="maintenance" />}
            />
            <Route path="/laundry" element={<Laundry />} />
            <Route path="/laundry/:id" element={<RequestDetail kind="laundry" />} />
            <Route path="/complaints" element={<Requests kind="complaint" />} />
            <Route
              path="/complaints/:id"
              element={<RequestDetail kind="complaint" />}
            />
            <Route path="/visitors" element={<Requests kind="visit" />} />
            <Route path="/visitors/:id" element={<RequestDetail kind="visit" />} />

            <Route path="/food" element={<Food />} />
            <Route
              path="/housekeeping"
              element={<Bookings kind="housekeeping" />}
            />
            <Route path="/spaces" element={<Bookings kind="amenities" />} />

            <Route path="/residents" element={<Residents />} />
            <Route path="/residents/:id" element={<ResidentDetail />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/feedback" element={<Feedback />} />

            {/* Where the old combined Services module used to live. */}
            <Route path="/services" element={<Navigate to="/food" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <CommandPalette
        role={admin.role}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

/**
 * One back link for the whole console, so every screen except Home has a way
 * out: detail screens go up to their list, module screens go to the launcher.
 */
function BackBar() {
  const location = useLocation();

  if (location.pathname === "/") return null;

  const module = moduleAt(location.pathname);
  if (module && location.pathname !== module.path) {
    return (
      <BackLink
        to={module.path}
        label={`Back to ${module.name.toLowerCase()}`}
      />
    );
  }

  return <BackLink to="/" label="All modules" />;
}

function Topbar({
  showDrawerToggle,
  onOpenDrawer,
  onOpenPalette,
  onSignOut,
}: {
  showDrawerToggle: boolean;
  onOpenDrawer: () => void;
  onOpenPalette: () => void;
  onSignOut: () => void;
}) {
  const { admin } = useAuth();
  const { theme, toggle } = useTheme();
  const { data } = useSummary();
  const now = useClock();

  if (!admin) return null;

  const waiting = data
    ? data.registrations.pending + data.openRequests
    : 0;

  return (
    <header className="topbar">
      {showDrawerToggle && (
        <button
          className="icon-btn drawer-toggle hover-elevate active-elevate-2"
          aria-label="Show module menu"
          onClick={onOpenDrawer}
        >
          <Menu size={20} strokeWidth={2} />
        </button>
      )}

      <Link className="brand" to="/">
        <span className="brand-mark">U</span>
        <span className="brand-word">THAPAR</span>
        <span className="brand-sub">Admin</span>
      </Link>

      <div className="spacer" />

      <div className="topbar-greeting">
        <span className="small" style={{ fontWeight: 600 }}>
          {greeting(now)}, {admin.name.split(" ")[0]}
        </span>
        <span className="topbar-clock">
          {now.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
          })}
          {" · "}
          {now.toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>

      <button
        className="palette-trigger hover-elevate active-elevate-2"
        onClick={onOpenPalette}
      >
        <Search size={16} strokeWidth={2} />
        Search pages
        <span className="kbd">⌘K</span>
      </button>

      <button
        className="icon-btn hover-elevate active-elevate-2"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggle}
      >
        {theme === "dark" ? (
          <Sun size={20} strokeWidth={2} />
        ) : (
          <Moon size={20} strokeWidth={2} />
        )}
      </button>

      <NotificationBell count={waiting} />
      <AccountMenu onSignOut={onSignOut} />
    </header>
  );
}

function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      className="icon-btn bell hover-elevate active-elevate-2"
      to="/"
      aria-label={
        count ? `${count} things need a person` : "Nothing needs a person"
      }
    >
      <Bell size={20} strokeWidth={2} />
      {count > 0 && (
        <span className="bell-dot animate-pop-in" aria-hidden>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  const { admin } = useAuth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!admin) return null;

  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        className="icon-btn hover-elevate active-elevate-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar">{initials(admin.name)}</span>
      </button>

      {open && (
        <div className="menu animate-fade-up" role="menu">
          <div className="menu-head">
            <div style={{ fontWeight: 600 }}>{admin.name}</div>
            <div className="caption">{ADMIN_ROLE_LABELS[admin.role]}</div>
            <div className="caption">{admin.email}</div>
          </div>
          <button
            className="menu-item hover-elevate active-elevate-2"
            role="menuitem"
            onClick={onSignOut}
          >
            <LogOut size={16} strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function ModuleSidebar({
  module,
  open,
}: {
  module: AppModule;
  open: boolean;
}) {
  const location = useLocation();
  const { data } = useSummary();
  const Icon = module.icon;
  const groups = groupsOf(module);

  return (
    <aside className={`sidebar${open ? " open" : ""}`} aria-label={module.name}>
      <div className="sidebar-title">
        <span
          className="tile-icon"
          style={{
            width: 32,
            height: 32,
            margin: 0,
            background: `color-mix(in srgb, var(${module.tint}) 12%, transparent)`,
          }}
        >
          <Icon size={18} strokeWidth={2} color={`var(${module.tint})`} />
        </span>
        <strong>{module.name}</strong>
      </div>

      <nav className="stack-sm" style={{ gap: 2 }}>
        {groups.map((group) => (
          <div key={group} className="stack-sm" style={{ gap: 2 }}>
            {/* A lone group needs no heading — the module name already said it. */}
            {groups.length > 1 && (
              <p className="sidebar-label">{GROUP_LABELS[group]}</p>
            )}

            {module.pages
              .filter((page) => page.group === group)
              .map((page) => {
                // Only the module root carries filters, so detail pages keep
                // the default page highlighted rather than nothing at all.
                const onRoot = location.pathname === module.path;
                const active = onRoot
                  ? location.search === page.query
                  : page.query === "";
                const count = data && page.count ? page.count(data) : null;

                return (
                  // Plain Link, not NavLink: NavLink matches on pathname alone
                  // and would light up every filter of the same module at once.
                  <Link
                    key={page.query || "default"}
                    to={`${module.path}${page.query}`}
                    className={`side-link hover-elevate active-elevate-2${
                      active ? " active" : ""
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {page.label}
                    {count !== null && count > 0 && (
                      <span className="side-count">{count}</span>
                    )}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <Link className="side-link hover-elevate active-elevate-2" to="/">
          <Home size={16} strokeWidth={2} />
          All modules
        </Link>
        <p className="scope">
          <MapPin size={14} strokeWidth={2} />
          {SCOPE}
        </p>
      </div>
    </aside>
  );
}
