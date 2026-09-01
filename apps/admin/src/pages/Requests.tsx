import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Inbox } from "lucide-react";
import type {
  AdminRequestSummary,
  RequestStatus,
  ServiceRequestKind,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  KIND_LABELS,
  Loading,
  PageHeader,
  RequestStatusBadge,
  relativeTime,
} from "../ui";

/** Kind comes from the sidebar; status is the in-page filter on top of it. */
const KINDS: ServiceRequestKind[] = [
  "maintenance",
  "laundry",
  "complaint",
  "visit",
];

const STATUS_TABS: { value: RequestStatus | "open"; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "submitted", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Declined" },
];

const LEDE: Record<ServiceRequestKind | "all", string> = {
  all: "Everything residents have raised, across all four modules.",
  maintenance: "Repairs residents have reported in their rooms and common areas.",
  laundry: "Laundry pickups and drop-offs residents have booked.",
  complaint: "Complaints residents have raised. Reply with what happens next.",
  visit: "Visitor passes residents have asked for.",
};

export default function Requests() {
  const [params] = useSearchParams();
  const rawKind = params.get("kind") as ServiceRequestKind | null;
  const kind: ServiceRequestKind | "all" =
    rawKind && KINDS.includes(rawKind) ? rawKind : "all";

  const [status, setStatus] = useState<RequestStatus | "open">("open");
  const [rows, setRows] = useState<AdminRequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.requests({
        kind: kind === "all" ? undefined : kind,
        // "Open" isn't a stored status — it's submitted + in_progress, so it's
        // fetched unfiltered and narrowed here.
        status: status === "open" ? undefined : status,
      });
      setRows(
        status === "open"
          ? list.filter(
              (r) => r.status === "submitted" || r.status === "in_progress"
            )
          : list
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [kind, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title={kind === "all" ? "All requests" : KIND_LABELS[kind]}
        description={LEDE[kind]}
      />

      <div className="tabs" role="tablist" aria-label="Status">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={status === t.value}
            className="tab hover-elevate active-elevate-2"
            onClick={() => setStatus(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !rows ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing here"
          description="No requests match these filters right now."
        />
      ) : (
        <div className="list">
          {rows.map((row) => (
            <Link
              key={`${row.kind}-${row.id}`}
              className="row-card hover-elevate active-elevate-2"
              to={`/requests/${row.kind}/${row.id}`}
            >
              <span className="grow stack-sm">
                <span className="inline" style={{ flexWrap: "wrap" }}>
                  <strong>{row.title}</strong>
                  <RequestStatusBadge status={row.status} />
                  {kind === "all" && (
                    <span className="badge neutral">
                      {KIND_LABELS[row.kind]}
                    </span>
                  )}
                </span>
                <span className="small muted">
                  <span className="mono">{row.id}</span> · {row.residentName}
                  {row.roomNumber ? ` · Room ${row.roomNumber}` : ""}
                </span>
                <span className="caption">
                  Raised {relativeTime(row.createdAt)}
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
