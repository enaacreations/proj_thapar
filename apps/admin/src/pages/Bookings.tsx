import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Sparkles } from "lucide-react";
import { BOOKING_STATUS_LABELS, type AdminBookingRow } from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  useToast,
} from "../ui";

/** Housekeeping and spaces are the same board; only housekeeping is worked on. */
export default function Bookings({
  kind,
}: {
  kind: "housekeeping" | "amenities";
}) {
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
          title: "Booked cleans",
          lede: "Cleans booked by residents, in slot order. Start one when the housekeeper goes out.",
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
