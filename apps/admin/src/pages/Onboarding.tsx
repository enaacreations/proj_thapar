import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, UserPlus } from "lucide-react";
import {
  KYC_STATUS_LABELS,
  LEASE_STATUS_LABELS,
  type AdminOnboardingRow,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  Loading,
  Meter,
  PageHeader,
  Stat,
  initials,
} from "../ui";

type Filter = "all" | "kyc" | "lease" | "done";

const COPY: Record<
  Filter,
  { title: string; lede: string; emptyTitle: string; emptyBody: string }
> = {
  all: {
    title: "Everyone moving in",
    lede: "Check ID documents, issue agreements, and see who's still settling in.",
    emptyTitle: "Nobody to move in",
    emptyBody:
      "Approved residents appear here with their onboarding progress.",
  },
  kyc: {
    title: "Documents to check",
    lede: "IDs waiting for someone to look at them.",
    emptyTitle: "No documents waiting",
    emptyBody: "Every ID that's been uploaded has already been checked.",
  },
  lease: {
    title: "Agreements unsigned",
    lede: "Agreements issued but not signed by the resident yet.",
    emptyTitle: "Nothing unsigned",
    emptyBody: "Every issued agreement has been signed.",
  },
  done: {
    title: "Fully moved in",
    lede: "Residents who finished every step of moving in.",
    emptyTitle: "Nobody has finished yet",
    emptyBody: "Residents show up here once every move-in step is done.",
  },
};

export default function Onboarding() {
  const [params] = useSearchParams();
  const raw = params.get("filter") as Filter | null;
  const filter: Filter =
    raw === "kyc" || raw === "lease" || raw === "done" ? raw : "all";

  const [rows, setRows] = useState<AdminOnboardingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.onboardingQueue().then(setRows).catch((e) => setError(messageOf(e)));
  }, []);

  const shown = useMemo(() => {
    if (!rows) return null;
    if (filter === "kyc")
      return rows.filter((r) => r.kycStatus === "under_review");
    if (filter === "lease")
      return rows.filter((r) => r.leaseStatus === "issued");
    if (filter === "done") return rows.filter((r) => r.moveInComplete);
    return rows;
  }, [rows, filter]);

  const copy = COPY[filter];

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader title={copy.title} description={copy.lede} />

      {rows && (
        <div className="stats">
          <Stat
            label="Documents to check"
            value={rows.filter((r) => r.kycStatus === "under_review").length}
            tone="warning"
          />
          <Stat
            label="Agreements unsigned"
            value={rows.filter((r) => r.leaseStatus === "issued").length}
            tone="info"
          />
          <Stat
            label="Fully moved in"
            value={rows.filter((r) => r.moveInComplete).length}
            tone="success"
          />
        </div>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : !shown ? (
        <Loading />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={copy.emptyTitle}
          description={copy.emptyBody}
        />
      ) : (
        <div className="list">
          {shown.map((row) => (
            <Link
              key={row.residentId}
              className="row-card hover-elevate active-elevate-2"
              to={`/onboarding/${row.residentId}`}
            >
              <span className="avatar">{initials(row.fullName)}</span>
              <span className="grow stack-sm">
                <span className="inline" style={{ flexWrap: "wrap" }}>
                  <strong>{row.fullName}</strong>
                  <span
                    className={`badge ${
                      row.kycStatus === "verified"
                        ? "approved"
                        : row.kycStatus === "under_review"
                          ? "pending"
                          : row.kycStatus === "rejected"
                            ? "rejected"
                            : "neutral"
                    }`}
                  >
                    ID: {KYC_STATUS_LABELS[row.kycStatus]}
                  </span>
                  <span
                    className={`badge ${
                      row.leaseStatus === "signed"
                        ? "approved"
                        : row.leaseStatus === "issued"
                          ? "pending"
                          : "neutral"
                    }`}
                  >
                    Lease: {LEASE_STATUS_LABELS[row.leaseStatus]}
                  </span>
                </span>
                <span className="small muted">
                  <span className="mono">{row.mobile}</span> ·{" "}
                  {row.roomNumber ? `Room ${row.roomNumber}` : "No room yet"}
                </span>
                <Meter percent={row.percentComplete} />
              </span>
              <ChevronRight size={18} color="var(--muted)" strokeWidth={2} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
