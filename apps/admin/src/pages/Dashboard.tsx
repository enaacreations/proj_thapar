import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MapPin, Search } from "lucide-react";
import { ADMIN_ROLE_LABELS } from "@proj/shared";
import { useAuth } from "../auth";
import { useSummary } from "../summary";
import { SCOPE, modulesFor } from "../modules";
import {
  ErrorState,
  Loading,
  ProgressRing,
  Stat,
  greeting,
  useClock,
} from "../ui";

/** Home is the launcher: module tiles with a live nudge when work is waiting. */
export default function Dashboard() {
  const { admin } = useAuth();
  const { data, error, reload } = useSummary();
  const now = useClock();
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

  // Today's ring is attendance: how many residents are marked in so far.
  const markedIn = data.attendanceToday;
  const total = data.residents.total;
  const percent = total ? (markedIn / total) * 100 : 0;
  const waiting = data.registrations.pending + data.openRequests;

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <section className="hero">
        <ProgressRing
          percent={percent}
          label={`${markedIn}/${total}`}
        />
        <div className="hero-copy">
          <h1>
            {greeting(now)}, {admin.name.split(" ")[0]}
          </h1>
          <p className="muted small">
            {markedIn} of {total} residents are marked in today.
          </p>
          <p className="caption inline">
            <MapPin size={13} strokeWidth={2} />
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
          {shown.map((mod) => {
            const nudge = mod.nudge?.(data) ?? null;
            return (
              <Link
                key={mod.key}
                className="tile hover-elevate active-elevate-2"
                to={mod.path}
              >
                <span
                  className="tile-icon"
                  style={{
                    background: `color-mix(in srgb, var(${mod.tint}) 12%, transparent)`,
                  }}
                >
                  <mod.icon
                    size={22}
                    color={`var(${mod.tint})`}
                    strokeWidth={2}
                  />
                </span>
                <strong>{mod.name}</strong>
                <span className="small muted">{mod.description}</span>
                {nudge && <span className="nudge">{nudge}</span>}
              </Link>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Open requests by type</h2>
        </div>
        <dl>
          <Row
            label="Maintenance"
            value={data.requestsByKind.maintenance}
            to="/requests?kind=maintenance"
          />
          <Row
            label="Laundry"
            value={data.requestsByKind.laundry}
            to="/requests?kind=laundry"
          />
          <Row
            label="Complaints"
            value={data.requestsByKind.complaint}
            to="/requests?kind=complaint"
          />
          <Row
            label="Visits"
            value={data.requestsByKind.visit}
            to="/requests?kind=visit"
          />
        </dl>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  to,
}: {
  label: string;
  value: number;
  to: string;
}) {
  return (
    <div className="kv">
      <dt>
        <Link to={to}>{label}</Link>
      </dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}
