import { Router } from "express";
import {
  mealBeingServed,
  type MessScanResult,
  type ScanMessPassBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { verifyMessPass } from "../mess-pass";
import { placeAgainstFence } from "../geofence";
import * as db from "../data/db";

export const adminMessRouter: Router = Router();

/**
 * The counter redeems a resident's pass. The request is authenticated as an
 * admin, so the record attests that a member of staff scanned a live pass — the
 * strongest of the three ways an entry can be created, and the reason the
 * resident's own face and fingerprint routes don't replace it.
 */
adminMessRouter.post("/mess/scan", async (req, res) => {
  const { token, latitude, longitude } = req.body as Partial<ScanMessPassBody>;

  if (typeof token !== "string" || token.length === 0) {
    throw HttpError.badRequest("Scan the resident's pass.");
  }

  // One message for malformed, expired and forged alike — a scanner shouldn't
  // help someone work out which part of a fake pass to fix.
  const residentId = verifyMessPass(token);
  if (!residentId) {
    throw HttpError.badRequest(
      "That pass didn't work. Ask them to refresh it and try again."
    );
  }

  const resident = await db.getResident(residentId);
  if (!resident) {
    throw HttpError.notFound("That pass isn't linked to a resident any more.");
  }

  /**
   * Where the counter was, when it could tell us. This is recorded and not
   * enforced: a scan from outside the fence still means a plate was handed
   * over, and refusing to serve food because a browser wouldn't give up a GPS
   * fix would be the wrong failure. What it buys is an audit trail — a counter
   * that starts scanning from somewhere it shouldn't is visible afterwards.
   */
  let place = null;
  if (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
  ) {
    // The mess fence, not the hostel one: this is the counter's own device,
    // standing at the servery. Still recorded and never enforced here — see
    // above — so a mess fence nobody has drawn yet can't stop a plate.
    const fence = await placeAgainstFence({ latitude, longitude }, "mess");
    place = {
      latitude,
      longitude,
      withinGeofence: fence.withinGeofence,
      locationLabel: fence.locationLabel,
    };
  }

  const meal = mealBeingServed();
  const [{ entry, recorded }, roomNumber] = await Promise.all([
    db.createMessEntry(residentId, meal, "qr", place),
    db.roomNumberOf(residentId),
  ]);

  const result: MessScanResult = {
    residentId,
    residentName: resident.fullName,
    roomNumber,
    meal,
    enteredAt: entry.enteredAt,
    recorded,
    // From the entry, not from `place` — a repeat scan reports where the
    // *first* one happened, which is the record that actually stands.
    withinGeofence: entry.withinGeofence,
    locationLabel: entry.locationLabel,
  };

  res.status(recorded ? 201 : 200).json(result);
});
