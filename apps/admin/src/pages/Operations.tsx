import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "../auth";
import { useSummary } from "../summary";
import { OPS_GROUP_LABELS, operationsGroups } from "../modules";
import { ErrorState, Loading, ModuleTile, PageHeader } from "../ui";

/**
 * Operations has no list of its own — this is the index of everything Home no
 * longer shows. Areas stay grouped by the part of the job they belong to, so
 * the screen reads as three short shelves rather than one wall of tiles.
 */
export default function Operations() {
  const { admin } = useAuth();
  const { data, error, reload } = useSummary();
  const [filter, setFilter] = useState("");

  const groups = useMemo(
    () => (admin ? operationsGroups(admin.role) : []),
    [admin]
  );

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map((g) => ({
        ...g,
        modules: g.modules.filter(
          (m) =>
            m.name.toLowerCase().includes(term) ||
            m.description.toLowerCase().includes(term)
        ),
      }))
      .filter((g) => g.modules.length > 0);
  }, [groups, filter]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !admin) return <Loading />;

  const areas = groups.reduce((n, g) => n + g.modules.length, 0);
  const waiting = data.registrations.pending + data.openRequests;

  return (
    <div className="stack animate-fade-up" style={{ gap: 24 }}>
      <PageHeader
        title="Operations"
        description={
          waiting
            ? `${areas} areas · ${data.registrations.pending} waiting for review, ${data.openRequests} open requests`
            : `${areas} areas · nothing waiting on a person right now`
        }
        action={
          <div className="search-field">
            <Search size={18} strokeWidth={2} className="search-icon" />
            <input
              value={filter}
              aria-label="Find an area"
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find an area…"
            />
          </div>
        }
      />

      {shown.length === 0 ? (
        <p className="muted small">
          No area matches “{filter.trim()}”. Try another word.
        </p>
      ) : (
        shown.map(({ group, modules }) => (
          <section key={group} className="stack-sm" style={{ gap: 12 }}>
            <h2 className="group-label">{OPS_GROUP_LABELS[group]}</h2>
            <div className="tiles compact">
              {modules.map((mod) => (
                <ModuleTile
                  key={mod.key}
                  module={mod}
                  variant="compact"
                  nudge={mod.nudge?.(data) ?? null}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
