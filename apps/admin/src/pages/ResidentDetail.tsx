import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { BedDouble, Plus, Receipt } from "lucide-react";
import type {
  AdminResidentDetail as Detail,
  AllocateRoomBody,
  PaymentMode,
  PaymentPlanBody,
  RecordPaymentBody,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  ErrorState,
  Loading,
  Modal,
  RequestStatusBadge,
  StatusBadge,
  formatDateTime,
  useToast,
} from "../ui";

const EMPTY_ROOM: AllocateRoomBody = {
  roomNumber: "",
  floor: "",
  wing: "",
  buildingName: "Thapar Block A",
  propertyName: "Thapar",
  propertyAddress: "Thapar Institute Campus, Bhadson Road, Patiala 147004",
  roomType: "Twin sharing",
  occupancy: "1 of 2 beds occupied",
};

const MODES: PaymentMode[] = ["cash", "upi", "card", "netbanking"];

const today = () => new Date().toISOString().slice(0, 10);

export default function ResidentDetail() {
  const { id = "" } = useParams();
  const toast = useToast();

  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [roomOpen, setRoomOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [room, setRoom] = useState<AllocateRoomBody>(EMPTY_ROOM);
  const [plan, setPlan] = useState<PaymentPlanBody>({
    plan: "6 monthly",
    paidUpTo: today(),
    nextDueOn: null,
    nextDueAmount: null,
  });
  const [payment, setPayment] = useState<RecordPaymentBody>({
    paidOn: today(),
    amount: 0,
    mode: "cash",
    periodFrom: today(),
    periodTo: today(),
    receiptNo: "",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const detail = await api.resident(id);
      setData(detail);
      if (detail.room) setRoom(detail.room);
      if (detail.payments) {
        setPlan({
          plan: detail.payments.plan,
          paidUpTo: detail.payments.paidUpTo,
          nextDueOn: detail.payments.nextDueOn,
          nextDueAmount: detail.payments.nextDueAmount,
        });
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (
    action: () => Promise<unknown>,
    done: string,
    close: () => void
  ) => {
    setBusy(true);
    setFormError(null);
    try {
      await action();
      await load();
      close();
      toast.show(done, "success");
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (error || !data) {
    return (
      <ErrorState
        message={error ?? "Couldn't load this resident."}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <div className="card">
        <div className="card-row">
          <div className="grow stack-sm">
            <h1>{data.fullName}</h1>
            <p className="small muted">
              <span className="mono">{data.id}</span> ·{" "}
              <span className="mono">{data.mobile}</span>
            </p>
          </div>
          <StatusBadge status={data.accountStatus} />
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Personal</h2>
        <dl>
          <KV label="Age" value={`${data.age} years`} />
          <KV
            label="Gender"
            value={data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}
          />
          <KV label="Date of birth" value={data.dob} mono />
          <KV
            label={data.kycType === "pan" ? "PAN" : "Aadhaar"}
            value={data.kycMasked}
            mono
          />
          <KV label="Registered" value={formatDateTime(data.joinedAt)} />
        </dl>
      </div>

      {/* room */}
      <div className="card">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2>Room</h2>
          <button className="btn secondary" onClick={() => setRoomOpen(true)}>
            <BedDouble size={18} strokeWidth={2} />
            {data.room ? "Change room" : "Allocate room"}
          </button>
        </div>
        {data.room ? (
          <dl>
            <KV label="Room" value={data.room.roomNumber} mono />
            <KV label="Floor" value={data.room.floor} />
            <KV label="Wing" value={data.room.wing} />
            <KV label="Building" value={data.room.buildingName} />
            <KV label="Type" value={data.room.roomType} />
            <KV label="Occupancy" value={data.room.occupancy} />
          </dl>
        ) : (
          <p className="muted small">
            No room allocated yet. Until one is, the resident's "My room" screen
            is empty.
          </p>
        )}
      </div>

      {/* payments */}
      <div className="card">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2>Payments</h2>
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setPlanOpen(true)}>
              {data.payments ? "Edit plan" : "Set plan"}
            </button>
            <button
              className="btn"
              onClick={() => setPayOpen(true)}
              disabled={!data.payments}
              title={data.payments ? undefined : "Set a plan first"}
            >
              <Plus size={18} strokeWidth={2} />
              Record payment
            </button>
          </div>
        </div>

        {data.payments ? (
          <>
            <dl>
              <KV label="Plan" value={data.payments.plan} />
              <KV label="Paid up to" value={data.payments.paidUpTo} mono />
              <KV
                label="Total paid"
                value={`₹${data.payments.totalPaid.toLocaleString("en-IN")}`}
                mono
              />
              <KV
                label="Next due"
                value={
                  data.payments.nextDueOn
                    ? `${data.payments.nextDueOn} · ₹${(data.payments.nextDueAmount ?? 0).toLocaleString("en-IN")}`
                    : "—"
                }
                mono
              />
            </dl>

            {data.payments.entries.length > 0 && (
              <div className="list" style={{ marginTop: 12 }}>
                {data.payments.entries.map((e) => (
                  <div className="card" key={e.id}>
                    <div className="inline" style={{ flexWrap: "wrap" }}>
                      <Receipt size={16} color="var(--muted)" strokeWidth={2} />
                      <strong className="mono">
                        ₹{e.amount.toLocaleString("en-IN")}
                      </strong>
                      <span className="badge neutral">{e.mode}</span>
                      <span className="small muted">
                        {e.periodFrom} → {e.periodTo}
                      </span>
                    </div>
                    <p className="caption" style={{ marginTop: 4 }}>
                      Paid {e.paidOn} · <span className="mono">{e.receiptNo}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="muted small">
            No payment plan set. The resident's payments screen is empty until
            there is one.
          </p>
        )}
      </div>

      {/* attendance */}
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Attendance</h2>
        <dl>
          <KV
            label="Today"
            value={data.attendance.todayMarked ? "Marked" : "Not marked"}
          />
          <KV
            label="Present"
            value={`${data.attendance.presentDays} of ${data.attendance.totalDays} days`}
            mono
          />
          <KV label="Streak" value={`${data.attendance.streak} days`} mono />
        </dl>
      </div>

      {/* requests */}
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Recent requests</h2>
        {data.recentRequests.length === 0 ? (
          <p className="muted small">Nothing raised yet.</p>
        ) : (
          <div className="list">
            {data.recentRequests.map((r) => (
              <Link
                key={`${r.kind}-${r.id}`}
                to={`/requests/${r.kind}/${r.id}`}
                className="row-card"
                style={{ textDecoration: "none" }}
              >
                <span className="grow stack-sm">
                  <span className="inline" style={{ flexWrap: "wrap" }}>
                    <strong>{r.title}</strong>
                    <RequestStatusBadge status={r.status} />
                  </span>
                  <span className="small muted mono">{r.id}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- modals */}

      <Modal
        open={roomOpen}
        onClose={() => setRoomOpen(false)}
        title={data.room ? "Change room" : "Allocate a room"}
        description="The resident is notified as soon as this is saved."
      >
        <form
          className="stack"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void submit(
              () => api.allocateRoom(id, room),
              "Room allocated",
              () => setRoomOpen(false)
            );
          }}
        >
          <div className="form-grid">
            <Field label="Room number" value={room.roomNumber} onChange={(v) => setRoom({ ...room, roomNumber: v })} />
            <Field label="Floor" value={room.floor} onChange={(v) => setRoom({ ...room, floor: v })} />
            <Field label="Wing" value={room.wing} onChange={(v) => setRoom({ ...room, wing: v })} />
            <Field label="Room type" value={room.roomType} onChange={(v) => setRoom({ ...room, roomType: v })} />
            <Field label="Building" value={room.buildingName} onChange={(v) => setRoom({ ...room, buildingName: v })} />
            <Field label="Occupancy" value={room.occupancy} onChange={(v) => setRoom({ ...room, occupancy: v })} />
          </div>
          <Field label="Property" value={room.propertyName} onChange={(v) => setRoom({ ...room, propertyName: v })} />
          <Field label="Address" value={room.propertyAddress} onChange={(v) => setRoom({ ...room, propertyAddress: v })} />
          {formError && <p className="error-text">{formError}</p>}
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save room"}
            </button>
            <button className="btn secondary" type="button" onClick={() => setRoomOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Payment plan"
        description="What the resident owes and until when they're covered."
      >
        <form
          className="stack"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void submit(
              () => api.setPaymentPlan(id, plan),
              "Payment plan saved",
              () => setPlanOpen(false)
            );
          }}
        >
          <Field label="Plan" value={plan.plan} onChange={(v) => setPlan({ ...plan, plan: v })} />
          <div className="form-grid">
            <Field label="Paid up to" type="date" value={plan.paidUpTo} onChange={(v) => setPlan({ ...plan, paidUpTo: v })} />
            <Field
              label="Next due on"
              type="date"
              value={plan.nextDueOn ?? ""}
              onChange={(v) => setPlan({ ...plan, nextDueOn: v || null })}
            />
          </div>
          <Field
            label="Next due amount (₹)"
            type="number"
            value={plan.nextDueAmount == null ? "" : String(plan.nextDueAmount)}
            onChange={(v) => setPlan({ ...plan, nextDueAmount: v ? Number(v) : null })}
          />
          {formError && <p className="error-text">{formError}</p>}
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save plan"}
            </button>
            <button className="btn secondary" type="button" onClick={() => setPlanOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record a payment"
        description="Adds a receipt the resident can see in their app."
      >
        <form
          className="stack"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void submit(
              () => api.recordPayment(id, payment),
              "Payment recorded",
              () => setPayOpen(false)
            );
          }}
        >
          <div className="form-grid">
            <Field
              label="Amount (₹)"
              type="number"
              value={payment.amount ? String(payment.amount) : ""}
              onChange={(v) => setPayment({ ...payment, amount: Number(v) })}
            />
            <div className="field">
              <label htmlFor="mode">Mode</label>
              <select
                id="mode"
                value={payment.mode}
                onChange={(e) =>
                  setPayment({ ...payment, mode: e.target.value as PaymentMode })
                }
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Paid on" type="date" value={payment.paidOn} onChange={(v) => setPayment({ ...payment, paidOn: v })} />
            <Field label="Receipt number" value={payment.receiptNo} onChange={(v) => setPayment({ ...payment, receiptNo: v })} />
          </div>
          <div className="form-grid">
            <Field label="Covers from" type="date" value={payment.periodFrom} onChange={(v) => setPayment({ ...payment, periodFrom: v })} />
            <Field label="Covers to" type="date" value={payment.periodTo} onChange={(v) => setPayment({ ...payment, periodTo: v })} />
          </div>
          {formError && <p className="error-text">{formError}</p>}
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Record payment"}
            </button>
            <button className="btn secondary" type="button" onClick={() => setPayOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function KV({
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

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  // Trailing punctuation ("Amount (₹)") would leave a dangling dash.
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
