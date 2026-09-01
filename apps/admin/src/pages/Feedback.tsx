import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { AdminFeedbackEntry } from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Stat,
  relativeTime,
} from "../ui";

export default function Feedback() {
  const [rows, setRows] = useState<AdminFeedbackEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.feedback().then(setRows).catch((e) => setError(messageOf(e)));
  }, []);

  const average =
    rows && rows.length
      ? Math.round(
          (rows.reduce((sum, r) => sum + r.rating, 0) / rows.length) * 10
        ) / 10
      : null;

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="All feedback"
        description="What residents are saying about the mess, rooms and facilities."
      />

      {average !== null && (
        <div className="stats">
          <Stat
            label="Average rating"
            value={average}
            tone="warning"
            suffix=" / 5"
          />
          <Stat
            label="Ratings left"
            value={rows?.length ?? 0}
            tone="info"
          />
        </div>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : !rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No feedback yet"
          description="Ratings residents leave in the app show up here."
        />
      ) : (
        <div className="list">
          {rows.map((row) => (
            <div className="card" key={row.id}>
              <div className="section-head">
                <strong>
                  {row.categoryLabel} · {row.subCategoryLabel}
                </strong>
                <Stars rating={row.rating} />
              </div>
              {row.remarks && (
                <p className="muted small" style={{ marginTop: 6 }}>
                  {row.remarks}
                </p>
              )}
              <p className="caption" style={{ marginTop: 6 }}>
                <Link to={`/residents/${row.residentId}`}>
                  {row.residentName}
                </Link>{" "}
                · {relativeTime(row.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Rating is shown as stars and the number, never colour alone. */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline">
      <span className="stars" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={15}
            strokeWidth={1.75}
            fill={n <= rating ? "var(--warning)" : "transparent"}
            color={n <= rating ? "var(--warning)" : "var(--muted)"}
          />
        ))}
      </span>
      <span className="small muted">{rating} of 5</span>
    </span>
  );
}
