import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Search, Users } from "lucide-react";
import type { AdminResidentSummary } from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  StatusBadge,
  initials,
} from "../ui";

type Filter = "all" | "no_room" | "open_requests";

const COPY: Record<
  Filter,
  { title: string; lede: string; emptyTitle: string; emptyBody: string }
> = {
  all: {
    title: "Everyone",
    lede: "Allocate rooms, record payments and check attendance.",
    emptyTitle: "No residents yet",
    emptyBody: "Approved registrations show up here.",
  },
  no_room: {
    title: "Without a room",
    lede: "Residents who still need a room allocated.",
    emptyTitle: "Everyone has a room",
    emptyBody: "Nobody is waiting on a room allocation right now.",
  },
  open_requests: {
    title: "With open requests",
    lede: "Residents who are waiting on something from your team.",
    emptyTitle: "Nobody is waiting",
    emptyBody: "No resident has an open request right now.",
  },
};

export default function Residents() {
  const [params] = useSearchParams();
  const raw = params.get("filter") as Filter | null;
  const filter: Filter =
    raw === "no_room" || raw === "open_requests" ? raw : "all";

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminResidentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (term: string) => {
    setError(null);
    try {
      setRows(await api.residents(term || undefined));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Debounced so typing doesn't fire a request per keystroke.
    const id = setTimeout(() => void load(search), 250);
    return () => clearTimeout(id);
  }, [search, load]);

  // The server only knows how to search; the sidebar view narrows what's back.
  const shown = useMemo(() => {
    if (!rows) return null;
    if (filter === "no_room") return rows.filter((r) => !r.roomNumber);
    if (filter === "open_requests")
      return rows.filter((r) => r.openRequests > 0);
    return rows;
  }, [rows, filter]);

  const copy = COPY[filter];

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader title={copy.title} description={copy.lede} />

      <div className="field">
        <label htmlFor="search">Search</label>
        <div className="search-field">
          <Search size={18} strokeWidth={2} className="search-icon" />
          <input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, mobile number or resident ID"
          />
        </div>
      </div>

      {loading && !shown ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(search)} />
      ) : !shown || shown.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No one matches that" : copy.emptyTitle}
          description={
            search ? "Try a different name or number." : copy.emptyBody
          }
        />
      ) : (
        <div className="list">
          {shown.map((row) => (
            <Link
              key={row.id}
              className="row-card hover-elevate active-elevate-2"
              to={`/residents/${row.id}`}
            >
              <span className="avatar">{initials(row.fullName)}</span>
              <span className="grow stack-sm">
                <span className="inline" style={{ flexWrap: "wrap" }}>
                  <strong>{row.fullName}</strong>
                  <StatusBadge status={row.accountStatus} />
                  {row.openRequests > 0 && (
                    <span className="badge pending">
                      {row.openRequests} open
                    </span>
                  )}
                </span>
                <span className="small muted">
                  <span className="mono">{row.mobile}</span> ·{" "}
                  {row.roomNumber
                    ? `Room ${row.roomNumber}`
                    : "No room allocated"}
                </span>
              </span>
              <ChevronRight size={18} color="var(--muted)" strokeWidth={2} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
