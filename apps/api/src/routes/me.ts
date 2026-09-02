import { Router } from "express";
import type {
  EnrolFaceBody,
  FaceEnrolmentStatus,
  ResidentProfile,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import * as db from "../data/db";
import { describeFace, facesMatch } from "../face";

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

meRouter.post("/profile/photo", async (req, res) => {
  const uri = req.body?.uri;
  if (typeof uri !== "string" || uri.trim().length === 0) {
    throw HttpError.badRequest("Take a photo first.");
  }
  await db.setPhotoUrl(residentIdOf(req), uri.trim());
  res.json(await profileOf(req));
});

/* ---------------------------------------------------------- face enrolment */

meRouter.get("/face", async (req, res) => {
  const resident = await db.getResident(residentIdOf(req));
  if (!resident) throw HttpError.notFound("Resident not found.");

  const status: FaceEnrolmentStatus = {
    enrolled: (resident.faceDescriptor?.length ?? 0) > 0,
    enrolledAt: resident.faceEnrolledAt
      ? resident.faceEnrolledAt.toISOString()
      : null,
  };
  res.json(status);
});

/**
 * Enrols the face that facial attendance will be checked against.
 *
 * Re-enrolling is allowed — hair, glasses and beards change — but only with a
 * face that still matches the one on file. Letting anyone overwrite this with
 * an arbitrary face would hand them a way to sign someone else's attendance
 * over to themselves, which is exactly what the check exists to stop. A
 * genuine change of face (or a resident locked out by it) goes through the
 * hostel office, which can reset the enrolment.
 */
meRouter.post("/face", async (req, res) => {
  const body = req.body as Partial<EnrolFaceBody>;
  if (typeof body.photoBase64 !== "string" || body.photoBase64.length === 0) {
    throw HttpError.badRequest("Take a photo of your face first.");
  }

  const residentId = residentIdOf(req);
  const resident = await db.getResident(residentId);
  if (!resident) throw HttpError.notFound("Resident not found.");

  const sample = await describeFace(body.photoBase64);
  const existing = resident.faceDescriptor;

  if (existing && existing.length > 0 && !facesMatch(existing, sample.descriptor)) {
    throw new HttpError(
      409,
      "face_already_enrolled",
      "This doesn't look like the face already registered for you. Ask the hostel office to reset your face check."
    );
  }

  await db.setFaceDescriptor(residentId, sample.descriptor);

  const status: FaceEnrolmentStatus = {
    enrolled: true,
    enrolledAt: new Date().toISOString(),
  };
  res.json(status);
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
