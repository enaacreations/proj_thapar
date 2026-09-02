import { Router } from "express";
import {
  type MealType,
  type MessScanResult,
  type ScanMessPassBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { verifyMessPass } from "../mess-pass";
import { placeAgainstFence } from "../geofence";
import * as db from "../data/db";

export const adminMessRouter: Router = Router();

/** Whichever meal is being served now, so the counter never picks from a list. */
function currentMeal(at = new Date()): MealType {
  const hour = at.getHours();
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snacks";
  return "dinner";
}

/**
 * The counter redeems a resident's pass. This is the only way a mess entry is
 * created: the request is authenticated as an admin, so the record attests that
 * a member of staff scanned a live pass, not that a phone claimed to be present.
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
    const fence = await placeAgainstFence({ latitude, longitude });
    place = {
      latitude,
      longitude,
      withinGeofence: fence.withinGeofence,
      locationLabel: fence.locationLabel,
    };
  }

  const meal = currentMeal();
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
