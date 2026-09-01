import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Inbox } from "lucide-react";
import type {
  RegistrationCounts,
  RegistrationSummary,
  ResidentAccountStatus,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  ErrorState,
  Loading,
  EmptyState,
  StatusBadge,
  relativeTime,
} from "../ui";

const TABS: { value: ResidentAccountStatus; label: string }[] = [
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const EMPTY: Record<ResidentAccountStatus, { title: string; body: string }> = {
  pending_approval: {
    title: "Nothing waiting",
    body: "New resident registrations land here for review. You're all caught up.",
  },
  approved: {
    title: "No approvals yet",
    body: "Residents you approve will be listed here.",
  },
  rejected: {
    title: "No rejections",
    body: "Registrations you turn down will be listed here with the reason.",
  },
};

export default function Registrations() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ResidentAccountStatus>("pending_approval");
  const [rows, setRows] = useState<RegistrationSummary[] | null>(null);
  const [counts, setCounts] = useState<RegistrationCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (status: ResidentAccountStatus) => {
    setLoading(true);
    setError(null);
    try {
      const [list, c] = await Promise.all([
        api.registrations(status),
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
    void load(tab);
  }, [tab, load]);

  return (
    <>
      <div className="stack-sm">
        <h1>Registrations</h1>
        <p className="muted small">
          Check each resident's details against their ID proof before approving.
        </p>
      </div>

      <div className="stats">
        <Stat label="Pending review" value={counts?.pending} tone="warning" />
        <Stat label="Approved" value={counts?.approved} tone="success" />
        <Stat label="Rejected" value={counts?.rejected} tone="danger" />
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            className="tab"
            onClick={() => setTab(t.value)}
          >
            {t.label}
            {t.value === "pending_approval" && counts && counts.pending > 0
              ? ` (${counts.pending})`
              : ""}
          </button>
        ))}
      </div>

      {loading && !rows ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(tab)} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={EMPTY[tab].title}
          description={EMPTY[tab].body}
        />
      ) : (
        <div className="list">
          {rows.map((row) => (
            <button
              key={row.residentId}
              className="row-card"
              onClick={() => navigate(`/registrations/${row.residentId}`)}
            >
              <span className="avatar">{row.fullName.charAt(0)}</span>

              <span className="grow stack-sm">
                <span className="inline">
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
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: "warning" | "success" | "danger";
}) {
  return (
    <div className="card">
      <p className="caption">{label}</p>
      <p className="stat-value" style={{ color: `var(--${tone})` }}>
        {value ?? "—"}
      </p>
    </div>
  );
}
