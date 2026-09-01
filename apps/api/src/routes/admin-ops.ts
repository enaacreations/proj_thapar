import { Router } from "express";
import {
  ADMIN_STATUS_OPTIONS,
  type AllocateRoomBody,
  type PaymentPlanBody,
  type RecordPaymentBody,
  type RequestStatus,
  type ServiceRequestKind,
  type UpdateRequestStatusBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { adminOf } from "../admin-auth";
import * as ops from "../data/admin-ops";
import { getResident } from "../data/db";

export const adminOpsRouter: Router = Router();

function pathParam(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.badRequest(`Missing ${what}.`);
  }
  return value;
}

function parseKind(value: unknown): ServiceRequestKind {
  const kind = pathParam(value, "request kind");
  if (!ops.REQUEST_KINDS.includes(kind as ServiceRequestKind)) {
    throw HttpError.badRequest(`"${kind}" is not a kind of request.`);
  }
  return kind as ServiceRequestKind;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw HttpError.badRequest(`${field} is required.`);
  }
  return value.trim();
}

function requireDate(value: unknown, field: string): string {
  const raw = requireString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw HttpError.badRequest(`${field} must be a date like 2026-09-01.`);
  }
  return raw;
}

async function requireResident(id: string): Promise<void> {
  if (!(await getResident(id))) {
    throw HttpError.notFound("We couldn't find that resident.");
  }
}

/* ------------------------------------------------------------- dashboard */

adminOpsRouter.get("/dashboard", async (_req, res) => {
  res.json(await ops.dashboard());
});

/* -------------------------------------------------------------- requests */

adminOpsRouter.get("/requests", async (req, res) => {
  const kindRaw = typeof req.query.kind === "string" ? req.query.kind : null;
  const statusRaw =
    typeof req.query.status === "string" ? req.query.status : null;

  const filter: { kind?: ServiceRequestKind; status?: RequestStatus } = {};

  if (kindRaw) filter.kind = parseKind(kindRaw);
  if (statusRaw) {
    const allowed: RequestStatus[] = [
      "submitted",
      "in_progress",
      "resolved",
      "rejected",
      "cancelled",
    ];
    if (!allowed.includes(statusRaw as RequestStatus)) {
      throw HttpError.badRequest(`"${statusRaw}" is not a status.`);
    }
    filter.status = statusRaw as RequestStatus;
  }

  res.json(await ops.listAllRequests(filter));
});

adminOpsRouter.get("/requests/:kind/:id", async (req, res) => {
  const found = await ops.getRequest(
    parseKind(req.params.kind),
    pathParam(req.params.id, "request id")
  );
  if (!found) throw HttpError.notFound("We couldn't find that request.");
  res.json(found);
});

adminOpsRouter.post("/requests/:kind/:id/status", async (req, res) => {
  const kind = parseKind(req.params.kind);
  const id = pathParam(req.params.id, "request id");
  const { status, note } = req.body as Partial<UpdateRequestStatusBody>;

  if (
    typeof status !== "string" ||
    !ADMIN_STATUS_OPTIONS.includes(status as RequestStatus)
  ) {
    throw HttpError.badRequest(
      `Status must be one of: ${ADMIN_STATUS_OPTIONS.join(", ")}.`
    );
  }

  // The resident reads this on their timeline, so a decline needs a reason.
  if (status === "rejected" && (typeof note !== "string" || note.trim().length < 5)) {
    throw HttpError.badRequest(
      "Give a short reason for declining. The resident sees it."
    );
  }

  const updated = await ops.setRequestStatus(
    kind,
    id,
    status as RequestStatus,
    typeof note === "string" ? note.trim() : "",
    adminOf(req).name
  );

  if (!updated) {
    throw new HttpError(
      409,
      "already_closed",
      `${id} is already closed, so it can't be changed. Refresh to see its current status.`
    );
  }

  res.json(updated);
});

/* ------------------------------------------------------------- residents */

adminOpsRouter.get("/residents", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json(await ops.listResidents(search));
});

adminOpsRouter.get("/residents/:id", async (req, res) => {
  const found = await ops.getResidentDetail(pathParam(req.params.id, "resident id"));
  if (!found) throw HttpError.notFound("We couldn't find that resident.");
  res.json(found);
});

adminOpsRouter.put("/residents/:id/room", async (req, res) => {
  const id = pathParam(req.params.id, "resident id");
  await requireResident(id);

  const body = req.body as Partial<AllocateRoomBody>;

  res.json(
    await ops.allocateRoom(id, {
      roomNumber: requireString(body.roomNumber, "Room number"),
      floor: requireString(body.floor, "Floor"),
      wing: requireString(body.wing, "Wing"),
      buildingName: requireString(body.buildingName, "Building"),
      propertyName: requireString(body.propertyName, "Property"),
      propertyAddress: requireString(body.propertyAddress, "Address"),
      roomType: requireString(body.roomType, "Room type"),
      occupancy: requireString(body.occupancy, "Occupancy"),
    })
  );
});

adminOpsRouter.put("/residents/:id/payment-plan", async (req, res) => {
  const id = pathParam(req.params.id, "resident id");
  await requireResident(id);

  const body = req.body as Partial<PaymentPlanBody>;
  const nextDueOn =
    body.nextDueOn == null || body.nextDueOn === ""
      ? null
      : requireDate(body.nextDueOn, "Next due date");

  const nextDueAmount =
    body.nextDueAmount == null ? null : Number(body.nextDueAmount);
  if (nextDueAmount !== null && (!Number.isFinite(nextDueAmount) || nextDueAmount < 0)) {
    throw HttpError.badRequest("Next due amount must be a positive number.");
  }

  res.json(
    await ops.setPaymentPlan(id, {
      plan: requireString(body.plan, "Plan"),
      paidUpTo: requireDate(body.paidUpTo, "Paid up to"),
      nextDueOn,
      nextDueAmount,
    })
  );
});

adminOpsRouter.post("/residents/:id/payments", async (req, res) => {
  const id = pathParam(req.params.id, "resident id");
  await requireResident(id);

  const body = req.body as Partial<RecordPaymentBody>;
  const amount = Number(body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw HttpError.badRequest("Enter the amount received.");
  }
  if (
    body.mode !== "cash" &&
    body.mode !== "upi" &&
    body.mode !== "card" &&
    body.mode !== "netbanking"
  ) {
    throw HttpError.badRequest("Choose how the payment was made.");
  }

  const periodFrom = requireDate(body.periodFrom, "Period start");
  const periodTo = requireDate(body.periodTo, "Period end");
  if (periodTo < periodFrom) {
    throw HttpError.badRequest("The period end can't be before the start.");
  }

  res.status(201).json(
    await ops.recordPayment(id, {
      paidOn: requireDate(body.paidOn, "Paid on"),
      amount: Math.round(amount),
      mode: body.mode,
      periodFrom,
      periodTo,
      receiptNo: requireString(body.receiptNo, "Receipt number"),
    })
  );
});

/* -------------------------------------------------------------- feedback */

adminOpsRouter.get("/feedback", async (_req, res) => {
  res.json(await ops.listFeedback());
});
