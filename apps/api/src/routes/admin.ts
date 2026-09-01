import { Router } from "express";
import { eq } from "drizzle-orm";
import type {
  AdminLoginBody,
  AdminSession,
  ResidentAccountStatus,
  ReviewDecisionBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import {
  adminOf,
  createAdminSession,
  destroyAdminSession,
  requireAdmin,
  verifyPassword,
} from "../admin-auth";
import { db } from "../db/client";
import * as t from "../db/schema";
import * as admin from "../data/admin";

export const adminRouter: Router = Router();

/* ------------------------------------------------------------------- auth */

adminRouter.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as Partial<AdminLoginBody>;

  if (typeof email !== "string" || typeof password !== "string") {
    throw HttpError.badRequest("Enter your email and password.");
  }

  const [user] = await db
    .select()
    .from(t.adminUsers)
    .where(eq(t.adminUsers.email, email.trim().toLowerCase()))
    .limit(1);

  // Same message either way so the form can't be used to discover valid emails.
  const invalid = new HttpError(
    401,
    "invalid_credentials",
    "That email and password don't match."
  );

  if (!user || !user.active) throw invalid;
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid;

  const { token, expiresAt } = await createAdminSession(user.id);

  const session: AdminSession = {
    token,
    admin: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    expiresAt: expiresAt.toISOString(),
  };
  res.json(session);
});

adminRouter.post("/auth/logout", requireAdmin, async (req, res) => {
  if (req.adminToken) await destroyAdminSession(req.adminToken);
  res.status(204).end();
});

adminRouter.get("/auth/me", requireAdmin, (req, res) => {
  res.json(adminOf(req));
});

/* --------------------------------------------------------- registrations */

/** Express 5 types multi-segment path params loosely; narrow once here. */
function pathId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.badRequest("Missing registration id.");
  }
  return value;
}

const STATUSES: ResidentAccountStatus[] = [
  "pending_approval",
  "approved",
  "rejected",
];

adminRouter.get("/registrations/counts", requireAdmin, async (_req, res) => {
  res.json(await admin.countsByStatus());
});

adminRouter.get("/registrations", requireAdmin, async (req, res) => {
  const raw = typeof req.query.status === "string" ? req.query.status : null;

  if (raw !== null && !STATUSES.includes(raw as ResidentAccountStatus)) {
    throw HttpError.badRequest(`"${raw}" is not a registration status.`);
  }

  res.json(
    await admin.listRegistrations(
      raw === null ? undefined : (raw as ResidentAccountStatus)
    )
  );
});

adminRouter.get("/registrations/:id", requireAdmin, async (req, res) => {
  const found = await admin.getRegistration(pathId(req.params.id));
  if (!found) throw HttpError.notFound("We couldn't find that registration.");
  res.json(found);
});

adminRouter.post("/registrations/:id/approve", requireAdmin, async (req, res) => {
  const { note } = req.body as Partial<ReviewDecisionBody>;
  const reviewer = adminOf(req);

  const id = pathId(req.params.id);
  const updated = await admin.decideRegistration(
    id,
    "approved",
    reviewer,
    typeof note === "string" && note.trim() ? note.trim() : null
  );

  if (!updated) throw alreadyDecidedOrMissing(id);
  res.json(updated);
});

adminRouter.post("/registrations/:id/reject", requireAdmin, async (req, res) => {
  const { note } = req.body as Partial<ReviewDecisionBody>;
  const reviewer = adminOf(req);

  // The resident is shown this, so a reason is required rather than optional.
  if (typeof note !== "string" || note.trim().length < 5) {
    throw HttpError.badRequest(
      "Give a short reason for rejecting. The resident sees this."
    );
  }

  const id = pathId(req.params.id);
  const updated = await admin.decideRegistration(
    id,
    "rejected",
    reviewer,
    note.trim()
  );

  if (!updated) throw alreadyDecidedOrMissing(id);
  res.json(updated);
});

/** Distinguishes "never existed" from "someone already decided it". */
function alreadyDecidedOrMissing(id: string): HttpError {
  return new HttpError(
    409,
    "already_decided",
    `Registration ${id} isn't pending any more — someone may have just reviewed it. Refresh to see the current status.`
  );
}
