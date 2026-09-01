import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import type {
  AdminDepositRow,
  AdminInvoiceRow,
  AdminPaymentRow,
  GenerateInvoicesBody,
  RefundDepositBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { adminOf } from "../admin-auth";
import { db } from "../db/client";
import * as t from "../db/schema";
import * as fin from "../data/finance";
import { getResident } from "../data/db";

export const adminFinanceRouter: Router = Router();

function pathParam(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.badRequest(`Missing ${what}.`);
  }
  return value;
}

async function invoiceRows(): Promise<AdminInvoiceRow[]> {
  const rows = await db
    .select({
      invoice: t.invoices,
      residentName: t.residents.fullName,
      roomNumber: t.rooms.roomNumber,
    })
    .from(t.invoices)
    .innerJoin(t.residents, eq(t.invoices.residentId, t.residents.id))
    .leftJoin(t.rooms, eq(t.invoices.residentId, t.rooms.residentId))
    .orderBy(desc(t.invoices.periodFrom));

  const today = new Date().toISOString().slice(0, 10);

  return rows.map(({ invoice, residentName, roomNumber }) => ({
    id: invoice.id,
    number: invoice.number,
    residentId: invoice.residentId,
    periodFrom: invoice.periodFrom,
    periodTo: invoice.periodTo,
    issuedAt: invoice.issuedAt.toISOString(),
    dueOn: invoice.dueOn,
    lines: invoice.lines,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    status:
      (invoice.status === "issued" || invoice.status === "part_paid") &&
      invoice.dueOn < today
        ? "overdue"
        : invoice.status,
    residentName,
    roomNumber,
  }));
}

adminFinanceRouter.get("/finance/invoices", async (_req, res) => {
  res.json(await invoiceRows());
});

adminFinanceRouter.post("/finance/invoices/generate", async (req, res) => {
  const { periodFrom } = req.body as Partial<GenerateInvoicesBody>;

  if (typeof periodFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(periodFrom)) {
    throw HttpError.badRequest("Pick a month to bill.");
  }
  if (!periodFrom.endsWith("-01")) {
    throw HttpError.badRequest("Billing runs from the first of the month.");
  }

  const { created, skipped } = await fin.generateInvoices(periodFrom);
  const all = await invoiceRows();

  res.status(201).json({
    created: created.length,
    skipped,
    invoices: all.filter((i) => created.includes(i.id)),
  });
});

adminFinanceRouter.post("/finance/invoices/:id/void", async (req, res) => {
  const voided = await fin.voidInvoice(pathParam(req.params.id, "invoice id"));
  if (!voided) {
    throw HttpError.badRequest(
      "That invoice either doesn't exist or has money against it. Refund it instead."
    );
  }
  res.json(voided);
});

adminFinanceRouter.get("/finance/payments", async (_req, res) => {
  const rows = await db
    .select({
      order: t.paymentOrders,
      residentName: t.residents.fullName,
      invoiceNumber: t.invoices.number,
    })
    .from(t.paymentOrders)
    .innerJoin(t.residents, eq(t.paymentOrders.residentId, t.residents.id))
    .leftJoin(t.invoices, eq(t.paymentOrders.invoiceId, t.invoices.id))
    .orderBy(desc(t.paymentOrders.createdAt));

  const body: AdminPaymentRow[] = rows.map(({ order, residentName, invoiceNumber }) => ({
    id: order.id,
    residentId: order.residentId,
    invoiceId: order.invoiceId,
    splitShareId: order.splitShareId,
    amount: order.amount,
    method: order.method,
    provider: order.provider,
    providerRef: order.providerRef,
    status: order.status,
    failureReason: order.failureReason,
    createdAt: order.createdAt.toISOString(),
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    authorisationUrl: null,
    residentName,
    invoiceNumber,
  }));

  res.json(body);
});

/* -------------------------------------------------------------- deposits */

adminFinanceRouter.get("/finance/deposits", async (_req, res) => {
  const rows = await db
    .select({
      residentId: t.residents.id,
      residentName: t.residents.fullName,
      roomNumber: t.rooms.roomNumber,
    })
    .from(t.residents)
    .leftJoin(t.rooms, eq(t.residents.id, t.rooms.residentId))
    .where(eq(t.residents.accountStatus, "approved"))
    .orderBy(t.residents.fullName);

  const body: AdminDepositRow[] = await Promise.all(
    rows.map(async (r) => {
      const state = await fin.getDeposit(r.residentId);
      return {
        residentId: r.residentId,
        residentName: r.residentName,
        roomNumber: r.roomNumber,
        status: state.status,
        amount: state.amount,
        totalDeducted: state.totalDeducted,
        refundable: state.refundable,
      };
    })
  );

  res.json(body);
});

adminFinanceRouter.get("/finance/deposits/:residentId", async (req, res) => {
  const id = pathParam(req.params.residentId, "resident id");
  if (!(await getResident(id))) {
    throw HttpError.notFound("We couldn't find that resident.");
  }
  res.json(await fin.getDeposit(id));
});

adminFinanceRouter.post(
  "/finance/deposits/:residentId/deductions",
  async (req, res) => {
    const id = pathParam(req.params.residentId, "resident id");
    if (!(await getResident(id))) {
      throw HttpError.notFound("We couldn't find that resident.");
    }

    const body = req.body as {
      amount?: unknown;
      reason?: unknown;
      inventoryItemId?: unknown;
    };

    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw HttpError.badRequest("Enter a whole rupee amount above zero.");
    }
    if (typeof body.reason !== "string" || body.reason.trim().length < 5) {
      throw HttpError.badRequest(
        "Say what the deduction is for. The resident sees it."
      );
    }

    const state = await fin.getDeposit(id);
    if (state.status !== "held") {
      throw HttpError.badRequest(
        "The deposit is no longer held, so it can't be deducted from."
      );
    }
    if (amount > state.refundable) {
      throw HttpError.badRequest(
        `Only ₹${state.refundable.toLocaleString("en-IN")} is left to deduct from.`
      );
    }

    res.status(201).json(
      await fin.addDeduction(id, {
        amount,
        reason: body.reason.trim(),
        inventoryItemId:
          typeof body.inventoryItemId === "string" ? body.inventoryItemId : null,
        createdBy: adminOf(req).name,
      })
    );
  }
);

adminFinanceRouter.delete(
  "/finance/deposits/:residentId/deductions/:id",
  async (req, res) => {
    const residentId = pathParam(req.params.residentId, "resident id");
    const state = await fin.getDeposit(residentId);

    if (state.status !== "held") {
      throw HttpError.badRequest(
        "The refund has already started, so deductions are locked."
      );
    }

    res.json(
      await fin.removeDeduction(residentId, pathParam(req.params.id, "deduction id"))
    );
  }
);

adminFinanceRouter.post("/finance/deposits/:residentId/refund", async (req, res) => {
  const id = pathParam(req.params.residentId, "resident id");
  const { reference } = req.body as Partial<RefundDepositBody>;

  const state = await fin.getDeposit(id);

  // Two-step on purpose: "initiated" is what the resident sees while the
  // transfer is in flight, and it locks further deductions.
  if (state.status === "held") {
    const updated = await fin.setRefundStage(id, "refund_initiated", null);
    if (!updated) throw HttpError.badRequest("Couldn't start the refund.");
    res.json(updated);
    return;
  }

  if (state.status === "refund_initiated") {
    if (typeof reference !== "string" || reference.trim().length < 3) {
      throw HttpError.badRequest(
        "Enter the bank reference for the transfer you made."
      );
    }
    const updated = await fin.setRefundStage(id, "refunded", reference.trim());
    if (!updated) throw HttpError.badRequest("Couldn't complete the refund.");
    res.json(updated);
    return;
  }

  throw HttpError.badRequest(
    state.status === "refunded"
      ? "This deposit is already refunded."
      : "There's no deposit held for this resident."
  );
});
