import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Inbox } from "lucide-react";
import type {
  RegistrationCounts,
  RegistrationSummary,
  ResidentAccountStatus,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Stat,
  StatusBadge,
  relativeTime,
} from "../ui";

/** The sidebar drives this list, so the status lives in the URL. */
const STATUSES: ResidentAccountStatus[] = [
  "pending_approval",
  "approved",
  "rejected",
];

const COPY: Record<
  ResidentAccountStatus,
  { title: string; lede: string; emptyTitle: string; emptyBody: string }
> = {
  pending_approval: {
    title: "Waiting for review",
    lede: "Check each resident's details against their ID proof before approving.",
    emptyTitle: "Nothing waiting",
    emptyBody:
      "New resident registrations land here for review. You're all caught up.",
  },
  approved: {
    title: "Approved",
    lede: "Residents you've let in. They can sign in to the app now.",
    emptyTitle: "No approvals yet",
    emptyBody: "Residents you approve will be listed here.",
  },
  rejected: {
    title: "Turned down",
    lede: "Registrations you declined, with the reason the resident was given.",
    emptyTitle: "No rejections",
    emptyBody:
      "Registrations you turn down will be listed here with the reason.",
  },
};

export default function Registrations() {
  const [params] = useSearchParams();
  const raw = params.get("status") as ResidentAccountStatus | null;
  const status: ResidentAccountStatus =
    raw && STATUSES.includes(raw) ? raw : "pending_approval";

  const [rows, setRows] = useState<RegistrationSummary[] | null>(null);
  const [counts, setCounts] = useState<RegistrationCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: ResidentAccountStatus) => {
    setLoading(true);
    setError(null);
    try {
      const [list, c] = await Promise.all([
        api.registrations(s),
        api.counts(),
      ]);
      setRows(list);
      setCounts(c);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRows(null);
    void load(status);
  }, [status, load]);

  const copy = COPY[status];

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }} key={status}>
      <PageHeader title={copy.title} description={copy.lede} />

      <div className="stats">
        <Stat label="Waiting for review" value={counts?.pending} tone="warning" />
        <Stat label="Approved" value={counts?.approved} tone="success" />
        <Stat label="Turned down" value={counts?.rejected} tone="danger" />
      </div>

      {loading && !rows ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(status)} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={copy.emptyTitle}
          description={copy.emptyBody}
        />
      ) : (
        <div className="list">
          {rows.map((row) => (
            <Link
              key={row.residentId}
              className="row-card hover-elevate active-elevate-2"
              to={`/registrations/${row.residentId}`}
            >
              <span className="avatar">{row.fullName.charAt(0)}</span>

              <span className="grow stack-sm">
                <span className="inline" style={{ flexWrap: "wrap" }}>
                  <strong>{row.fullName}</strong>
                  <StatusBadge status={row.status} />
                </span>
                <span className="small muted">
                  <span className="mono">{row.residentId}</span> ·{" "}
                  {row.kycType === "pan" ? "PAN" : "Aadhaar"}{" "}
                  <span className="mono">{row.kycMasked}</span>
                </span>
                <span className="caption">
                  Submitted {relativeTime(row.submittedAt)}
                  {row.reviewedBy ? ` · reviewed by ${row.reviewedBy}` : ""}
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
