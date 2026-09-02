import { Router } from "express";
import {
  SPLIT_CATEGORY_LABELS,
  type CreateSplitBillBody,
  type DocumentRef,
  type FinanceOverview,
  type PaymentMethod,
  type SplitCategory,
  type StartPaymentBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import * as fin from "../data/finance";
import { signDocumentUrl } from "../documents";

export const financeRouter: Router = Router();

const METHODS: PaymentMethod[] = ["upi", "card", "netbanking", "mandate"];

function pathParam(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.badRequest(`Missing ${what}.`);
  }
  return value;
}

function rupees(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw HttpError.badRequest(`${field} must be more than zero.`);
  }
  if (!Number.isInteger(n)) {
    throw HttpError.badRequest(`${field} must be a whole number of rupees.`);
  }
  return n;
}

/* ------------------------------------------------------------- overview */

financeRouter.get("/overview", async (req, res) => {
  const residentId = residentIdOf(req);

  const [invoices, mandate, deposit, activePlan, splits] = await Promise.all([
    fin.listInvoices(residentId),
    fin.getMandate(residentId),
    fin.getDeposit(residentId),
    fin.activePlanFor(residentId),
    fin.listSplits(residentId),
  ]);

  const unpaid = invoices.filter(
    (i) => i.status !== "paid" && i.status !== "void"
  );
  const outstanding = unpaid.reduce((sum, i) => sum + (i.total - i.amountPaid), 0);
  const next = [...unpaid].sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];

  const body: FinanceOverview = {
    outstanding,
    nextDueOn: next?.dueOn ?? null,
    nextDueAmount: next ? next.total - next.amountPaid : null,
    overdueCount: unpaid.filter((i) => i.status === "overdue").length,
    invoices,
    mandate,
    deposit,
    activePlan,
    splitNetBalance: splits.netBalance,
  };

  res.json(body);
});

/* ------------------------------------------------------------- invoices */

financeRouter.get("/invoices", async (req, res) => {
  res.json(await fin.listInvoices(residentIdOf(req)));
});

financeRouter.get("/invoices/:id", async (req, res) => {
  const found = await fin.getInvoice(
    residentIdOf(req),
    pathParam(req.params.id, "invoice id")
  );
  if (!found) throw HttpError.notFound("We couldn't find that invoice.");
  res.json(found);
});

/* ------------------------------------------------------------- payments */

financeRouter.get("/payments", async (req, res) => {
  res.json(await fin.listOrders(residentIdOf(req)));
});

financeRouter.post("/payments", async (req, res) => {
  const residentId = residentIdOf(req);
  const body = req.body as Partial<StartPaymentBody>;

  if (typeof body.method !== "string" || !METHODS.includes(body.method as PaymentMethod)) {
    throw HttpError.badRequest("Choose how you want to pay.");
  }
  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length < 8) {
    throw HttpError.badRequest("Missing idempotency key.");
  }

  const amount = rupees(body.amount, "Amount");
  let description = "Payment";
  let invoiceId: string | null = null;
  let splitShareId: string | null = null;

  if (body.invoiceId) {
    const invoice = await fin.getInvoice(residentId, body.invoiceId);
    if (!invoice) throw HttpError.notFound("We couldn't find that invoice.");
    if (invoice.status === "paid") {
      throw HttpError.badRequest("This invoice is already paid.");
    }
    if (invoice.status === "void") {
      throw HttpError.badRequest("This invoice was cancelled.");
    }

    const outstanding = invoice.total - invoice.amountPaid;
    if (amount > outstanding) {
      throw HttpError.badRequest(
        `That's more than the ₹${outstanding.toLocaleString("en-IN")} outstanding on this invoice.`
      );
    }

    invoiceId = invoice.id;
    description = `Invoice ${invoice.number}`;
  } else if (body.splitShareId) {
    const share = await fin.getShare(body.splitShareId);
    if (!share || share.residentId !== residentId) {
      throw HttpError.notFound("We couldn't find that share.");
    }
    if (share.status === "settled") {
      throw HttpError.badRequest("You've already settled this one.");
    }
    if (amount !== share.amount) {
      throw HttpError.badRequest("Pay the exact share amount.");
    }

    splitShareId = share.id;
    description = "Split bill share";
  } else {
    throw HttpError.badRequest("Nothing to pay for.");
  }

  if (body.method === "mandate") {
    const mandate = await fin.getMandate(residentId);
    if (!mandate || mandate.status !== "active") {
      throw HttpError.badRequest(
        "Auto-debit isn't active. Set it up first, or pay another way."
      );
    }
    if (amount > mandate.maxAmount) {
      throw HttpError.badRequest(
        `Your auto-debit limit is ₹${mandate.maxAmount.toLocaleString("en-IN")}. Pay this one another way.`
      );
    }
  }

  const order = await fin.startPayment(residentId, {
    invoiceId,
    splitShareId,
    amount,
    method: body.method as PaymentMethod,
    idempotencyKey: body.idempotencyKey,
    description,
  });

  res.status(201).json(order);
});

financeRouter.get("/payments/:id", async (req, res) => {
  const found = await fin.getOrder(
    residentIdOf(req),
    pathParam(req.params.id, "payment id")
  );
  if (!found) throw HttpError.notFound("We couldn't find that payment.");
  res.json(found);
});

/* ------------------------------------------------------------- mandates */

financeRouter.get("/mandate", async (req, res) => {
  res.json(await fin.getMandate(residentIdOf(req)));
});

financeRouter.post("/mandate", async (req, res) => {
  const body = req.body as { maxAmount?: unknown; dayOfMonth?: unknown; endDate?: unknown };

  const maxAmount = rupees(body.maxAmount, "Limit");
  const day = Number(body.dayOfMonth);
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    // Capped at 28 so every month has the day.
    throw HttpError.badRequest("Pick a day between 1 and 28.");
  }

  res.status(201).json(
    await fin.createMandate(residentIdOf(req), {
      maxAmount,
      dayOfMonth: day,
      endDate: typeof body.endDate === "string" ? body.endDate : null,
    })
  );
});

financeRouter.post("/mandate/pause", async (req, res) => {
  const { resume } = req.body as { resume?: boolean };
  const updated = await fin.setMandateStatus(
    residentIdOf(req),
    resume === true ? "active" : "paused"
  );
  if (!updated) throw HttpError.notFound("You don't have an auto-debit set up.");
  res.json(updated);
});

financeRouter.delete("/mandate", async (req, res) => {
  const updated = await fin.setMandateStatus(residentIdOf(req), "revoked");
  if (!updated) throw HttpError.notFound("You don't have an auto-debit set up.");
  res.status(204).end();
});

/* ---------------------------------------------------------- instalments */

financeRouter.get("/instalments/quote", async (req, res) => {
  const invoiceId = typeof req.query.invoiceId === "string" ? req.query.invoiceId : "";
  const count = Number(req.query.count ?? 3);

  if (![2, 3, 4, 6].includes(count)) {
    throw HttpError.badRequest("Choose 2, 3, 4 or 6 instalments.");
  }

  const invoice = await fin.getInvoice(residentIdOf(req), invoiceId);
  if (!invoice) throw HttpError.notFound("We couldn't find that invoice.");

  res.json(fin.quoteInstalments(invoice.total - invoice.amountPaid, count));
});

financeRouter.post("/instalments", async (req, res) => {
  const residentId = residentIdOf(req);
  const { invoiceId, count } = req.body as { invoiceId?: string; count?: number };

  if (![2, 3, 4, 6].includes(Number(count))) {
    throw HttpError.badRequest("Choose 2, 3, 4 or 6 instalments.");
  }

  const invoice = await fin.getInvoice(residentId, String(invoiceId ?? ""));
  if (!invoice) throw HttpError.notFound("We couldn't find that invoice.");
  if (invoice.status === "paid" || invoice.status === "void") {
    throw HttpError.badRequest("This invoice doesn't need a plan.");
  }

  const existing = await fin.getPlan(invoice.id);
  if (existing) {
    throw new HttpError(
      409,
      "plan_exists",
      "This invoice already has an instalment plan."
    );
  }

  res.status(201).json(await fin.createPlan(residentId, invoice, Number(count)));
});

/* -------------------------------------------------------------- deposit */

financeRouter.get("/deposit", async (req, res) => {
  res.json(await fin.getDeposit(residentIdOf(req)));
});

/* ---------------------------------------------------------- split bills */

financeRouter.get("/splits", async (req, res) => {
  res.json(await fin.listSplits(residentIdOf(req)));
});

financeRouter.get("/splits/candidates", async (req, res) => {
  res.json(await fin.splitCandidates(residentIdOf(req)));
});

/**
 * Looks up one registered student by mobile number, so a bill can be split
 * with someone who isn't a roommate. Full ten digits only — see the data-layer
 * note on why an exact match is the safe shape for this.
 */
financeRouter.get("/splits/lookup", async (req, res) => {
  const mobile = typeof req.query.mobile === "string" ? req.query.mobile.trim() : "";

  if (!/^\d{10}$/.test(mobile)) {
    throw HttpError.badRequest("Enter their full 10-digit mobile number.");
  }

  const found = await fin.findSplitCandidateByMobile(residentIdOf(req), mobile);
  if (!found) {
    throw HttpError.notFound(
      "Nobody is registered with that number. Check it, or ask them to register first."
    );
  }

  res.json(found);
});

financeRouter.post("/splits", async (req, res) => {
  const residentId = residentIdOf(req);
  const body = req.body as Partial<CreateSplitBillBody>;

  if (typeof body.title !== "string" || body.title.trim().length < 2) {
    throw HttpError.badRequest("What's this bill for?");
  }
  if (
    typeof body.category !== "string" ||
    !(body.category in SPLIT_CATEGORY_LABELS)
  ) {
    throw HttpError.badRequest("Pick a category.");
  }

  const totalAmount = rupees(body.totalAmount, "Amount");
  const ids = Array.isArray(body.participantIds) ? body.participantIds : [];

  // The creator is always in the split — they paid it.
  const participants = [...new Set([residentId, ...ids])];
  if (participants.length < 2) {
    throw HttpError.badRequest("Pick at least one person to split with.");
  }
  if (totalAmount < participants.length) {
    throw HttpError.badRequest(
      "That's too small to split — each share would be under a rupee."
    );
  }

  // Vet the ids directly rather than loading every candidate: participants can
  // now come from a mobile lookup, so the list to check against is the
  // resident table itself.
  const approved = await fin.approvedResidentIds(participants);
  if (participants.some((p) => !approved.has(p))) {
    throw HttpError.badRequest("One of those people isn't a resident here.");
  }

  res.status(201).json(
    await fin.createSplit(residentId, {
      title: body.title.trim(),
      category: body.category as SplitCategory,
      note: typeof body.note === "string" ? body.note.trim() : "",
      totalAmount,
      participantIds: participants,
    })
  );
});

financeRouter.delete("/splits/:id", async (req, res) => {
  const removed = await fin.deleteSplit(
    residentIdOf(req),
    pathParam(req.params.id, "bill id")
  );
  if (!removed) {
    throw HttpError.notFound("That bill doesn't exist, or you didn't create it.");
  }
  res.status(204).end();
});

/* ------------------------------------------------------------ documents */

financeRouter.get("/documents", async (req, res) => {
  const residentId = residentIdOf(req);
  const [invoices, payments] = await Promise.all([
    fin.listInvoices(residentId),
    fin.listOrders(residentId),
  ]);

  const docs: DocumentRef[] = [];

  for (const invoice of invoices) {
    if (invoice.status === "void") continue;
    docs.push({
      kind: "invoice",
      id: invoice.id,
      title: `Invoice ${invoice.number}`,
      subtitle: `${invoice.periodFrom} to ${invoice.periodTo}`,
      issuedAt: invoice.issuedAt,
    });
  }

  for (const order of payments) {
    if (order.status !== "succeeded") continue;
    docs.push({
      kind: "receipt",
      id: order.id,
      title: `Receipt for ₹${order.amount.toLocaleString("en-IN")}`,
      subtitle: order.completedAt?.slice(0, 10) ?? "",
      issuedAt: order.completedAt ?? order.createdAt,
    });
  }

  // One HRA statement per financial year that has any paid invoice.
  const years = new Set(
    invoices.filter((i) => i.amountPaid > 0).map((i) => i.periodFrom.slice(0, 4))
  );
  for (const year of years) {
    docs.push({
      kind: "hra",
      id: year,
      title: `HRA statement ${year}`,
      subtitle: "Rent paid, for your tax claim",
      issuedAt: `${year}-04-01T00:00:00.000Z`,
    });
  }

  docs.push({
    kind: "ledger",
    id: "all",
    title: "Account statement",
    subtitle: "Everything billed and paid",
    issuedAt: new Date().toISOString(),
  });

  res.json(docs.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
});

/**
 * Documents open in the system browser, which can't send a bearer token — so
 * the app asks for a short-lived signed URL instead of exposing the session.
 */
financeRouter.post("/documents/token", async (req, res) => {
  const { kind, id } = req.body as { kind?: string; id?: string };

  if (
    kind !== "invoice" &&
    kind !== "receipt" &&
    kind !== "hra" &&
    kind !== "ledger"
  ) {
    throw HttpError.badRequest("Unknown document type.");
  }

  res.json(signDocumentUrl(residentIdOf(req), kind, String(id ?? "all")));
});
