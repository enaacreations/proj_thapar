import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UtensilsCrossed } from "lucide-react";
import {
  MEAL_LABELS,
  type AdminBookingRow,
  type MealHeadcount,
  type VendorSla,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Stat,
} from "../ui";

/** Guest meals are the resident-raised half; the SLA is the half we run. */
export default function Food() {
  const [params] = useSearchParams();
  return params.get("view") === "guests" ? <GuestMeals /> : <Mess />;
}

function Mess() {
  const [sla, setSla] = useState<VendorSla | null>(null);
  const [counts, setCounts] = useState<MealHeadcount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.messSla().then(setSla).catch((e) => setError(messageOf(e)));
    // Today's headcount. A failure here shouldn't blank the quality page, so
    // it's swallowed and the panel just doesn't render.
    const today = new Date().toISOString().slice(0, 10);
    api.mealCounts(today).then(setCounts).catch(() => setCounts(null));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!sla) return <Loading />;

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Mess quality"
        description="What residents are rating their meals, and what the vendor is held to."
      />

      {counts && (
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Cooking for today</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Residents booked in for each meal — the ones who picked it for today
            plus everyone on a recurring plan that covers it. Guests are booked
            separately.
          </p>
          <dl>
            {counts.counts.map((c) => (
              <div className="kv" key={c.meal}>
                <dt>{MEAL_LABELS[c.meal]}</dt>
                <dd className="mono">{c.residents}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="stats">
        <Stat
          label={`Average over ${sla.windowDays} days`}
          value={sla.average ?? "—"}
          tone={sla.breaching ? "danger" : "success"}
          suffix=" / 5"
        />
        <Stat label="Target" value={sla.target} tone="info" suffix=" / 5" />
        <Stat label="Ratings" value={sla.ratingCount} tone="ink" />
      </div>

      {sla.breaching && (
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <strong>Below the agreed standard</strong>
          <p className="small muted" style={{ marginTop: 4 }}>
            The rolling average is under {sla.target}. This is the number to
            raise with the vendor.
          </p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>By meal</h2>
        <dl>
          {sla.byMeal.map((m) => (
            <div className="kv" key={m.meal}>
              <dt>{MEAL_LABELS[m.meal]}</dt>
              <dd className="mono">
                {m.average ?? "—"}
                {m.count > 0 ? ` (${m.count} ratings)` : " (no ratings)"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {sla.worstDishes.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>On the plate when people rated badly</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Dishes served during meals rated 2 or below — the actionable part.
          </p>
          <dl>
            {sla.worstDishes.map((d) => (
              <div className="kv" key={d.name}>
                <dt>{d.name}</dt>
                <dd className="mono">
                  {d.average} avg · {d.count} low ratings
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function GuestMeals() {
  const [rows, setRows] = useState<AdminBookingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminGuestMeals()
      .then(setRows)
      .catch((e) => setError(messageOf(e)));
  }, []);

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Guest meals"
        description="Meals residents booked for visitors. The mess cooks to this count."
      />

      {error ? (
        <ErrorState message={error} />
      ) : !rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No guest meals booked"
          description="Residents book a day ahead, so the kitchen has notice."
        />
      ) : (
        <div className="list">
          {rows.map((row) => (
            <div className="card" key={row.id}>
              <div className="section-head">
                <div className="grow stack-sm">
                  <strong>{row.title}</strong>
                  <span className="small muted">
                    <Link to={`/residents/${row.residentId}`}>
                      {row.residentName}
                    </Link>
                    {row.roomNumber ? ` · Room ${row.roomNumber}` : ""}
                  </span>
                  <span className="caption">{row.date}</span>
                </div>
                <span className="badge pending">Booked</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
