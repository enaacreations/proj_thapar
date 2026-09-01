import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MapPin, Search } from "lucide-react";
import { ADMIN_ROLE_LABELS } from "@proj/shared";
import { useAuth } from "../auth";
import { useSummary } from "../summary";
import { SCOPE, modulesFor, type AppModule } from "../modules";
import { ErrorState, Loading, Stat, greeting } from "../ui";

/**
 * Home is the launcher: a greeting, the three numbers worth knowing before
 * you start, and one tile per module. Everything deeper — lists, details,
 * filters — lives behind a tile, so this screen never grows a fourth section.
 */
export default function Dashboard() {
  const { admin } = useAuth();
  const { data, error, reload } = useSummary();
  const hello = useGreeting();
  const [filter, setFilter] = useState("");

  const modules = useMemo(
    () => (admin ? modulesFor(admin.role) : []),
    [admin]
  );

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return modules;
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.description.toLowerCase().includes(term)
    );
  }, [modules, filter]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !admin) return <Loading />;

  const waiting = data.registrations.pending + data.openRequests;

  return (
    <div className="stack animate-fade-up" style={{ gap: 24 }}>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            {hello}, {admin.name.split(" ")[0]}
          </h1>
          <p className="muted inline" style={{ fontSize: 14, gap: 6 }}>
            <MapPin size={14} strokeWidth={2} />
            {SCOPE} · {ADMIN_ROLE_LABELS[admin.role]}
          </p>
        </div>

        {waiting === 0 ? (
          <p className="badge approved animate-pop-in">
            <CheckCircle2 size={14} strokeWidth={2} />
            All caught up
          </p>
        ) : (
          <p className="badge accent">
            <span className="live-dot animate-pulse-dot" />
            {waiting} {waiting === 1 ? "thing needs" : "things need"} a person
          </p>
        )}
      </section>

      <div className="stats">
        <Stat
          label="Waiting for review"
          value={data.registrations.pending}
          tone="warning"
        />
        <Stat label="Open requests" value={data.openRequests} tone="danger" />
        <Stat
          label="Marked in today"
          value={data.attendanceToday}
          suffix={`/${data.residents.total}`}
          tone="success"
        />
      </div>

      <div className="section-head">
        <h2>Your modules</h2>
        <div className="search-field">
          <Search size={18} strokeWidth={2} className="search-icon" />
          <input
            value={filter}
            aria-label="Find a module"
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a module…"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="muted small">
          No module matches “{filter.trim()}”. Try another word.
        </p>
      ) : (
        <div className="tiles">
          {shown.map((mod) => (
            <Tile key={mod.key} module={mod} nudge={mod.nudge?.(data) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  module,
  nudge,
}: {
  module: AppModule;
  nudge: string | null;
}) {
  const [from, to, tint, tint2] = module.gradient;

  return (
    <Link
      className="tile"
      to={module.path}
      // The four colours the tile's CSS paints itself from.
      style={
        {
          "--tile-from": from,
          "--tile-to": to,
          "--tile-tint": tint,
          "--tile-tint-2": tint2,
        } as CSSProperties
      }
    >
      <span className="tile-badge">
        <module.icon size={30} strokeWidth={2} />
      </span>
      <span className="tile-name">{module.name}</span>
      {nudge && <span className="nudge">{nudge}</span>}
    </Link>
  );
}

/**
 * "Good morning" has to survive someone leaving the tab open past noon, so it
 * re-renders on the hour boundary rather than polling on a timer.
 */
function useGreeting(): string {
  const [hello, setHello] = useState(() => greeting());

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;

    // Re-arms itself rather than keying off the greeting: most hour boundaries
    // don't change the word, and a no-op setState wouldn't schedule the next.
    const schedule = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);

      id = setTimeout(() => {
        setHello(greeting());
        schedule();
      }, nextHour.getTime() - now.getTime());
    };

    schedule();
    return () => clearTimeout(id);
  }, []);

  return hello;
}
