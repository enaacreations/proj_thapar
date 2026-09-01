import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import type {
  RegistrationCounts,
  RegistrationDetail,
  RegistrationSummary,
  ResidentAccountStatus,
} from "@proj/shared";
import { db } from "../db/client";
import * as t from "../db/schema";
import { mask } from "./db";

/** Admin-side reads and writes. Mirrors data/db.ts for the resident side. */

function ageFrom(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

type ResidentRow = typeof t.residents.$inferSelect;

function toSummary(r: ResidentRow): RegistrationSummary {
  return {
    residentId: r.id,
    fullName: r.fullName,
    mobile: r.mobile,
    gender: r.gender,
    age: ageFrom(r.dob),
    dobMasked: `XX/XX/${r.dob.slice(0, 4)}`,
    kycType: r.kycType,
    kycMasked: mask(r.kycNumber),
    status: r.accountStatus,
    submittedAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    reviewedBy: r.reviewedBy,
    reviewNote: r.reviewNote,
  };
}

export async function listRegistrations(
  status?: ResidentAccountStatus
): Promise<RegistrationSummary[]> {
  const rows = status
    ? await db
        .select()
        .from(t.residents)
        .where(eq(t.residents.accountStatus, status))
        .orderBy(desc(t.residents.createdAt))
    : await db.select().from(t.residents).orderBy(desc(t.residents.createdAt));

  return rows.map(toSummary);
}

/** Full KYC is only assembled here, for the detail screen. */
export async function getRegistration(
  id: string
): Promise<RegistrationDetail | undefined> {
  const [row] = await db
    .select()
    .from(t.residents)
    .where(eq(t.residents.id, id))
    .limit(1);
  if (!row) return undefined;

  return { ...toSummary(row), dob: row.dob, kycNumber: row.kycNumber };
}

export async function countsByStatus(): Promise<RegistrationCounts> {
  const rows = await db
    .select({ status: t.residents.accountStatus, n: count() })
    .from(t.residents)
    .groupBy(t.residents.accountStatus);

  const counts: RegistrationCounts = { pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    if (row.status === "pending_approval") counts.pending = row.n;
    if (row.status === "approved") counts.approved = row.n;
    if (row.status === "rejected") counts.rejected = row.n;
  }
  return counts;
}

/**
 * Approve or reject. Only a pending registration can be decided, so a double
 * submit or two reviewers racing can't overwrite an existing decision — the
 * status filter in the WHERE clause is what enforces it.
 */
export async function decideRegistration(
  id: string,
  decision: "approved" | "rejected",
  reviewer: { id: string; name: string },
  note: string | null
): Promise<RegistrationDetail | null> {
  const [updated] = await db
    .update(t.residents)
    .set({
      accountStatus: decision,
      reviewedAt: new Date(),
      reviewedBy: reviewer.name,
      reviewNote: note,
    })
    .where(
      and(
        eq(t.residents.id, id),
        eq(t.residents.accountStatus, "pending_approval")
      )
    )
    .returning();

  if (!updated) return null;

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId: id,
    title:
      decision === "approved"
        ? "You're approved — welcome"
        : "Registration not approved",
    body:
      decision === "approved"
        ? "Your registration has been approved. Sign in with your mobile number to get started."
        : `Your registration wasn't approved. ${note ?? "Please contact the hostel office."}`,
    kind: decision === "approved" ? "success" : "danger",
    href: null,
    read: false,
  });

  return getRegistration(id).then((r) => r ?? null);
}
