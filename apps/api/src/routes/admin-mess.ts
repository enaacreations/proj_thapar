import { Router } from "express";
import {
  type MealType,
  type MessScanResult,
  type ScanMessPassBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { verifyMessPass } from "../mess-pass";
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
  const { token } = req.body as Partial<ScanMessPassBody>;

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

  const meal = currentMeal();
  const [{ entry, recorded }, roomNumber] = await Promise.all([
    db.createMessEntry(residentId, meal, "qr"),
    db.roomNumberOf(residentId),
  ]);

  const result: MessScanResult = {
    residentId,
    residentName: resident.fullName,
    roomNumber,
    meal,
    enteredAt: entry.enteredAt,
    recorded,
  };

  res.status(recorded ? 201 : 200).json(result);
});
