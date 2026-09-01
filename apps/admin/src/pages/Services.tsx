import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChefHat, Sparkles, Shirt, CalendarDays } from "lucide-react";
import {
  BOOKING_STATUS_LABELS,
  LAUNDRY_PIPELINE,
  LAUNDRY_SERVICE_LABELS,
  LAUNDRY_STAGE_LABELS,
  MEAL_LABELS,
  type AdminBookingRow,
  type AdminLaundryRow,
  type LaundryStage,
  type VendorSla,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Stat,
  useToast,
} from "../ui";

type View = "mess" | "laundry" | "housekeeping" | "amenities";

export default function Services() {
  const [params] = useSearchParams();
  const raw = params.get("view");
  const view: View =
    raw === "laundry" || raw === "housekeeping" || raw === "amenities"
      ? raw
      : "mess";

  if (view === "laundry") return <LaundryBoard />;
  if (view === "housekeeping") return <Bookings kind="housekeeping" />;
  if (view === "amenities") return <Bookings kind="amenities" />;
  return <Mess />;
}

/* ------------------------------------------------------------------ mess */

function Mess() {
  const [sla, setSla] = useState<VendorSla | null>(null);
  const [guests, setGuests] = useState<AdminBookingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.messSla().then(setSla).catch((e) => setError(messageOf(e)));
    api.adminGuestMeals().then(setGuests).catch(() => setGuests([]));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!sla) return <Loading />;

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Mess quality"
        description="What residents are rating their meals, and what the vendor is held to."
      />

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

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Guest meals booked</h2>
        {!guests || guests.length === 0 ? (
          <p className="muted small">Nothing booked.</p>
        ) : (
          <dl>
            {guests.map((g) => (
              <div className="kv" key={g.id}>
                <dt>{g.date}</dt>
                <dd>
                  <Link to={`/residents/${g.residentId}`}>{g.residentName}</Link>
                  {" · "}
                  {g.title}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- laundry */

function LaundryBoard() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminLaundryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.laundryBoard());
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async (row: AdminLaundryRow) => {
    const next = LAUNDRY_PIPELINE[LAUNDRY_PIPELINE.indexOf(row.stage) + 1];
    if (!next) return;

    try {
      await api.setLaundryStage(row.id, next);
      await load();
      toast.show(`${row.id} → ${LAUNDRY_STAGE_LABELS[next]}`, "success");
    } catch (err) {
      toast.show(messageOf(err), "danger");
    }
  };

  const open = rows?.filter((r) => r.stage !== "delivered" && r.stage !== "cancelled") ?? [];

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Laundry"
        description="Move each bag along so residents can see where their clothes are."
      />

      {rows && (
        <div className="stats">
          <Stat label="In the system" value={open.length} tone="warning" />
          <Stat
            label="Ready or out"
            value={
              open.filter(
                (r) => r.stage === "ready" || r.stage === "out_for_delivery"
              ).length
            }
            tone="info"
          />
          <Stat
            label="Delivered"
            value={rows.filter((r) => r.stage === "delivered").length}
            tone="success"
          />
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="No laundry"
          description="Bags residents send appear here as they're booked."
        />
      ) : (
        <div className="list">
          {rows.map((row) => {
            const next: LaundryStage | undefined =
              LAUNDRY_PIPELINE[LAUNDRY_PIPELINE.indexOf(row.stage) + 1];

            return (
              <div className="card" key={row.id}>
                <div className="section-head">
                  <div className="grow stack-sm">
                    <strong>
                      <Link to={`/residents/${row.residentId}`}>
                        {row.residentName}
                      </Link>
                      {row.roomNumber ? ` · Room ${row.roomNumber}` : ""}
                    </strong>
                    <span className="small muted">
                      <span className="mono">{row.id}</span> ·{" "}
                      {LAUNDRY_SERVICE_LABELS[row.service]} · {row.totalPieces}{" "}
                      pieces
                    </span>
                    <span className="caption">{row.pickupSlot}</span>
                  </div>
                  <div className="inline">
                    <span
                      className={`badge ${
                        row.stage === "delivered"
                          ? "approved"
                          : row.stage === "cancelled"
                            ? "neutral"
                            : "pending"
                      }`}
                    >
                      {LAUNDRY_STAGE_LABELS[row.stage]}
                    </span>
                    {next && (
                      <button
                        className="btn secondary"
                        onClick={() => void advance(row)}
                      >
                        Mark {LAUNDRY_STAGE_LABELS[next].toLowerCase()}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- bookings */

function Bookings({ kind }: { kind: "housekeeping" | "amenities" }) {
  const toast = useToast();
  const [rows, setRows] = useState<AdminBookingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(
        kind === "housekeeping"
          ? await api.housekeepingBookings()
          : await api.amenityBookings()
      );
    } catch (err) {
      setError(messageOf(err));
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: "in_progress" | "done") => {
    try {
      await api.setHousekeepingStatus(id, status);
      await load();
      toast.show("Updated", "success");
    } catch (err) {
      toast.show(messageOf(err), "danger");
    }
  };

  const copy =
    kind === "housekeeping"
      ? {
          title: "Housekeeping",
          lede: "Cleans booked by residents, in slot order.",
          empty: "Nothing booked right now.",
          icon: Sparkles,
        }
      : {
          title: "Space bookings",
          lede: "Who has the study room, gaming zone and BBQ.",
          empty: "No spaces booked yet.",
          icon: CalendarDays,
        };

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader title={copy.title} description={copy.lede} />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={copy.icon} title="Nothing here" description={copy.empty} />
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
                  <span className="caption">
                    {row.date} · {row.slot}
                  </span>
                </div>
                <div className="inline">
                  <span
                    className={`badge ${
                      row.status === "done"
                        ? "approved"
                        : row.status === "in_progress"
                          ? "pending"
                          : "neutral"
                    }`}
                  >
                    {BOOKING_STATUS_LABELS[row.status]}
                  </span>
                  {kind === "housekeeping" && row.status === "booked" && (
                    <button
                      className="btn secondary"
                      onClick={() => void setStatus(row.id, "in_progress")}
                    >
                      Start
                    </button>
                  )}
                  {kind === "housekeeping" && row.status === "in_progress" && (
                    <button
                      className="btn"
                      onClick={() => void setStatus(row.id, "done")}
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
