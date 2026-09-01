import { Router } from "express";
import {
  MEAL_LABELS,
  type MealType,
  type MessEntryBody,
  type ServiceRequestKind,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import * as db from "../data/db";

/** Mess turnstile: face, fingerprint or QR, then the meal is logged. */
export const messRouter: Router = Router();

messRouter.get("/entry", async (req, res) => {
  res.json(await db.listMessEntries(residentIdOf(req)));
});

messRouter.post("/entry", async (req, res) => {
  const body = req.body as Partial<MessEntryBody>;

  if (typeof body.meal !== "string" || !(body.meal in MEAL_LABELS)) {
    throw HttpError.badRequest("Which meal is this entry for?");
  }
  if (
    body.method !== "facial" &&
    body.method !== "biometric" &&
    body.method !== "qr"
  ) {
    throw HttpError.badRequest("Scan your face, fingerprint or the QR code.");
  }

  const created = await db.createMessEntry(
    residentIdOf(req),
    body.meal as MealType,
    body.method
  );
  res.status(201).json(created);
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
