import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, FileSignature, Minus, Plus, X } from "lucide-react";
import {
  CONDITION_LABELS,
  FOOD_PREF_LABELS,
  KYC_DOCUMENT_LABELS,
  KYC_STATUS_LABELS,
  LEASE_STATUS_LABELS,
  SLEEP_LABELS,
  STUDY_LABELS,
  type AdminOnboardingDetail as Detail,
  type IssueLeaseBody,
  type RoommateMatch,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  ErrorState,
  Loading,
  Meter,
  Modal,
  formatDateTime,
  useToast,
} from "../ui";

const today = () => new Date().toISOString().slice(0, 10);
const inSixMonths = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
};

export default function OnboardingDetail() {
  const { id = "" } = useParams();
  const toast = useToast();

  const [data, setData] = useState<Detail | null>(null);
  const [matches, setMatches] = useState<RoommateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [reviewing, setReviewing] = useState<"verified" | "rejected" | null>(null);
  const [reason, setReason] = useState("");
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [lease, setLease] = useState<IssueLeaseBody>({
    monthlyRent: 18500,
    securityDeposit: 37000,
    noticePeriodDays: 30,
    startDate: today(),
    endDate: inSixMonths(),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, compat] = await Promise.all([
        api.onboardingDetail(id),
        api.compatibility(id).catch(() => []),
      ]);
      setData(detail);
      setMatches(compat);
    } catch (err) {
      setError(messageOf(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async () => {
    if (!reviewing) return;
    if (reviewing === "rejected" && reason.trim().length < 5) {
      setFormError("Say what was wrong. The resident sees this.");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      await api.reviewKyc(id, reviewing, reason.trim() || undefined);
      await load();
      setReviewing(null);
      setReason("");
      toast.show(
        reviewing === "verified" ? "ID verified" : "Documents rejected",
        reviewing === "verified" ? "success" : "info"
      );
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const issue = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.issueLease(id, lease);
      await load();
      setLeaseOpen(false);
      toast.show("Agreement issued", "success");
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <Loading />;

  const canReview =
    data.kyc.status === "under_review" || data.kyc.status === "awaiting_documents";

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <div className="card">
        <div className="card-row">
          <div className="grow stack-sm">
            <h1>{data.fullName}</h1>
            <p className="small muted">
              <span className="mono">{data.mobile}</span> ·{" "}
              {data.roomNumber ? `Room ${data.roomNumber}` : "No room yet"} ·{" "}
              <Link to={`/residents/${data.residentId}`}>Full profile</Link>
            </p>
            <span className="caption">Move-in progress</span>
            <Meter percent={data.percentComplete} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ KYC */}
      <div className="card">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2>ID documents</h2>
          <span
            className={`badge ${
              data.kyc.status === "verified"
                ? "approved"
                : data.kyc.status === "rejected"
                  ? "rejected"
                  : "pending"
            }`}
          >
            {KYC_STATUS_LABELS[data.kyc.status]}
          </span>
        </div>

        {data.kyc.documents.length === 0 ? (
          <p className="muted small">Nothing uploaded yet.</p>
        ) : (
          <div className="thumbs">
            {data.kyc.documents.map((doc) => (
              <figure key={doc.id} style={{ margin: 0 }}>
                <img src={doc.uri} alt={KYC_DOCUMENT_LABELS[doc.type]} />
                <figcaption className="caption">
                  {KYC_DOCUMENT_LABELS[doc.type]}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {data.kyc.rejectionReason && (
          <p className="error-text" style={{ marginTop: 8 }}>
            {data.kyc.rejectionReason}
          </p>
        )}
        {data.kyc.reviewedBy && (
          <p className="caption" style={{ marginTop: 8 }}>
            Reviewed by {data.kyc.reviewedBy}
            {data.kyc.reviewedAt ? ` · ${formatDateTime(data.kyc.reviewedAt)}` : ""}
            {data.kyc.reference ? ` · ref ${data.kyc.reference}` : ""}
          </p>
        )}

        {canReview && data.kyc.documents.length > 0 && (
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setReviewing("verified")}>
              <Check size={18} strokeWidth={2} />
              Verify
            </button>
            <button className="btn outline" onClick={() => setReviewing("rejected")}>
              <X size={18} strokeWidth={2} />
              Reject
            </button>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------- lease */}
      <div className="card">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2>Rental agreement</h2>
          <div className="inline">
            <span
              className={`badge ${
                data.lease?.status === "signed" ? "approved" : "pending"
              }`}
            >
              {LEASE_STATUS_LABELS[data.leaseStatus]}
            </span>
            {data.lease?.status !== "signed" && (
              <button className="btn secondary" onClick={() => setLeaseOpen(true)}>
                <FileSignature size={18} strokeWidth={2} />
                {data.lease ? "Reissue" : "Issue agreement"}
              </button>
            )}
          </div>
        </div>

        {data.lease ? (
          <dl>
            <KV label="Rent" value={`₹${data.lease.terms.monthlyRent.toLocaleString("en-IN")}`} mono />
            <KV label="Deposit" value={`₹${data.lease.terms.securityDeposit.toLocaleString("en-IN")}`} mono />
            <KV label="Period" value={`${data.lease.terms.startDate} → ${data.lease.terms.endDate}`} mono />
            <KV label="Notice" value={`${data.lease.terms.noticePeriodDays} days`} />
            <KV label="Room at issue" value={data.lease.terms.roomSummary} />
            <KV label="Issued by" value={data.lease.issuedBy} />
            {data.lease.signedAt && (
              <>
                <KV label="Signed by" value={data.lease.signerName ?? "—"} />
                <KV label="Signed on" value={formatDateTime(data.lease.signedAt)} />
              </>
            )}
          </dl>
        ) : (
          <p className="muted small">
            Not issued yet. Verify the ID first, then issue the agreement.
          </p>
        )}

        {data.lease?.signaturePath && (
          <div style={{ marginTop: 12 }}>
            <p className="caption">Signature</p>
            <svg
              viewBox="0 0 320 180"
              style={{
                width: "100%",
                maxWidth: 320,
                height: 120,
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              <path
                d={data.lease.signaturePath}
                stroke="var(--ink)"
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- roommate */}
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Living habits</h2>
        {data.roommateProfile ? (
          <dl>
            <KV label="Sleep" value={SLEEP_LABELS[data.roommateProfile.sleepSchedule]} />
            <KV label="Tidiness" value={`${data.roommateProfile.cleanliness} of 5`} mono />
            <KV label="Noise tolerance" value={`${data.roommateProfile.noiseTolerance} of 5`} mono />
            <KV label="Social" value={`${data.roommateProfile.socialLevel} of 5`} mono />
            <KV label="Guests" value={`${data.roommateProfile.guestFrequency} of 5`} mono />
            <KV label="Studies" value={STUDY_LABELS[data.roommateProfile.studyLocation]} />
            <KV label="Food" value={FOOD_PREF_LABELS[data.roommateProfile.foodPreference]} />
            <KV label="Smokes" value={data.roommateProfile.smoking ? "Yes" : "No"} />
          </dl>
        ) : (
          <p className="muted small">Not filled in yet.</p>
        )}
      </div>

      {matches.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Best roommate pairings</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Use this when allocating a room. The reasons explain the score.
          </p>
          <div className="list">
            {matches.map((m) => (
              <div className="card" key={m.residentId}>
                <div className="section-head">
                  <strong>{m.fullName}</strong>
                  <span
                    className={`badge ${
                      m.score >= 75 ? "approved" : m.score >= 50 ? "pending" : "rejected"
                    }`}
                  >
                    {m.score}% match
                  </span>
                </div>
                <p className="caption" style={{ marginTop: 4 }}>
                  {m.roomNumber ? `Room ${m.roomNumber}` : "No room yet"}
                </p>
                {m.agreements.map((a) => (
                  <p className="small" key={a}>
                    <Plus size={13} color="var(--success)" strokeWidth={2.5} /> {a}
                  </p>
                ))}
                {m.frictions.map((f) => (
                  <p className="small" key={f}>
                    <Minus size={13} color="var(--danger)" strokeWidth={2.5} /> {f}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- move-in */}
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Move-in checklist</h2>
        <dl>
          {data.moveIn.tasks.map((task) => (
            <div className="kv" key={task.key}>
              <dt>{task.label}</dt>
              <dd>
                <span className={`badge ${task.done ? "approved" : "neutral"}`}>
                  {task.done ? "Done" : "Pending"}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2>Room condition at move-in</h2>
          {data.moveIn.inventorySubmittedAt && (
            <span className="badge approved">
              Locked {formatDateTime(data.moveIn.inventorySubmittedAt)}
            </span>
          )}
        </div>

        {data.moveIn.inventory.length === 0 ? (
          <p className="muted small">Nothing recorded yet.</p>
        ) : (
          <div className="list">
            {data.moveIn.inventory.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-head">
                  <strong>{item.name}</strong>
                  <span
                    className={`badge ${
                      item.condition === "good"
                        ? "approved"
                        : item.condition === "fair"
                          ? "pending"
                          : "rejected"
                    }`}
                  >
                    {CONDITION_LABELS[item.condition]}
                  </span>
                </div>
                {item.notes && (
                  <p className="muted small" style={{ marginTop: 4 }}>
                    {item.notes}
                  </p>
                )}
                {item.photoUris.length > 0 && (
                  <div className="thumbs" style={{ marginTop: 8 }}>
                    {item.photoUris.map((uri) => (
                      <img key={uri} src={uri} alt="" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- modals */}

      <Modal
        open={reviewing !== null}
        onClose={() => {
          setReviewing(null);
          setReason("");
          setFormError(null);
        }}
        title={reviewing === "verified" ? "Verify these documents?" : "Reject these documents?"}
        description={
          reviewing === "verified"
            ? "Confirm they match the originals you've seen."
            : "The resident is told why and can upload again."
        }
      >
        <div className="field">
          <label htmlFor="reason">
            {reviewing === "verified" ? "Note (optional)" : "What was wrong?"}
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setFormError(null);
            }}
            placeholder="e.g. Aadhaar photo is blurred, the number isn't readable."
          />
          {formError && <p className="error-text">{formError}</p>}
        </div>
        <div className="btn-row">
          <button
            className={reviewing === "verified" ? "btn" : "btn destructive"}
            onClick={() => void review()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
          <button className="btn secondary" onClick={() => setReviewing(null)} disabled={busy}>
            Cancel
          </button>
        </div>
      </Modal>

      <Modal
        open={leaseOpen}
        onClose={() => setLeaseOpen(false)}
        title="Issue rental agreement"
        description="The room details are snapshotted into the agreement as it stands now."
      >
        <form className="stack" onSubmit={issue}>
          <div className="form-grid">
            <NumField label="Monthly rent" value={lease.monthlyRent} onChange={(v) => setLease({ ...lease, monthlyRent: v })} />
            <NumField label="Security deposit" value={lease.securityDeposit} onChange={(v) => setLease({ ...lease, securityDeposit: v })} />
          </div>
          <div className="form-grid">
            <DateField label="Start date" value={lease.startDate} onChange={(v) => setLease({ ...lease, startDate: v })} />
            <DateField label="End date" value={lease.endDate} onChange={(v) => setLease({ ...lease, endDate: v })} />
          </div>
          <NumField label="Notice period (days)" value={lease.noticePeriodDays} onChange={(v) => setLease({ ...lease, noticePeriodDays: v })} />
          {formError && <p className="error-text">{formError}</p>}
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Issuing…" : "Issue agreement"}
            </button>
            <button className="btn secondary" type="button" onClick={() => setLeaseOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{value}</dd>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
