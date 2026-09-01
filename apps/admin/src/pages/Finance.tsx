import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Ban, Receipt, Wallet } from "lucide-react";
import {
  DEPOSIT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type AdminDepositRow,
  type AdminInvoiceRow,
  type AdminPaymentRow,
  type DepositState,
} from "@proj/shared";
import { api, messageOf } from "../api";
import {
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Stat,
  formatDateTime,
  useToast,
} from "../ui";

type View = "invoices" | "payments" | "deposits";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** First of the current month, the period billing normally runs for. */
function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function Finance() {
  const [params] = useSearchParams();
  const raw = params.get("view");
  const view: View =
    raw === "payments" || raw === "deposits" ? raw : "invoices";

  if (view === "payments") return <Payments />;
  if (view === "deposits") return <Deposits />;
  return <Invoices />;
}

/* ------------------------------------------------------------- invoices */

function Invoices() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminInvoiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [period, setPeriod] = useState(thisMonth());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.financeInvoices());
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api.generateInvoices(period);
      await load();
      setGenOpen(false);
      toast.show(
        result.created > 0
          ? `${result.created} invoice${result.created === 1 ? "" : "s"} created` +
              (result.skipped ? `, ${result.skipped} already existed` : "")
          : "Everyone was already billed for that month",
        result.created > 0 ? "success" : "info"
      );
    } catch (err) {
      toast.show(messageOf(err), "danger");
    } finally {
      setBusy(false);
    }
  };

  const voidIt = async (id: string) => {
    try {
      await api.voidInvoice(id);
      await load();
      toast.show("Invoice cancelled", "info");
    } catch (err) {
      toast.show(messageOf(err), "danger");
    }
  };

  const open = rows?.filter((r) => r.status !== "paid" && r.status !== "void") ?? [];
  const outstanding = open.reduce((s, r) => s + (r.total - r.amountPaid), 0);

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Invoices and dues"
        description="Monthly rent billing for everyone with a signed agreement."
        action={
          <button className="btn" onClick={() => setGenOpen(true)}>
            <Receipt size={18} strokeWidth={2} />
            Run billing
          </button>
        }
      />

      {rows && (
        <div className="stats">
          <Stat label="Outstanding" value={rupees(outstanding)} tone="danger" />
          <Stat
            label="Overdue invoices"
            value={rows.filter((r) => r.status === "overdue").length}
            tone="warning"
          />
          <Stat
            label="Paid"
            value={rows.filter((r) => r.status === "paid").length}
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
          icon={Receipt}
          title="Nothing billed yet"
          description="Run billing for a month to generate rent invoices from signed agreements."
        />
      ) : (
        <div className="list">
          {rows.map((row) => (
            <div className="card" key={row.id}>
              <div className="section-head">
                <div className="grow stack-sm">
                  <strong>
                    <Link to={`/residents/${row.residentId}`}>{row.residentName}</Link>
                    {row.roomNumber ? ` · Room ${row.roomNumber}` : ""}
                  </strong>
                  <span className="small muted">
                    <span className="mono">{row.number}</span> · due {row.dueOn}
                  </span>
                </div>
                <div className="inline">
                  <strong className="mono">{rupees(row.total)}</strong>
                  <span
                    className={`badge ${
                      row.status === "paid"
                        ? "approved"
                        : row.status === "overdue"
                          ? "rejected"
                          : row.status === "void"
                            ? "neutral"
                            : "pending"
                    }`}
                  >
                    {INVOICE_STATUS_LABELS[row.status]}
                  </span>
                </div>
              </div>

              {row.amountPaid > 0 && row.status !== "paid" && (
                <p className="caption" style={{ marginTop: 6 }}>
                  {rupees(row.amountPaid)} paid, {rupees(row.total - row.amountPaid)} left
                </p>
              )}

              {row.amountPaid === 0 && row.status !== "void" && (
                <button
                  className="btn ghost"
                  style={{ marginTop: 8, paddingLeft: 0 }}
                  onClick={() => void voidIt(row.id)}
                >
                  <Ban size={16} strokeWidth={2} />
                  Cancel invoice
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="Run billing"
        description="Creates one rent invoice per signed agreement. Running it twice for the same month is safe — it skips anyone already billed."
      >
        <form className="stack" onSubmit={generate}>
          <div className="field">
            <label htmlFor="period">Month to bill</label>
            <input
              id="period"
              type="date"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Running…" : "Generate invoices"}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setGenOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------- payments */

function Payments() {
  const [rows, setRows] = useState<AdminPaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.financePayments().then(setRows).catch((e) => setError(messageOf(e)));
  }, []);

  const succeeded = rows?.filter((r) => r.status === "succeeded") ?? [];
  const collected = succeeded.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Payments received"
        description="Every payment attempt, including the ones that failed."
      />

      {rows && (
        <div className="stats">
          <Stat label="Collected" value={rupees(collected)} tone="success" />
          <Stat label="Successful" value={succeeded.length} tone="info" />
          <Stat
            label="Failed"
            value={rows.filter((r) => r.status === "failed").length}
            tone="danger"
          />
        </div>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : !rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payments yet"
          description="Payments residents make in the app appear here as they happen."
        />
      ) : (
        <div className="list">
          {rows.map((row) => (
            <div className="card" key={row.id}>
              <div className="section-head">
                <div className="grow stack-sm">
                  <strong>
                    <Link to={`/residents/${row.residentId}`}>{row.residentName}</Link>
                  </strong>
                  <span className="small muted">
                    <span className="mono">{row.id}</span>
                    {row.invoiceNumber ? ` · ${row.invoiceNumber}` : " · split bill"}
                  </span>
                  <span className="caption">
                    {PAYMENT_METHOD_LABELS[row.method]} via {row.provider}
                    {row.providerRef ? ` · ${row.providerRef}` : ""}
                  </span>
                </div>
                <div className="inline">
                  <strong className="mono">{rupees(row.amount)}</strong>
                  <span
                    className={`badge ${
                      row.status === "succeeded"
                        ? "approved"
                        : row.status === "failed"
                          ? "rejected"
                          : "pending"
                    }`}
                  >
                    {ORDER_STATUS_LABELS[row.status]}
                  </span>
                </div>
              </div>
              {row.failureReason && (
                <p className="error-text" style={{ marginTop: 6 }}>
                  {row.failureReason}
                </p>
              )}
              <p className="caption" style={{ marginTop: 6 }}>
                {formatDateTime(row.completedAt ?? row.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- deposits */

function Deposits() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminDepositRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<AdminDepositRow | null>(null);
  const [detail, setDetail] = useState<DepositState | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.financeDeposits());
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openOne = async (row: AdminDepositRow) => {
    setActive(row);
    setFormError(null);
    setDetail(await api.deposit(row.residentId).catch(() => null));
  };

  const deduct = async () => {
    if (!active) return;
    setBusy(true);
    setFormError(null);
    try {
      setDetail(
        await api.addDeduction(active.residentId, {
          amount: Number(amount),
          reason: reason.trim(),
        })
      );
      setAmount("");
      setReason("");
      await load();
      toast.show("Deduction added", "info");
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const refund = async () => {
    if (!active) return;
    setBusy(true);
    setFormError(null);
    try {
      setDetail(
        await api.refundDeposit(active.residentId, reference.trim() || undefined)
      );
      setReference("");
      await load();
      toast.show("Refund updated", "success");
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const held = rows?.filter((r) => r.status === "held") ?? [];

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Deposits"
        description="What's held, what's been deducted, and where refunds have got to."
      />

      {rows && (
        <div className="stats">
          <Stat
            label="Held"
            value={rupees(held.reduce((s, r) => s + r.refundable, 0))}
            tone="info"
          />
          <Stat
            label="Refunds in progress"
            value={rows.filter((r) => r.status === "refund_initiated").length}
            tone="warning"
          />
          <Stat
            label="Refunded"
            value={rows.filter((r) => r.status === "refunded").length}
            tone="success"
          />
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !rows ? (
        <Loading />
      ) : (
        <div className="list">
          {rows
            .filter((r) => r.status !== "none")
            .map((row) => (
              <button
                key={row.residentId}
                className="row-card hover-elevate active-elevate-2"
                onClick={() => void openOne(row)}
              >
                <span className="grow stack-sm">
                  <span className="inline" style={{ flexWrap: "wrap" }}>
                    <strong>{row.residentName}</strong>
                    <span
                      className={`badge ${
                        row.status === "refunded"
                          ? "approved"
                          : row.status === "refund_initiated"
                            ? "pending"
                            : "neutral"
                      }`}
                    >
                      {DEPOSIT_STATUS_LABELS[row.status]}
                    </span>
                  </span>
                  <span className="small muted">
                    {rupees(row.amount)} held
                    {row.totalDeducted > 0
                      ? ` · ${rupees(row.totalDeducted)} deducted`
                      : ""}
                    {row.roomNumber ? ` · Room ${row.roomNumber}` : ""}
                  </span>
                </span>
                <strong className="mono">{rupees(row.refundable)}</strong>
              </button>
            ))}
          {rows.every((r) => r.status === "none") && (
            <EmptyState
              icon={Wallet}
              title="No deposits recorded"
              description="Deposits appear here once they're collected against a resident."
            />
          )}
        </div>
      )}

      <Modal
        open={active !== null}
        onClose={() => {
          setActive(null);
          setDetail(null);
          setFormError(null);
        }}
        title={active?.residentName ?? ""}
        description={
          detail
            ? `${rupees(detail.amount)} held · ${rupees(detail.refundable)} refundable`
            : undefined
        }
      >
        {detail && (
          <>
            {detail.deductions.length > 0 && (
              <div className="stack-sm">
                {detail.deductions.map((d) => (
                  <p className="small" key={d.id}>
                    <strong className="mono">− {rupees(d.amount)}</strong> {d.reason}
                    <br />
                    <span className="caption">
                      {d.createdBy} · {formatDateTime(d.createdAt)}
                    </span>
                  </p>
                ))}
              </div>
            )}

            {detail.status === "held" && (
              <>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="ded-amount">Deduct (₹)</label>
                    <input
                      id="ded-amount"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ded-reason">Reason</label>
                    <input
                      id="ded-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="What was damaged"
                    />
                  </div>
                </div>
                <button
                  className="btn secondary"
                  onClick={() => void deduct()}
                  disabled={busy || !amount || reason.trim().length < 5}
                >
                  Add deduction
                </button>
              </>
            )}

            {detail.status === "refund_initiated" && (
              <div className="field">
                <label htmlFor="ref">Bank reference</label>
                <input
                  id="ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. NEFT/2026/88123"
                />
              </div>
            )}

            {formError && <p className="error-text">{formError}</p>}

            {(detail.status === "held" || detail.status === "refund_initiated") && (
              <button className="btn" onClick={() => void refund()} disabled={busy}>
                {detail.status === "held"
                  ? `Start refund of ${rupees(detail.refundable)}`
                  : "Mark as refunded"}
              </button>
            )}

            {detail.status === "refunded" && (
              <p className="small muted">
                Refunded on {formatDateTime(detail.refundedAt ?? "")} · reference{" "}
                {detail.refundReference}
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
