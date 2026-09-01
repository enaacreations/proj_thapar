import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  CLOTHING_LABELS,
  MEAL_LABELS,
  RELATION_LABELS,
  type AdminDashboard,
  type AdminFeedbackEntry,
  type AdminRequestDetail,
  type AdminRequestSummary,
  type AdminResidentDetail,
  type AdminResidentSummary,
  type AllocateRoomBody,
  type PaymentPlanBody,
  type PaymentSummary,
  type RecordPaymentBody,
  type RequestStatus,
  type RoomDetails,
  type ServiceRequestKind,
  type ServiceRequestSummary,
} from "@proj/shared";
import { db } from "../db/client";
import * as t from "../db/schema";
import { getAttendanceSummary, getPayments, isoDate, mask, nextId } from "./db";

/**
 * Cross-resident reads and writes for the admin panel. The resident-side
 * repository in data/db.ts is scoped to one person; these deliberately are not.
 */

const iso = (d: Date) => d.toISOString();

const OPEN: RequestStatus[] = ["submitted", "in_progress"];

/* ---------------------------------------------------------------- requests */

/** The four request tables share enough shape to be queried uniformly. */
const REQUEST_TABLES = {
  maintenance: t.maintenanceRequests,
  laundry: t.laundryRequests,
  complaint: t.complaints,
  visit: t.visitRequests,
} as const;

export const REQUEST_KINDS = Object.keys(
  REQUEST_TABLES
) as ServiceRequestKind[];

export async function listAllRequests(filter: {
  kind?: ServiceRequestKind;
  status?: RequestStatus;
}): Promise<AdminRequestSummary[]> {
  const kinds = filter.kind ? [filter.kind] : REQUEST_KINDS;

  const perKind = await Promise.all(
    kinds.map(async (kind) => {
      const table = REQUEST_TABLES[kind];

      const rows = await db
        .select({
          id: table.id,
          title: table.title,
          status: table.status,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
          residentId: table.residentId,
          residentName: t.residents.fullName,
          roomNumber: t.rooms.roomNumber,
        })
        .from(table)
        .innerJoin(t.residents, eq(table.residentId, t.residents.id))
        .leftJoin(t.rooms, eq(table.residentId, t.rooms.residentId))
        .where(filter.status ? eq(table.status, filter.status) : undefined)
        .orderBy(desc(table.createdAt));

      return rows.map(
        (r): AdminRequestSummary => ({
          id: r.id,
          kind,
          title: r.title,
          status: r.status,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
          residentId: r.residentId,
          residentName: r.residentName,
          roomNumber: r.roomNumber,
        })
      );
    })
  );

  return perKind
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Kind-specific columns, flattened so one screen can render any request. */
function detailRows(
  kind: ServiceRequestKind,
  row: Record<string, unknown>
): { label: string; value: string }[] {
  switch (kind) {
    case "maintenance":
      return [
        { label: "Category", value: String(row.categoryLabel) },
        { label: "Problem", value: String(row.subCategoryLabel) },
        { label: "Resident's note", value: String(row.remarks) },
      ];
    case "laundry": {
      const items = (row.items as { type: keyof typeof CLOTHING_LABELS; count: number; pressing: boolean }[]) ?? [];
      return [
        {
          label: "Items",
          value: items
            .map(
              (i) =>
                `${i.count} × ${CLOTHING_LABELS[i.type]}${i.pressing ? " (pressing)" : ""}`
            )
            .join(", "),
        },
        { label: "Total pieces", value: String(row.totalPieces) },
        { label: "Pickup slot", value: String(row.pickupSlot) },
      ];
    }
    case "complaint":
      return [
        { label: "Category", value: String(row.categoryLabel) },
        { label: "Issue", value: String(row.subCategoryLabel) },
        { label: "Resident's note", value: String(row.remarks) },
        ...(row.againstRequestId
          ? [{ label: "Linked request", value: String(row.againstRequestId) }]
          : []),
      ];
    case "visit": {
      const meals =
        (row.foodSelections as { meal: keyof typeof MEAL_LABELS; items: string[] }[]) ?? [];
      return [
        { label: "Visitor", value: String(row.visitorName) },
        {
          label: "Relation",
          value: RELATION_LABELS[row.relation as keyof typeof RELATION_LABELS],
        },
        { label: "Visit date", value: String(row.visitDate) },
        { label: "Duration", value: `${row.durationHours} hours` },
        {
          label: "Food",
          value: row.foodRequired
            ? meals
                .map((m) => `${MEAL_LABELS[m.meal]}: ${m.items.join(", ")}`)
                .join(" · ") || "Ordered"
            : "Not ordered",
        },
      ];
    }
  }
}

export async function getRequest(
  kind: ServiceRequestKind,
  id: string
): Promise<AdminRequestDetail | undefined> {
  const table = REQUEST_TABLES[kind];

  const [row] = await db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  if (!row) return undefined;

  const [resident] = await db
    .select({ name: t.residents.fullName })
    .from(t.residents)
    .where(eq(t.residents.id, row.residentId))
    .limit(1);

  const [room] = await db
    .select({ roomNumber: t.rooms.roomNumber })
    .from(t.rooms)
    .where(eq(t.rooms.residentId, row.residentId))
    .limit(1);

  const events = await db
    .select()
    .from(t.trackingEvents)
    .where(eq(t.trackingEvents.requestId, id))
    .orderBy(t.trackingEvents.at);

  const record = row as Record<string, unknown>;

  return {
    id: row.id,
    kind,
    title: row.title,
    status: row.status,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    residentId: row.residentId,
    residentName: resident?.name ?? "Unknown",
    roomNumber: room?.roomNumber ?? null,
    details: detailRows(kind, record),
    photoUris: (record.photoUris as string[] | undefined) ?? [],
    timeline: events.map((e) => ({
      status: e.status,
      note: e.note,
      at: iso(e.at),
    })),
  };
}

const NOTIFY: Record<RequestStatus, { title: string; kind: "info" | "success" | "warning" | "danger" }> = {
  submitted: { title: "Request received", kind: "info" },
  in_progress: { title: "Someone's on it", kind: "info" },
  resolved: { title: "Marked as done", kind: "success" },
  rejected: { title: "Request declined", kind: "danger" },
  cancelled: { title: "Request cancelled", kind: "warning" },
};

/**
 * Moves a request forward. The status filter in the WHERE clause means a
 * request that someone else already closed can't be reopened by a stale tab.
 */
export async function setRequestStatus(
  kind: ServiceRequestKind,
  id: string,
  status: RequestStatus,
  note: string,
  reviewer: string
): Promise<AdminRequestDetail | null> {
  const table = REQUEST_TABLES[kind];

  const [updated] = await db
    .update(table)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(table.id, id), inArray(table.status, OPEN)))
    .returning();

  if (!updated) return null;

  await db.insert(t.trackingEvents).values({
    requestId: id,
    status,
    note: note || `${NOTIFY[status].title} by ${reviewer}`,
  });

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId: updated.residentId,
    title: NOTIFY[status].title,
    body: note
      ? `${updated.title} (${id}): ${note}`
      : `${updated.title} (${id}) is now ${status.replace("_", " ")}.`,
    kind: NOTIFY[status].kind,
    href: `/${kind === "complaint" ? "complaints" : kind === "visit" ? "visits" : kind}/${id}`,
    read: false,
  });

  return getRequest(kind, id).then((r) => r ?? null);
}

/* -------------------------------------------------------------- residents */

export async function listResidents(
  search?: string
): Promise<AdminResidentSummary[]> {
  const rows = await db
    .select({
      id: t.residents.id,
      fullName: t.residents.fullName,
      mobile: t.residents.mobile,
      accountStatus: t.residents.accountStatus,
      roomNumber: t.rooms.roomNumber,
      propertyName: t.rooms.propertyName,
    })
    .from(t.residents)
    .leftJoin(t.rooms, eq(t.residents.id, t.rooms.residentId))
    .orderBy(t.residents.fullName);

  // Counting open requests per resident in SQL would need four correlated
  // subqueries; the resident count here is small enough to tally in memory.
  const open = await openRequestCounts();

  const filtered = search
    ? rows.filter((r) =>
        `${r.fullName} ${r.mobile} ${r.id}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : rows;

  return filtered.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    mobile: r.mobile,
    accountStatus: r.accountStatus,
    roomNumber: r.roomNumber,
    propertyName: r.propertyName,
    openRequests: open.get(r.id) ?? 0,
  }));
}

async function openRequestCounts(): Promise<Map<string, number>> {
  const tally = new Map<string, number>();

  await Promise.all(
    REQUEST_KINDS.map(async (kind) => {
      const table = REQUEST_TABLES[kind];
      const rows = await db
        .select({ residentId: table.residentId, n: count() })
        .from(table)
        .where(inArray(table.status, OPEN))
        .groupBy(table.residentId);

      for (const row of rows) {
        tally.set(row.residentId, (tally.get(row.residentId) ?? 0) + row.n);
      }
    })
  );

  return tally;
}

export async function getResidentDetail(
  id: string
): Promise<AdminResidentDetail | undefined> {
  const [resident] = await db
    .select()
    .from(t.residents)
    .where(eq(t.residents.id, id))
    .limit(1);
  if (!resident) return undefined;

  const [roomRow] = await db
    .select()
    .from(t.rooms)
    .where(eq(t.rooms.residentId, id))
    .limit(1);

  const [payments, attendance] = await Promise.all([
    getPayments(id),
    getAttendanceSummary(id),
  ]);

  const recent = await recentRequestsFor(id);

  const birth = new Date(resident.dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  const room: RoomDetails | null = roomRow
    ? {
        roomNumber: roomRow.roomNumber,
        floor: roomRow.floor,
        wing: roomRow.wing,
        buildingName: roomRow.buildingName,
        propertyName: roomRow.propertyName,
        propertyAddress: roomRow.propertyAddress,
        roomType: roomRow.roomType,
        occupancy: roomRow.occupancy,
      }
    : null;

  return {
    id: resident.id,
    fullName: resident.fullName,
    mobile: resident.mobile,
    age,
    gender: resident.gender,
    dob: resident.dob,
    kycType: resident.kycType,
    kycMasked: mask(resident.kycNumber),
    accountStatus: resident.accountStatus,
    joinedAt: iso(resident.createdAt),
    room,
    payments: payments ?? null,
    attendance: {
      todayMarked: attendance.todayMarked,
      presentDays: attendance.presentDays,
      totalDays: attendance.totalDays,
      streak: attendance.streak,
    },
    recentRequests: recent,
  };
}

async function recentRequestsFor(
  residentId: string
): Promise<ServiceRequestSummary[]> {
  const perKind = await Promise.all(
    REQUEST_KINDS.map(async (kind) => {
      const table = REQUEST_TABLES[kind];
      const rows = await db
        .select({
          id: table.id,
          title: table.title,
          status: table.status,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
        })
        .from(table)
        .where(eq(table.residentId, residentId))
        .orderBy(desc(table.createdAt))
        .limit(5);

      return rows.map(
        (r): ServiceRequestSummary => ({
          id: r.id,
          kind,
          title: r.title,
          status: r.status,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        })
      );
    })
  );

  return perKind
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
}

export async function allocateRoom(
  residentId: string,
  body: AllocateRoomBody
): Promise<RoomDetails> {
  await db
    .insert(t.rooms)
    .values({ ...body, residentId })
    .onConflictDoUpdate({ target: t.rooms.residentId, set: body });

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId,
    title: "Your room is ready",
    body: `Room ${body.roomNumber}, ${body.floor}, ${body.wing} at ${body.propertyName}.`,
    kind: "success",
    href: "/room",
    read: false,
  });

  return body;
}

export async function setPaymentPlan(
  residentId: string,
  body: PaymentPlanBody
): Promise<PaymentSummary | undefined> {
  await db
    .insert(t.paymentPlans)
    .values({ ...body, residentId })
    .onConflictDoUpdate({ target: t.paymentPlans.residentId, set: body });

  return getPayments(residentId);
}

export async function recordPayment(
  residentId: string,
  body: RecordPaymentBody
): Promise<PaymentSummary | undefined> {
  const id = await nextId("PAY");
  await db.insert(t.paymentEntries).values({ ...body, id, residentId });

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId,
    title: "Payment recorded",
    body: `₹${body.amount.toLocaleString("en-IN")} received. Receipt ${body.receiptNo}.`,
    kind: "success",
    href: "/payments",
    read: false,
  });

  return getPayments(residentId);
}

/* --------------------------------------------------- feedback + dashboard */

export async function listFeedback(): Promise<AdminFeedbackEntry[]> {
  const rows = await db
    .select({
      id: t.feedbackEntries.id,
      residentId: t.feedbackEntries.residentId,
      residentName: t.residents.fullName,
      categoryId: t.feedbackEntries.categoryId,
      categoryLabel: t.feedbackEntries.categoryLabel,
      subCategoryId: t.feedbackEntries.subCategoryId,
      subCategoryLabel: t.feedbackEntries.subCategoryLabel,
      rating: t.feedbackEntries.rating,
      remarks: t.feedbackEntries.remarks,
      photoUris: t.feedbackEntries.photoUris,
      createdAt: t.feedbackEntries.createdAt,
    })
    .from(t.feedbackEntries)
    .innerJoin(t.residents, eq(t.feedbackEntries.residentId, t.residents.id))
    .orderBy(desc(t.feedbackEntries.createdAt));

  return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) }));
}

export async function dashboard(): Promise<AdminDashboard> {
  const [statusRows, residentTotal, withRoom, attendanceToday, ratingRow] =
    await Promise.all([
      db
        .select({ status: t.residents.accountStatus, n: count() })
        .from(t.residents)
        .groupBy(t.residents.accountStatus),
      db.select({ n: count() }).from(t.residents),
      db.select({ n: count() }).from(t.rooms),
      db
        .select({ n: count() })
        .from(t.attendanceRecords)
        .where(eq(t.attendanceRecords.date, isoDate(new Date()))),
      db
        .select({ avg: sql<string | null>`avg(${t.feedbackEntries.rating})` })
        .from(t.feedbackEntries),
    ]);

  const registrations = { pending: 0, approved: 0, rejected: 0 };
  for (const row of statusRows) {
    if (row.status === "pending_approval") registrations.pending = row.n;
    if (row.status === "approved") registrations.approved = row.n;
    if (row.status === "rejected") registrations.rejected = row.n;
  }

  const byKind = await Promise.all(
    REQUEST_KINDS.map(async (kind) => {
      const table = REQUEST_TABLES[kind];
      const [row] = await db
        .select({ n: count() })
        .from(table)
        .where(inArray(table.status, OPEN));
      return [kind, row?.n ?? 0] as const;
    })
  );

  const requestsByKind = Object.fromEntries(byKind) as Record<
    ServiceRequestKind,
    number
  >;

  const avg = ratingRow[0]?.avg;

  const today = isoDate(new Date());
  const invoiceRows = await db
    .select({
      total: t.invoices.total,
      amountPaid: t.invoices.amountPaid,
      dueOn: t.invoices.dueOn,
      status: t.invoices.status,
    })
    .from(t.invoices);

  const open = invoiceRows.filter(
    (i) => i.status !== "paid" && i.status !== "void"
  );

  const depositRows = await db
    .select({ status: t.deposits.status })
    .from(t.deposits);

  return {
    registrations,
    openRequests: byKind.reduce((sum, [, n]) => sum + n, 0),
    requestsByKind,
    residents: { total: residentTotal[0]?.n ?? 0, withRoom: withRoom[0]?.n ?? 0 },
    attendanceToday: attendanceToday[0]?.n ?? 0,
    averageRating: avg == null ? null : Math.round(Number(avg) * 10) / 10,
    finance: {
      outstanding: open.reduce((sum, i) => sum + (i.total - i.amountPaid), 0),
      overdueInvoices: open.filter((i) => i.dueOn < today).length,
      depositsHeld: depositRows.filter((d) => d.status === "held").length,
      refundsPending: depositRows.filter((d) => d.status === "refund_initiated")
        .length,
    },
  };
}
