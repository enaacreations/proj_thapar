import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import type { RegistrationDetail as Detail } from "@proj/shared";
import { api, messageOf } from "../api";
import {
  ErrorState,
  Loading,
  Modal,
  StatusBadge,
  formatDateTime,
  useToast,
} from "../ui";

export default function RegistrationDetail() {
  const { id = "" } = useParams();
  const toast = useToast();

  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [revealKyc, setRevealKyc] = useState(false);
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.registration(id));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async () => {
    if (!confirm) return;

    if (confirm === "reject" && note.trim().length < 5) {
      setNoteError("Give a short reason. The resident sees this.");
      return;
    }

    setBusy(true);
    setNoteError(null);
    try {
      const updated =
        confirm === "approve"
          ? await api.approve(id, note.trim() || undefined)
          : await api.reject(id, note.trim());

      setData(updated);
      setConfirm(null);
      setNote("");
      toast.show(
        confirm === "approve"
          ? `${updated.fullName} can now sign in`
          : `${updated.fullName}'s registration was rejected`,
        confirm === "approve" ? "success" : "info"
      );
    } catch (err) {
      // A 409 means someone else just decided it — refresh rather than retry.
      setNoteError(messageOf(err));
      void load();
    } finally {
      setBusy(false);
    }
  };

  const pending = data?.status === "pending_approval";

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      {loading && !data ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState
          message={error ?? "Couldn't load this registration."}
          onRetry={() => void load()}
        />
      ) : (
        <>
          <div className="card">
            <div className="card-row">
              <span className="avatar" style={{ width: 48, height: 48, fontSize: 17 }}>
                {data.fullName.charAt(0)}
              </span>
              <div className="grow stack-sm">
                <h1>{data.fullName}</h1>
                <p className="mono small muted">{data.residentId}</p>
              </div>
              <StatusBadge status={data.status} />
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Details to verify</h2>
            <dl>
              <Row label="Mobile number" value={data.mobile} mono />
              <Row label="Date of birth" value={data.dob} mono />
              <Row label="Age" value={`${data.age} years`} />
              <Row
                label="Gender"
                value={data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}
              />
              <div className="kv">
                <dt>{data.kycType === "pan" ? "PAN number" : "Aadhaar number"}</dt>
                <dd className="inline">
                  <span className="mono">
                    {revealKyc ? data.kycNumber : data.kycMasked}
                  </span>
                  <button
                    className="link-btn inline"
                    onClick={() => setRevealKyc((v) => !v)}
                    aria-label={revealKyc ? "Hide KYC number" : "Show KYC number"}
                  >
                    {revealKyc ? <EyeOff size={15} /> : <Eye size={15} />}
                    {revealKyc ? "Hide" : "Show"}
                  </button>
                </dd>
              </div>
              <Row label="Submitted" value={formatDateTime(data.submittedAt)} />
            </dl>
          </div>

          {data.status !== "pending_approval" && (
            <div className="card">
              <h2 style={{ marginBottom: 12 }}>Decision</h2>
              <dl>
                <Row label="Reviewed by" value={data.reviewedBy ?? "—"} />
                <Row
                  label="Reviewed on"
                  value={data.reviewedAt ? formatDateTime(data.reviewedAt) : "—"}
                />
                <Row label="Note" value={data.reviewNote ?? "—"} />
              </dl>
            </div>
          )}

          {pending && (
            <div className="card">
              <div className="stack">
                <div className="stack-sm">
                  <h2>Ready to decide?</h2>
                  <p className="muted small">
                    Approving lets this resident sign in straight away. They're
                    notified either way.
                  </p>
                </div>
                <div className="btn-row">
                  <button className="btn" onClick={() => setConfirm("approve")}>
                    Approve registration
                  </button>
                  <button
                    className="btn outline"
                    onClick={() => setConfirm("reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
          setNote("");
          setNoteError(null);
        }}
        title={
          confirm === "approve" ? "Approve this registration?" : "Reject this registration?"
        }
        description={
          confirm === "approve"
            ? `${data?.fullName} will be able to sign in to the app immediately.`
            : `${data?.fullName} will be told why, and won't be able to sign in.`
        }
      >
        <div className="field">
          <label htmlFor="note">
            {confirm === "approve" ? "Note (optional)" : "Reason for rejecting"}
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError(null);
            }}
            placeholder={
              confirm === "approve"
                ? "Anything worth recording"
                : "e.g. Aadhaar number doesn't match the document."
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
            className={confirm === "approve" ? "btn" : "btn destructive"}
            onClick={() => void decide()}
            disabled={busy}
          >
            {busy
              ? "Saving…"
              : confirm === "approve"
                ? "Yes, approve"
                : "Yes, reject"}
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setConfirm(null);
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

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{value}</dd>
    </div>
  );
}
