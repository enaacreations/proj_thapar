import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MapPin } from "lucide-react";
import { ADMIN_ROLE_LABELS } from "@proj/shared";
import { useAuth } from "../auth";
import { useSummary } from "../summary";
import { SCOPE, launcherModules } from "../modules";
import { ErrorState, Loading, ModuleTile, Stat, greeting } from "../ui";

/**
 * Home is the launcher, and it opens onto three doors: the queue you sweep,
 * everything else you run, and the console's own settings. A fourth tile is a
 * decision to make before work starts, so every area lives behind Operations.
 */
export default function Dashboard() {
  const { admin } = useAuth();
  const { data, error, reload } = useSummary();
  const hello = useGreeting();

  const modules = useMemo(
    () => (admin ? launcherModules(admin.role) : []),
    [admin]
  );

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
        <h2>Where you work</h2>
      </div>

      <div className="tiles lead">
        {modules.map((mod) => (
          <ModuleTile
            key={mod.key}
            module={mod}
            nudge={mod.nudge?.(data) ?? null}
          />
        ))}
      </div>
    </div>
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
