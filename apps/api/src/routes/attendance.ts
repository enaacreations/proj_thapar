import { Router } from "express";
import type { AttendanceMethod, MarkAttendanceBody } from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import * as db from "../data/db";
import { storeAttendancePhoto } from "../data/attendance-photos";
import { describeFace, faceDistance } from "../face";
import {
  assertLive,
  issueLivenessChallenge,
  readLivenessChallenge,
} from "../face/liveness";
import { placeAgainstFence } from "../geofence";
import { env } from "../env";

export const attendanceRouter: Router = Router();

const METHODS: AttendanceMethod[] = ["facial", "biometric", "qr"];

attendanceRouter.get("/", async (req, res) => {
  res.json(await db.getAttendanceSummary(residentIdOf(req)));
});

/**
 * Hands out the action the resident has to perform for a facial mark. Asked
 * for at the start of the attempt, so the resident learns what to do at the
 * same moment a spoofer would.
 */
attendanceRouter.get("/liveness", (req, res) => {
  res.json(issueLivenessChallenge(residentIdOf(req)));
});

attendanceRouter.post("/mark", async (req, res) => {
  const body = req.body as Partial<MarkAttendanceBody>;
  const residentId = residentIdOf(req);

  if (
    typeof body.method !== "string" ||
    !METHODS.includes(body.method as AttendanceMethod)
  ) {
    throw HttpError.badRequest("Choose face, fingerprint or QR to mark.");
  }
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    throw HttpError.badRequest(
      "We need your location to mark attendance. Please allow location access."
    );
  }

  if (await db.hasMarkedToday(residentId)) {
    throw HttpError.badRequest("You've already marked attendance today.");
  }

  const method = body.method as AttendanceMethod;

  /**
   * The facial method is only worth anything if the server checks the photos.
   * It used to accept whatever image URI the phone sent and store it unopened,
   * so a picture of a sofa marked attendance just as well as a face.
   *
   * Three things have to hold now, and each covers a different way of cheating:
   *   1. Each photo holds one clear, well-framed face — not a sofa, not a crowd.
   *   2. That face is the one this resident enrolled with — not their roommate.
   *   3. The pair satisfies a challenge issued seconds earlier — not a photo
   *      of the resident held up to the camera.
   */
  let faceMatchDistance: number | null = null;
  let facePhoto: Buffer | null = null;

  if (method === "facial") {
    if (typeof body.photoBase64 !== "string" || body.photoBase64.length === 0) {
      throw HttpError.badRequest(
        "Take a photo of your face to mark attendance."
      );
    }
    if (
      typeof body.livenessToken !== "string" ||
      typeof body.livenessPhotoBase64 !== "string" ||
      body.livenessPhotoBase64.length === 0
    ) {
      // A distinct code so an app that predates the check tells the resident
      // to update rather than showing a raw validation message.
      throw new HttpError(
        400,
        "liveness_required",
        "This version of the app can't complete the face check. Update it, then mark attendance."
      );
    }

    const resident = await db.getResident(residentId);
    if (!resident) throw HttpError.notFound("Resident not found.");

    const enrolled = resident.faceDescriptor;
    if (!enrolled || enrolled.length === 0) {
      throw new HttpError(
        400,
        "face_not_enrolled",
        "Set up the face check in your profile before marking attendance with your face."
      );
    }

    // Read the challenge before spending time on the models: an expired token
    // is the cheapest thing to reject.
    const action = readLivenessChallenge(body.livenessToken, residentId);

    // Each throws with a specific reason when there is no face, several faces,
    // or the shot is too poor or too distant to judge. Serialised inside the
    // face module, so awaiting them one at a time costs nothing.
    const neutral = await describeFace(body.photoBase64);
    const challenge = await describeFace(body.livenessPhotoBase64);

    faceMatchDistance = faceDistance(enrolled, neutral.descriptor);

    // Both frames have to be the resident. Checking only the first would let
    // someone pose for the identity shot and hand the phone over for the
    // second, which is the whole point of the second one.
    if (
      faceMatchDistance > env.faceMatchThreshold ||
      faceDistance(enrolled, challenge.descriptor) > env.faceMatchThreshold
    ) {
      throw new HttpError(
        403,
        "face_mismatch",
        "That doesn't look like you. Attendance has to be marked by the resident themselves."
      );
    }

    assertLive(action, neutral, challenge);

    facePhoto = Buffer.from(
      body.photoBase64.includes(",")
        ? body.photoBase64.slice(body.photoBase64.indexOf(",") + 1)
        : body.photoBase64,
      "base64"
    );
  }

  // Every method is placed against the fence — a fingerprint or a QR scan
  // proves who marked, never where they were.
  const { withinGeofence, locationLabel } = await placeAgainstFence({
    latitude: body.latitude,
    longitude: body.longitude,
  });

  const attendanceId = await db.markAttendance(residentId, {
    method,
    latitude: body.latitude,
    longitude: body.longitude,
    locationLabel,
    photoUri: null,
    withinGeofence,
    faceMatchDistance,
  });

  // Keep the verified selfie against the record so a disputed mark can be
  // reviewed. Written after the insert so it lands under the record's own id.
  if (facePhoto) {
    const reference = await storeAttendancePhoto(attendanceId, facePhoto);
    if (reference) await db.setAttendancePhotoUri(attendanceId, reference);
  }

  res.status(201).json(await db.getAttendanceSummary(residentId));
});
