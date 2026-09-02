import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type {
  AdminRequestSummary,
  RequestStatus,
  ServiceRequestKind,
} from "@proj/shared";
import { api, messageOf } from "../api";
import { REQUEST_MODULE_PATH } from "../modules";
import {
  EmptyState,
  ErrorState,
  KIND_LABELS,
  Loading,
  PageHeader,
  RequestStatusBadge,
  relativeTime,
} from "../ui";

/**
 * The same list serves every request module. The kind is fixed by the route
 * — one module owns one kind — and the sidebar drives the status, so both the
 * filter and the URL say the same thing.
 */
type Filter = Extract<
  RequestStatus,
  "submitted" | "in_progress" | "resolved" | "rejected"
> | "open";

const FILTERS: Filter[] = [
  "open",
  "submitted",
  "in_progress",
  "resolved",
  "rejected",
];

const STATUS_COPY: Record<Filter, string> = {
  open: "Open",
  submitted: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Declined",
};

/** Reads as a sentence after the status word: "Open laundry pickups". */
const NOUN: Record<ServiceRequestKind | "all", string> = {
  all: "requests",
  maintenance: "maintenance requests",
  laundry: "laundry pickups",
  complaint: "complaints",
  visit: "visitor passes",
};

const LEDE: Record<ServiceRequestKind | "all", string> = {
  all: "One queue across every module, for a morning sweep.",
  maintenance: "Repairs residents have reported in their rooms and common areas.",
  laundry: "Laundry pickups and drop-offs residents have booked.",
  complaint: "Complaints residents have raised. Reply with what happens next.",
  visit: "Visitor passes residents have asked for.",
};

export default function Requests({ kind }: { kind?: ServiceRequestKind }) {
  const [params] = useSearchParams();
  const raw = params.get("status") as Filter | null;
  const status: Filter = raw && FILTERS.includes(raw) ? raw : "open";
  const scope = kind ?? "all";

  const [rows, setRows] = useState<AdminRequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.requests({
        kind,
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

  // Kind used to be a filter on this one page; now it's a module of its own.
  const bookmarked = params.get("kind") as ServiceRequestKind | null;
  if (!kind && bookmarked && bookmarked in REQUEST_MODULE_PATH) {
    return <Navigate to={REQUEST_MODULE_PATH[bookmarked]} replace />;
  }

  // Inside a module, a request opens within that module so the back link goes
  // where you came from. The cross-module queue keeps its own detail route.
  const hrefFor = (row: AdminRequestSummary) =>
    kind
      ? `${REQUEST_MODULE_PATH[row.kind]}/${row.id}`
      : `/requests/${row.kind}/${row.id}`;

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        // The default page is the whole queue, so it's named for what it is
        // rather than "Open requests", which reads like one more filter.
        title={
          status === "open" && scope === "all"
            ? "All requests"
            : `${STATUS_COPY[status]} ${NOUN[scope]}`
        }
        description={LEDE[scope]}
      />

      {loading && !rows ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing here"
          description={
            status === "open"
              ? "Nothing is waiting on anyone right now."
              : `No ${NOUN[scope]} with that status.`
          }
        />
      ) : (
        <div className="list">
          {rows.map((row) => (
            <Link
              key={`${row.kind}-${row.id}`}
              className="row-card hover-elevate active-elevate-2"
              to={hrefFor(row)}
            >
              {/* Who, where and how long — the three things that decide
                  whether a row is worth opening, on one line. */}
              <span className="grow">
                <strong style={{ display: "block", fontSize: 15 }}>
                  {row.title}
                </strong>
                <span className="small muted" style={{ display: "block" }}>
                  {row.residentName}
                  {row.roomNumber ? ` · ${row.roomNumber}` : ""} ·{" "}
                  {relativeTime(row.createdAt)}
                </span>
              </span>

              {/* Inside a module every row is the same kind, so the chip only
                  earns its place on the cross-module queue. */}
              {!kind && (
                <span className="badge outline">{KIND_LABELS[row.kind]}</span>
              )}
              <RequestStatusBadge status={row.status} />
              <ChevronRight size={16} color="var(--muted)" strokeWidth={2} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
