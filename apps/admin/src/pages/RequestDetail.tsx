import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ADMIN_STATUS_OPTIONS,
  REQUEST_STATUS_LABELS,
  type AdminRequestDetail as Detail,
  type RequestStatus,
  type ServiceRequestKind,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  ErrorState,
  KIND_LABELS,
  Loading,
  Modal,
  RequestStatusBadge,
  formatDateTime,
  useToast,
} from "../ui";

const DOT: Record<RequestStatus, string> = {
  submitted: "var(--info)",
  in_progress: "var(--warning)",
  resolved: "var(--success)",
  rejected: "var(--danger)",
  cancelled: "var(--muted)",
};

const ACTION_LABEL: Partial<Record<RequestStatus, string>> = {
  in_progress: "Mark in progress",
  resolved: "Mark resolved",
  rejected: "Decline",
};

export default function RequestDetail() {
  const { kind = "", id = "" } = useParams();
  const toast = useToast();

  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState<RequestStatus | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.requestDetail(kind as ServiceRequestKind, id));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async () => {
    if (!pending) return;

    if (pending === "rejected" && note.trim().length < 5) {
      setNoteError("Give a short reason. The resident sees it.");
      return;
    }

    setBusy(true);
    setNoteError(null);
    try {
      const updated = await api.setRequestStatus(
        kind as ServiceRequestKind,
        id,
        pending,
        note.trim() || undefined
      );
      setData(updated);
      setPending(null);
      setNote("");
      toast.show(
        `${updated.id} is now ${REQUEST_STATUS_LABELS[updated.status].toLowerCase()}`,
        pending === "rejected" ? "info" : "success"
      );
    } catch (err) {
      // A 409 means it was already closed elsewhere — reload rather than retry.
      setNoteError(messageOf(err));
      void load();
    } finally {
      setBusy(false);
    }
  };

  const open =
    data?.status === "submitted" || data?.status === "in_progress";

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      {loading && !data ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState
          message={error ?? "Couldn't load this request."}
          onRetry={() => void load()}
        />
      ) : (
        <>
          <div className="card">
            <div className="card-row">
              <div className="grow stack-sm">
                <h1>{data.title}</h1>
                <p className="small muted">
                  <span className="mono">{data.id}</span> ·{" "}
                  {KIND_LABELS[data.kind]}
                </p>
              </div>
              <RequestStatusBadge status={data.status} />
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Resident</h2>
            <dl>
              <div className="kv">
                <dt>Name</dt>
                <dd>
                  <Link to={`/residents/${data.residentId}`}>
                    {data.residentName}
                  </Link>
                </dd>
              </div>
              <div className="kv">
                <dt>Room</dt>
                <dd>{data.roomNumber ?? "Not allocated"}</dd>
              </div>
              <div className="kv">
                <dt>Raised</dt>
                <dd>{formatDateTime(data.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Details</h2>
            <dl>
              {data.details.map((d) => (
                <div className="kv" key={d.label}>
                  <dt>{d.label}</dt>
                  <dd>{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {data.photoUris.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: 12 }}>Photos</h2>
              <div className="thumbs">
                {data.photoUris.map((uri) => (
                  <img key={uri} src={uri} alt="" />
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Tracking</h2>
            <div className="timeline">
              {data.timeline.map((event, i) => (
                <div className="timeline-row" key={`${event.at}-${i}`}>
                  <div className="timeline-rail">
                    <span
                      className="timeline-dot"
                      style={{ background: DOT[event.status] }}
                    />
                    {i < data.timeline.length - 1 && (
                      <span className="timeline-line" />
                    )}
                  </div>
                  <div className="timeline-body">
                    <strong>{REQUEST_STATUS_LABELS[event.status]}</strong>
                    <p className="muted small">{event.note}</p>
                    <p className="caption">{formatDateTime(event.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {open ? (
            <div className="card">
              <div className="stack">
                <div className="stack-sm">
                  <h2>Move this along</h2>
                  <p className="muted small">
                    The resident gets a notification and sees the note on their
                    tracking timeline.
                  </p>
                </div>
                <div className="btn-row">
                  {ADMIN_STATUS_OPTIONS.filter((s) => s !== data.status).map(
                    (s) => (
                      <button
                        key={s}
                        className={
                          s === "rejected"
                            ? "btn outline"
                            : s === "resolved"
                              ? "btn"
                              : "btn secondary"
                        }
                        onClick={() => setPending(s)}
                      >
                        {ACTION_LABEL[s]}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="muted small">
              This request is closed, so it can't be changed.
            </p>
          )}
        </>
      )}

      <Modal
        open={pending !== null}
        onClose={() => {
          setPending(null);
          setNote("");
          setNoteError(null);
        }}
        title={(pending && ACTION_LABEL[pending]) || ""}
        description={
          pending === "rejected"
            ? "The resident is told why this was declined."
            : "Add a note so the resident knows what happened."
        }
      >
        <div className="field">
          <label htmlFor="note">
            {pending === "rejected" ? "Reason" : "Note (optional)"}
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError(null);
            }}
            placeholder={
              pending === "resolved"
                ? "e.g. Gas refilled and cooling checked."
                : pending === "rejected"
                  ? "e.g. Room key replacement needs a written request."
                  : "e.g. Technician assigned for this evening."
            }
          />
          {noteError && (
            <p className="error-text" role="alert">
              {noteError}
            </p>
          )}
        </div>

        <div className="btn-row">
          <button
            className={pending === "rejected" ? "btn destructive" : "btn"}
            onClick={() => void apply()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setPending(null);
              setNote("");
              setNoteError(null);
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
