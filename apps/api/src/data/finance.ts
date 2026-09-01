import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  type DepositState,
  type Instalment,
  type InstalmentPlan,
  type InstalmentQuote,
  type Invoice,
  type InvoiceStatus,
  type Mandate,
  type PaymentMethod,
  type PaymentOrder,
  type SplitBill,
  type SplitCandidate,
  type SplitCategory,
  type SplitSummary,
} from "@proj/shared";
import { db } from "../db/client";
import * as t from "../db/schema";
import { isoDate, nextId } from "./db";
import { provider } from "../payments/provider";

const iso = (d: Date) => d.toISOString();

/** Flat convenience fee on instalment plans, as a percentage of principal. */
const INSTALMENT_FEE_PERCENT = 2;

export const DEPOSIT_POLICY = [
  "The deposit is refunded within 30 days of moving out.",
  "Deductions are only made for damage beyond normal wear and tear.",
  "Anything recorded as already damaged at move-in is never deducted.",
  "Every deduction is itemised with a reason before the refund is released.",
  "Unpaid dues are settled from the deposit before any refund.",
];

/* ------------------------------------------------------------- invoices */

function toInvoice(row: typeof t.invoices.$inferSelect): Invoice {
  return {
    id: row.id,
    number: row.number,
    residentId: row.residentId,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    issuedAt: iso(row.issuedAt),
    dueOn: row.dueOn,
    lines: row.lines,
    total: row.total,
    amountPaid: row.amountPaid,
    status: row.status,
  };
}

/** Overdue is derived from the clock, so it never needs a nightly job. */
function withOverdue(invoice: Invoice): Invoice {
  if (
    (invoice.status === "issued" || invoice.status === "part_paid") &&
    invoice.dueOn < isoDate(new Date())
  ) {
    return { ...invoice, status: "overdue" };
  }
  return invoice;
}

export async function listInvoices(residentId: string): Promise<Invoice[]> {
  const rows = await db
    .select()
    .from(t.invoices)
    .where(eq(t.invoices.residentId, residentId))
    .orderBy(desc(t.invoices.periodFrom));

  return rows.map((r) => withOverdue(toInvoice(r)));
}

export async function getInvoice(
  residentId: string,
  id: string
): Promise<Invoice | undefined> {
  const [row] = await db
    .select()
    .from(t.invoices)
    .where(and(eq(t.invoices.id, id), eq(t.invoices.residentId, residentId)))
    .limit(1);
  return row ? withOverdue(toInvoice(row)) : undefined;
}

function endOfMonth(periodFrom: string): string {
  const d = new Date(periodFrom);
  return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/**
 * Bills every resident with a signed lease for one month. Idempotent: the
 * unique index on (resident, period) means a second run skips rather than
 * double-charging, which matters because this is the kind of thing someone
 * clicks twice.
 */
export async function generateInvoices(
  periodFrom: string
): Promise<{ created: string[]; skipped: number }> {
  const leases = await db
    .select({
      residentId: t.leaseAgreements.residentId,
      terms: t.leaseAgreements.terms,
    })
    .from(t.leaseAgreements)
    .where(eq(t.leaseAgreements.status, "signed"));

  const periodTo = endOfMonth(periodFrom);
  const created: string[] = [];
  let skipped = 0;

  for (const lease of leases) {
    const terms = lease.terms as { monthlyRent?: number };
    const rent = Number(terms.monthlyRent ?? 0);
    if (!Number.isFinite(rent) || rent <= 0) {
      skipped += 1;
      continue;
    }

    const existing = await db
      .select({ id: t.invoices.id })
      .from(t.invoices)
      .where(
        and(
          eq(t.invoices.residentId, lease.residentId),
          eq(t.invoices.periodFrom, periodFrom)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    const id = await nextId("INV");
    const number = `${id.replace("INV-", "INV/")}/${periodFrom.slice(0, 7)}`;

    // Due on the 5th of the billing month — the convention residents expect.
    const due = new Date(periodFrom);
    due.setDate(5);

    await db.insert(t.invoices).values({
      id,
      number,
      residentId: lease.residentId,
      periodFrom,
      periodTo,
      dueOn: isoDate(due),
      lines: [
        {
          description: `Room rent ${periodFrom.slice(0, 7)}`,
          amount: Math.round(rent),
        },
      ],
      total: Math.round(rent),
      status: "issued",
    });

    await db.insert(t.notifications).values({
      id: randomUUID(),
      residentId: lease.residentId,
      title: "Your rent invoice is ready",
      body: `₹${Math.round(rent).toLocaleString("en-IN")} due on ${isoDate(due)}.`,
      kind: "info",
      href: "/payments",
      read: false,
    });

    created.push(id);
  }

  return { created, skipped };
}

export async function voidInvoice(id: string): Promise<Invoice | null> {
  // Only an unpaid invoice can be cancelled; money already taken must be
  // refunded rather than made to disappear.
  const [row] = await db
    .update(t.invoices)
    .set({ status: "void" })
    .where(and(eq(t.invoices.id, id), eq(t.invoices.amountPaid, 0)))
    .returning();
  return row ? toInvoice(row) : null;
}

/* ------------------------------------------------------------- payments */

function toOrder(
  row: typeof t.paymentOrders.$inferSelect,
  authorisationUrl: string | null = null
): PaymentOrder {
  return {
    id: row.id,
    residentId: row.residentId,
    invoiceId: row.invoiceId,
    splitShareId: row.splitShareId,
    amount: row.amount,
    method: row.method,
    provider: row.provider,
    providerRef: row.providerRef,
    status: row.status,
    failureReason: row.failureReason,
    createdAt: iso(row.createdAt),
    completedAt: row.completedAt ? iso(row.completedAt) : null,
    authorisationUrl,
  };
}

export async function startPayment(
  residentId: string,
  input: {
    invoiceId: string | null;
    splitShareId: string | null;
    amount: number;
    method: PaymentMethod;
    idempotencyKey: string;
    description: string;
  }
): Promise<PaymentOrder> {
  // Idempotency first: a retried tap must never create a second charge.
  const [existing] = await db
    .select()
    .from(t.paymentOrders)
    .where(
      and(
        eq(t.paymentOrders.residentId, residentId),
        eq(t.paymentOrders.idempotencyKey, input.idempotencyKey)
      )
    )
    .limit(1);

  if (existing) {
    return toOrder(
      existing,
      existing.status === "pending" || existing.status === "created"
        ? `/api/payments/simulator/${existing.id}`
        : null
    );
  }

  const id = await nextId("PAY");

  await db.insert(t.paymentOrders).values({
    id,
    residentId,
    invoiceId: input.invoiceId,
    splitShareId: input.splitShareId,
    amount: input.amount,
    method: input.method,
    provider: provider.name,
    status: "created",
    idempotencyKey: input.idempotencyKey,
  });

  const result = await provider.createOrder({
    orderId: id,
    amount: input.amount,
    method: input.method,
    description: input.description,
  });

  const [updated] = await db
    .update(t.paymentOrders)
    .set({ providerRef: result.providerRef, status: result.status })
    .where(eq(t.paymentOrders.id, id))
    .returning();

  const order = updated as typeof t.paymentOrders.$inferSelect;

  // An auto-debit needs no interaction, so it settles immediately.
  if (result.status === "succeeded") {
    return (await settleOrder(id, "succeeded", null)) ?? toOrder(order);
  }

  return toOrder(order, result.authorisationUrl);
}

export async function getOrder(
  residentId: string,
  id: string
): Promise<PaymentOrder | undefined> {
  const [row] = await db
    .select()
    .from(t.paymentOrders)
    .where(
      and(eq(t.paymentOrders.id, id), eq(t.paymentOrders.residentId, residentId))
    )
    .limit(1);
  return row ? toOrder(row) : undefined;
}

export async function listOrders(residentId: string): Promise<PaymentOrder[]> {
  const rows = await db
    .select()
    .from(t.paymentOrders)
    .where(eq(t.paymentOrders.residentId, residentId))
    .orderBy(desc(t.paymentOrders.createdAt));
  return rows.map((r) => toOrder(r));
}

/**
 * The one place an order becomes final. Both the webhook and the auto-debit
 * path go through here, and the status filter makes it idempotent — a gateway
 * that delivers the same webhook twice cannot double-credit an invoice.
 */
export async function settleOrder(
  orderId: string,
  outcome: "succeeded" | "failed",
  failureReason: string | null
): Promise<PaymentOrder | null> {
  const [order] = await db
    .update(t.paymentOrders)
    .set({
      status: outcome,
      failureReason,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(t.paymentOrders.id, orderId),
        inArray(t.paymentOrders.status, ["created", "pending"])
      )
    )
    .returning();

  if (!order) return null;
  if (outcome !== "succeeded") {
    await db.insert(t.notifications).values({
      id: randomUUID(),
      residentId: order.residentId,
      title: "Payment failed",
      body: failureReason ?? "The payment didn't go through. Nothing was charged.",
      kind: "danger",
      href: "/payments",
      read: false,
    });
    return toOrder(order);
  }

  if (order.invoiceId) await applyToInvoice(order);
  if (order.splitShareId) await settleShare(order.splitShareId);

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId: order.residentId,
    title: "Payment received",
    body: `₹${order.amount.toLocaleString("en-IN")} paid successfully.`,
    kind: "success",
    href: "/payments",
    read: false,
  });

  return toOrder(order);
}

/** Credits an invoice and mirrors the payment into the existing ledger. */
async function applyToInvoice(
  order: typeof t.paymentOrders.$inferSelect
): Promise<void> {
  const [invoice] = await db
    .select()
    .from(t.invoices)
    .where(eq(t.invoices.id, order.invoiceId as string))
    .limit(1);
  if (!invoice) return;

  const amountPaid = invoice.amountPaid + order.amount;
  const status: InvoiceStatus =
    amountPaid >= invoice.total ? "paid" : "part_paid";

  await db
    .update(t.invoices)
    .set({ amountPaid, status })
    .where(eq(t.invoices.id, invoice.id));

  // The ledger the resident and office already read stays the single record of
  // what has actually been paid, however it was paid.
  await db.insert(t.paymentEntries).values({
    id: order.id,
    residentId: order.residentId,
    paidOn: isoDate(new Date()),
    amount: order.amount,
    mode: order.method === "mandate" ? "netbanking" : order.method,
    periodFrom: invoice.periodFrom,
    periodTo: invoice.periodTo,
    receiptNo: `RCPT/${invoice.number}`,
  });

  if (status === "paid") await markInstalmentsPaid(invoice.id);
}

async function markInstalmentsPaid(invoiceId: string): Promise<void> {
  const [plan] = await db
    .select()
    .from(t.instalmentPlans)
    .where(eq(t.instalmentPlans.invoiceId, invoiceId))
    .limit(1);
  if (!plan) return;

  await db
    .update(t.instalments)
    .set({ status: "paid", paidAt: new Date() })
    .where(
      and(eq(t.instalments.planId, plan.id), ne(t.instalments.status, "paid"))
    );
}

/* ------------------------------------------------------------- mandates */

function toMandate(
  row: typeof t.mandates.$inferSelect,
  approvalUrl: string | null = null
): Mandate {
  return {
    id: row.id,
    status: row.status,
    provider: row.provider,
    providerRef: row.providerRef,
    maxAmount: row.maxAmount,
    dayOfMonth: row.dayOfMonth,
    startDate: row.startDate,
    endDate: row.endDate,
    createdAt: iso(row.createdAt),
    approvalUrl,
  };
}

export async function getMandate(residentId: string): Promise<Mandate | null> {
  const [row] = await db
    .select()
    .from(t.mandates)
    .where(
      and(
        eq(t.mandates.residentId, residentId),
        ne(t.mandates.status, "revoked")
      )
    )
    .orderBy(desc(t.mandates.createdAt))
    .limit(1);

  if (!row) return null;
  return toMandate(
    row,
    row.status === "pending" ? `/api/payments/simulator/mandate/${row.id}` : null
  );
}

export async function createMandate(
  residentId: string,
  input: { maxAmount: number; dayOfMonth: number; endDate: string | null }
): Promise<Mandate> {
  // One live mandate at a time; setting up a new one replaces the old.
  await db
    .update(t.mandates)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(
        eq(t.mandates.residentId, residentId),
        ne(t.mandates.status, "revoked")
      )
    );

  const id = await nextId("MND");
  await db.insert(t.mandates).values({
    id,
    residentId,
    provider: provider.name,
    maxAmount: input.maxAmount,
    dayOfMonth: input.dayOfMonth,
    startDate: isoDate(new Date()),
    endDate: input.endDate,
    status: "pending",
  });

  const result = await provider.createMandate({
    mandateId: id,
    maxAmount: input.maxAmount,
    dayOfMonth: input.dayOfMonth,
  });

  const [row] = await db
    .update(t.mandates)
    .set({
      providerRef: result.providerRef,
      status: result.status,
      updatedAt: new Date(),
    })
    .where(eq(t.mandates.id, id))
    .returning();

  return toMandate(row as typeof t.mandates.$inferSelect, result.approvalUrl);
}

export async function setMandateStatus(
  residentId: string,
  status: "active" | "paused" | "revoked"
): Promise<Mandate | null> {
  const current = await getMandate(residentId);
  if (!current) return null;

  if (status === "revoked" && current.providerRef) {
    await provider.revokeMandate(current.providerRef);
  }

  await db
    .update(t.mandates)
    .set({ status, updatedAt: new Date() })
    .where(eq(t.mandates.id, current.id));

  return getMandate(residentId);
}

/** Called by the mock bank page once the resident approves the mandate. */
export async function approveMandateById(mandateId: string): Promise<void> {
  const [row] = await db
    .update(t.mandates)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(eq(t.mandates.id, mandateId), eq(t.mandates.status, "pending"))
    )
    .returning();

  if (!row) return;

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId: row.residentId,
    title: "Auto-debit is active",
    body: `Rent up to ₹${row.maxAmount.toLocaleString("en-IN")} will be collected on day ${row.dayOfMonth} each month.`,
    kind: "success",
    href: "/payments",
    read: false,
  });
}

/* --------------------------------------------------------- instalments */

export function quoteInstalments(
  principal: number,
  count: number
): InstalmentQuote {
  const feeAmount = Math.round((principal * INSTALMENT_FEE_PERCENT) / 100);
  const totalPayable = principal + feeAmount;

  return {
    count,
    // Rounded up so the instalments never total less than what's owed; the
    // final one absorbs the difference.
    perInstalment: Math.ceil(totalPayable / count),
    feeAmount,
    totalPayable,
    feePercent: INSTALMENT_FEE_PERCENT,
  };
}

export async function getPlan(
  invoiceId: string
): Promise<InstalmentPlan | null> {
  const [plan] = await db
    .select()
    .from(t.instalmentPlans)
    .where(eq(t.instalmentPlans.invoiceId, invoiceId))
    .limit(1);
  if (!plan) return null;

  const rows = await db
    .select()
    .from(t.instalments)
    .where(eq(t.instalments.planId, plan.id))
    .orderBy(t.instalments.seq);

  const today = isoDate(new Date());
  const instalments: Instalment[] = rows.map((r) => ({
    id: r.id,
    seq: r.seq,
    dueOn: r.dueOn,
    amount: r.amount,
    status: r.status === "due" && r.dueOn < today ? "overdue" : r.status,
    paidAt: r.paidAt ? iso(r.paidAt) : null,
  }));

  return {
    id: plan.id,
    invoiceId: plan.invoiceId,
    principal: plan.principal,
    feeAmount: plan.feeAmount,
    totalPayable: plan.totalPayable,
    count: plan.count,
    instalments,
    createdAt: iso(plan.createdAt),
  };
}

export async function createPlan(
  residentId: string,
  invoice: Invoice,
  count: number
): Promise<InstalmentPlan> {
  const principal = invoice.total - invoice.amountPaid;
  const quote = quoteInstalments(principal, count);

  const planId = await nextId("EMI");
  await db.insert(t.instalmentPlans).values({
    id: planId,
    residentId,
    invoiceId: invoice.id,
    principal,
    feeAmount: quote.feeAmount,
    totalPayable: quote.totalPayable,
    count,
  });

  let remaining = quote.totalPayable;
  const rows = Array.from({ length: count }, (_, i) => {
    const due = new Date(invoice.dueOn);
    due.setMonth(due.getMonth() + i);

    // The last instalment takes whatever's left, so the total is exact.
    const amount =
      i === count - 1 ? remaining : Math.min(quote.perInstalment, remaining);
    remaining -= amount;

    return {
      id: `${planId}-${i + 1}`,
      planId,
      seq: i + 1,
      dueOn: isoDate(due),
      amount,
      status: "due" as const,
    };
  });

  await db.insert(t.instalments).values(rows);
  return (await getPlan(invoice.id)) as InstalmentPlan;
}

export async function activePlanFor(
  residentId: string
): Promise<InstalmentPlan | null> {
  const [plan] = await db
    .select({ invoiceId: t.instalmentPlans.invoiceId })
    .from(t.instalmentPlans)
    .where(eq(t.instalmentPlans.residentId, residentId))
    .orderBy(desc(t.instalmentPlans.createdAt))
    .limit(1);
  return plan ? getPlan(plan.invoiceId) : null;
}

/* -------------------------------------------------------------- deposit */

export async function getDeposit(residentId: string): Promise<DepositState> {
  const [row] = await db
    .select()
    .from(t.deposits)
    .where(eq(t.deposits.residentId, residentId))
    .limit(1);

  const deductionRows = await db
    .select()
    .from(t.depositDeductions)
    .where(eq(t.depositDeductions.residentId, residentId))
    .orderBy(t.depositDeductions.createdAt);

  const deductions = deductionRows.map((d) => ({
    id: d.id,
    amount: d.amount,
    reason: d.reason,
    inventoryItemId: d.inventoryItemId,
    createdBy: d.createdBy,
    createdAt: iso(d.createdAt),
  }));

  const totalDeducted = deductions.reduce((sum, d) => sum + d.amount, 0);
  const amount = row?.amount ?? 0;

  return {
    status: row?.status ?? "none",
    amount,
    heldSince: row?.heldSince ?? null,
    deductions,
    totalDeducted,
    refundable: Math.max(0, amount - totalDeducted),
    refundInitiatedAt: row?.refundInitiatedAt ? iso(row.refundInitiatedAt) : null,
    refundedAt: row?.refundedAt ? iso(row.refundedAt) : null,
    refundReference: row?.refundReference ?? null,
    policy: DEPOSIT_POLICY,
  };
}

export async function ensureDeposit(
  residentId: string,
  amount: number
): Promise<void> {
  await db
    .insert(t.deposits)
    .values({ residentId, amount, heldSince: isoDate(new Date()), status: "held" })
    .onConflictDoUpdate({ target: t.deposits.residentId, set: { amount } });
}

export async function addDeduction(
  residentId: string,
  input: {
    amount: number;
    reason: string;
    inventoryItemId: string | null;
    createdBy: string;
  }
): Promise<DepositState> {
  const id = await nextId("DED");
  await db.insert(t.depositDeductions).values({ ...input, id, residentId });

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId,
    title: "Deposit deduction added",
    body: `₹${input.amount.toLocaleString("en-IN")} — ${input.reason}`,
    kind: "warning",
    href: "/payments/deposit",
    read: false,
  });

  return getDeposit(residentId);
}

export async function removeDeduction(
  residentId: string,
  id: string
): Promise<DepositState> {
  await db
    .delete(t.depositDeductions)
    .where(
      and(
        eq(t.depositDeductions.id, id),
        eq(t.depositDeductions.residentId, residentId)
      )
    );
  return getDeposit(residentId);
}

export async function setRefundStage(
  residentId: string,
  stage: "refund_initiated" | "refunded",
  reference: string | null
): Promise<DepositState | null> {
  // Refund moves forward only: held → initiated → refunded.
  const allowedFrom = stage === "refund_initiated" ? "held" : "refund_initiated";

  const [row] = await db
    .update(t.deposits)
    .set({
      status: stage,
      ...(stage === "refund_initiated"
        ? { refundInitiatedAt: new Date() }
        : { refundedAt: new Date(), refundReference: reference }),
    })
    .where(
      and(
        eq(t.deposits.residentId, residentId),
        eq(t.deposits.status, allowedFrom)
      )
    )
    .returning();

  if (!row) return null;

  const state = await getDeposit(residentId);
  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId,
    title:
      stage === "refunded" ? "Deposit refunded" : "Deposit refund started",
    body:
      stage === "refunded"
        ? `₹${state.refundable.toLocaleString("en-IN")} sent. Reference ${reference}.`
        : `We're processing your refund of ₹${state.refundable.toLocaleString("en-IN")}.`,
    kind: "success",
    href: "/payments/deposit",
    read: false,
  });

  return state;
}

/* ---------------------------------------------------------- split bills */

async function loadBills(billIds: string[], meId: string): Promise<SplitBill[]> {
  if (billIds.length === 0) return [];

  const bills = await db
    .select({
      id: t.splitBills.id,
      title: t.splitBills.title,
      category: t.splitBills.category,
      note: t.splitBills.note,
      totalAmount: t.splitBills.totalAmount,
      createdBy: t.splitBills.createdBy,
      createdByName: t.residents.fullName,
      createdAt: t.splitBills.createdAt,
      settledAt: t.splitBills.settledAt,
    })
    .from(t.splitBills)
    .innerJoin(t.residents, eq(t.splitBills.createdBy, t.residents.id))
    .where(inArray(t.splitBills.id, billIds))
    .orderBy(desc(t.splitBills.createdAt));

  const shares = await db
    .select({
      id: t.splitShares.id,
      billId: t.splitShares.billId,
      residentId: t.splitShares.residentId,
      residentName: t.residents.fullName,
      amount: t.splitShares.amount,
      status: t.splitShares.status,
      settledAt: t.splitShares.settledAt,
    })
    .from(t.splitShares)
    .innerJoin(t.residents, eq(t.splitShares.residentId, t.residents.id))
    .where(inArray(t.splitShares.billId, billIds));

  return bills.map((bill) => ({
    id: bill.id,
    title: bill.title,
    category: bill.category,
    note: bill.note,
    totalAmount: bill.totalAmount,
    createdBy: bill.createdBy,
    createdByName: bill.createdByName,
    createdAt: iso(bill.createdAt),
    settledAt: bill.settledAt ? iso(bill.settledAt) : null,
    isOwner: bill.createdBy === meId,
    shares: shares
      .filter((s) => s.billId === bill.id)
      .map((s) => ({
        id: s.id,
        residentId: s.residentId,
        residentName: s.residentName,
        amount: s.amount,
        status: s.status,
        settledAt: s.settledAt ? iso(s.settledAt) : null,
        isMe: s.residentId === meId,
      })),
  }));
}

export async function listSplits(residentId: string): Promise<SplitSummary> {
  // Bills you created, plus any you're a participant in.
  const mine = await db
    .select({ id: t.splitBills.id })
    .from(t.splitBills)
    .where(eq(t.splitBills.createdBy, residentId));

  const involved = await db
    .select({ id: t.splitShares.billId })
    .from(t.splitShares)
    .where(eq(t.splitShares.residentId, residentId));

  const ids = [...new Set([...mine, ...involved].map((r) => r.id))];
  const bills = await loadBills(ids, residentId);

  let youOwe = 0;
  let owedToYou = 0;

  for (const bill of bills) {
    for (const share of bill.shares) {
      if (share.status === "settled") continue;
      // Your own share of a bill you created isn't a debt to yourself.
      if (share.isMe && bill.createdBy !== residentId) youOwe += share.amount;
      if (!share.isMe && bill.createdBy === residentId) owedToYou += share.amount;
    }
  }

  return { bills, youOwe, owedToYou, netBalance: owedToYou - youOwe };
}

export async function createSplit(
  residentId: string,
  input: {
    title: string;
    category: SplitCategory;
    note: string;
    totalAmount: number;
    participantIds: string[];
  }
): Promise<SplitBill> {
  const id = await nextId("SPL");

  await db.insert(t.splitBills).values({
    id,
    createdBy: residentId,
    title: input.title,
    category: input.category,
    note: input.note,
    totalAmount: input.totalAmount,
  });

  // Split evenly; the creator absorbs the remainder so the shares add up to
  // the total exactly rather than being off by a rupee or two.
  const n = input.participantIds.length;
  const base = Math.floor(input.totalAmount / n);
  const remainder = input.totalAmount - base * n;

  await db.insert(t.splitShares).values(
    input.participantIds.map((pid, i) => ({
      id: `${id}-${i + 1}`,
      billId: id,
      residentId: pid,
      amount: pid === residentId ? base + remainder : base,
      // The creator already paid; their own share is settled from the start.
      status: pid === residentId ? ("settled" as const) : ("pending" as const),
      settledAt: pid === residentId ? new Date() : null,
    }))
  );

  for (const pid of input.participantIds) {
    if (pid === residentId) continue;
    await db.insert(t.notifications).values({
      id: randomUUID(),
      residentId: pid,
      title: "You've been added to a bill",
      body: `${input.title} — your share is ₹${base.toLocaleString("en-IN")}.`,
      kind: "info",
      href: "/payments/splits",
      read: false,
    });
  }

  const [bill] = await loadBills([id], residentId);
  return bill as SplitBill;
}

export async function settleShare(shareId: string): Promise<void> {
  const [share] = await db
    .update(t.splitShares)
    .set({ status: "settled", settledAt: new Date() })
    .where(
      and(eq(t.splitShares.id, shareId), eq(t.splitShares.status, "pending"))
    )
    .returning();

  if (!share) return;

  // Close the bill once every share is settled.
  const [row] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(t.splitShares)
    .where(
      and(
        eq(t.splitShares.billId, share.billId),
        eq(t.splitShares.status, "pending")
      )
    );

  if ((row?.pending ?? 0) === 0) {
    await db
      .update(t.splitBills)
      .set({ settledAt: new Date() })
      .where(eq(t.splitBills.id, share.billId));
  }
}

export async function getShare(
  shareId: string
): Promise<typeof t.splitShares.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(t.splitShares)
    .where(eq(t.splitShares.id, shareId))
    .limit(1);
  return row;
}

export async function deleteSplit(
  residentId: string,
  id: string
): Promise<boolean> {
  const result = await db
    .delete(t.splitBills)
    .where(
      and(eq(t.splitBills.id, id), eq(t.splitBills.createdBy, residentId))
    )
    .returning({ id: t.splitBills.id });
  return result.length > 0;
}

/** Roommates first — they're who a bill is usually split with. */
export async function splitCandidates(
  residentId: string
): Promise<SplitCandidate[]> {
  const [mine] = await db
    .select({ roomNumber: t.rooms.roomNumber })
    .from(t.rooms)
    .where(eq(t.rooms.residentId, residentId))
    .limit(1);

  const rows = await db
    .select({
      residentId: t.residents.id,
      fullName: t.residents.fullName,
      roomNumber: t.rooms.roomNumber,
    })
    .from(t.residents)
    .leftJoin(t.rooms, eq(t.residents.id, t.rooms.residentId))
    .where(
      and(
        ne(t.residents.id, residentId),
        eq(t.residents.accountStatus, "approved")
      )
    )
    .orderBy(t.residents.fullName);

  return rows
    .map((r) => ({
      ...r,
      sameRoom: mine?.roomNumber != null && r.roomNumber === mine.roomNumber,
    }))
    .sort((a, b) => Number(b.sameRoom) - Number(a.sameRoom));
}
