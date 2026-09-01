import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Shirt } from "lucide-react";
import {
  LAUNDRY_PIPELINE,
  LAUNDRY_SERVICE_LABELS,
  LAUNDRY_STAGE_LABELS,
  type AdminLaundryRow,
  type LaundryStage,
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
import Requests from "./Requests";

/**
 * One module, two lenses on the same bags: the request list residents see
 * themselves, and the pipeline board the laundry run is worked from.
 */
export default function Laundry() {
  const [params] = useSearchParams();
  return params.get("view") === "board" ? (
    <LaundryBoard />
  ) : (
    <Requests kind="laundry" />
  );
}

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

  const open =
    rows?.filter((r) => r.stage !== "delivered" && r.stage !== "cancelled") ?? [];

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Pipeline board"
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
                      <Link className="mono" to={`/laundry/${row.id}`}>
                        {row.id}
                      </Link>{" "}
                      · {LAUNDRY_SERVICE_LABELS[row.service]} · {row.totalPieces}{" "}
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
