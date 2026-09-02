import { Router } from "express";
import {
  MESS_PASS_ROTATE_SECONDS,
  SELF_MESS_ENTRY_METHODS,
  mealBeingServed,
  type MessEntryResult,
  type MessPass,
  type RecordMessEntryBody,
  type SelfMessEntryMethod,
  type ServiceRequestKind,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import { issueMessPass } from "../mess-pass";
import { verifyEnrolledFace, type FaceCheckWording } from "../face/verify";
import { issueLivenessChallenge } from "../face/liveness";
import { placeAgainstFence } from "../geofence";
import * as db from "../data/db";

/**
 * A resident's own mess routes: the rotating pass the counter scans, and the
 * two ways they can record an entry without a counter scanning them at all.
 */
export const messRouter: Router = Router();

const FACE_WORDING: FaceCheckWording = {
  purpose: "collect your meal",
  notEnrolled:
    "Set up the face check in your profile before using your face at the mess.",
  mismatch:
    "That doesn't look like you. A meal has to be collected by the resident themselves.",
  restart: "Start your mess entry again.",
};

messRouter.get("/entry", async (req, res) => {
  res.json(await db.listMessEntries(residentIdOf(req)));
});

/**
 * Hands out the action the resident has to perform for a facial entry. Asked
 * for at the start of the attempt, so the resident learns what to do at the
 * same moment a spoofer would.
 */
messRouter.get("/liveness", (req, res) => {
  res.json(issueLivenessChallenge(residentIdOf(req)));
});

/**
 * Records an entry the resident took themselves, by face or by the phone's
 * fingerprint sensor. The counter's QR scan is unaffected and remains the
 * strongest of the three: a member of staff attests to it.
 *
 * Because nobody at the mess is attesting to this one, the fence is *enforced*
 * here rather than merely recorded. On the counter's route an off-site scan
 * still means a plate was handed over, so refusing it would be the wrong
 * failure; here, an entry from outside the fence is the only thing the check
 * exists to catch.
 */
messRouter.post("/entry", async (req, res) => {
  const body = req.body as Partial<RecordMessEntryBody>;
  const residentId = residentIdOf(req);

  if (
    typeof body.method !== "string" ||
    !SELF_MESS_ENTRY_METHODS.includes(body.method as SelfMessEntryMethod)
  ) {
    throw HttpError.badRequest("Choose face or fingerprint to record a meal.");
  }
  if (
    typeof body.latitude !== "number" ||
    !Number.isFinite(body.latitude) ||
    typeof body.longitude !== "number" ||
    !Number.isFinite(body.longitude)
  ) {
    throw HttpError.badRequest(
      "We need your location to record a meal. Please allow location access."
    );
  }

  const method = body.method as SelfMessEntryMethod;
  const meal = mealBeingServed();

  // Checked before the face work, which takes seconds — a resident who already
  // ate shouldn't be made to pose for two photos to be told so.
  const already = await db.messEntryToday(residentId, meal);
  if (already) {
    const result: MessEntryResult = { entry: already, recorded: false };
    res.json(result);
    return;
  }

  /**
   * The fence is placed first, and refused on, so a resident whose location is
   * wrong finds out before being asked for photos rather than after.
   */
  const fence = await placeAgainstFence(
    { latitude: body.latitude, longitude: body.longitude },
    "mess"
  );

  if (!fence.withinGeofence) {
    throw new HttpError(
      403,
      "outside_geofence",
      `You need to be at the mess to record a meal — you're ${fence.locationLabel}. Ask the counter to scan your pass instead.`
    );
  }

  /**
   * Nothing is verified server-side for "biometric": the fingerprint is checked
   * by the phone's own sensor and never leaves it, so all the API learns is
   * that an app said it passed. It is kept because it's the honest fallback for
   * a resident whose face won't enrol or won't match in a dim servery, and
   * because the fence — which the API does check — still has to hold.
   */
  if (method === "facial") {
    await verifyEnrolledFace(residentId, body, FACE_WORDING);
  }

  const { entry, recorded } = await db.createMessEntry(residentId, meal, method, {
    latitude: body.latitude,
    longitude: body.longitude,
    withinGeofence: fence.withinGeofence,
    locationLabel: fence.locationLabel,
  });

  const result: MessEntryResult = { entry, recorded };
  res.status(recorded ? 201 : 200).json(result);
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
