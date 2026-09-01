import { Router } from "express";
import type { ResidentProfile } from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import * as db from "../data/db";

export const meRouter: Router = Router();

async function profileOf(
  req: { residentId?: string },
  unmask: { dob?: boolean; kyc?: boolean } = {}
): Promise<ResidentProfile> {
  const resident = await db.getResident(residentIdOf(req));
  if (!resident) throw HttpError.notFound("Resident not found.");
  return db.toProfile(resident, unmask);
}

meRouter.get("/profile", async (req, res) => {
  res.json(await profileOf(req));
});

/** Unmasking is a separate call so full KYC values never ride along by default. */
meRouter.post("/profile/unmask/:field", async (req, res) => {
  const field = req.params.field;
  if (field !== "dob" && field !== "kyc") {
    throw HttpError.badRequest("You can only unmask 'dob' or 'kyc'.");
  }
  res.json(await profileOf(req, { [field]: true }));
});

meRouter.get("/room", async (req, res) => {
  const room = await db.getRoom(residentIdOf(req));
  if (!room) {
    throw HttpError.notFound(
      "No room is allocated to you yet. Please check with the hostel office."
    );
  }
  res.json(room);
});

meRouter.get("/payments", async (req, res) => {
  const payments = await db.getPayments(residentIdOf(req));
  if (!payments) {
    throw HttpError.notFound(
      "No payment plan is set up for you yet. Please check with the hostel office."
    );
  }
  res.json(payments);
});
