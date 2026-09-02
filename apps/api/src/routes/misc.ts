import { Router } from "express";
import {
  MESS_PASS_ROTATE_SECONDS,
  type MessPass,
  type ServiceRequestKind,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import { issueMessPass } from "../mess-pass";
import * as db from "../data/db";

/**
 * Mess entry is recorded by the counter, not by the resident — see the admin
 * scan route. All a resident's phone does here is display a rotating pass.
 */
export const messRouter: Router = Router();

messRouter.get("/entry", async (req, res) => {
  res.json(await db.listMessEntries(residentIdOf(req)));
});

messRouter.get("/pass", (req, res) => {
  const pass = issueMessPass(residentIdOf(req));
  const body: MessPass = {
    token: pass.token,
    expiresAt: pass.expiresAt.toISOString(),
    rotateSeconds: MESS_PASS_ROTATE_SECONDS,
  };
  res.json(body);
});

/** One combined feed so "All requests" doesn't need four round-trips. */
export const requestsRouter: Router = Router();

const KINDS: ServiceRequestKind[] = [
  "maintenance",
  "laundry",
  "complaint",
  "visit",
];

requestsRouter.get("/", async (req, res) => {
  const raw = typeof req.query.kind === "string" ? req.query.kind : null;

  if (raw !== null && !KINDS.includes(raw as ServiceRequestKind)) {
    throw HttpError.badRequest(`"${raw}" is not a kind of request.`);
  }

  res.json(
    await db.listAllRequests(
      residentIdOf(req),
      raw === null ? undefined : (raw as ServiceRequestKind)
    )
  );
});

export const notificationsRouter: Router = Router();

notificationsRouter.get("/", async (req, res) => {
  res.json(await db.listNotifications(residentIdOf(req)));
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const updated = await db.markNotificationRead(
    residentIdOf(req),
    req.params.id
  );
  if (!updated) throw HttpError.notFound("Notification not found.");
  res.json(updated);
});
