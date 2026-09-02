import { Router } from "express";
import type { AttendanceMethod, MarkAttendanceBody } from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import * as db from "../data/db";
import { storeAttendancePhoto } from "../data/attendance-photos";
import { verifyEnrolledFace, type FaceCheckWording } from "../face/verify";
import { issueLivenessChallenge } from "../face/liveness";
import { placeAgainstFence } from "../geofence";

export const attendanceRouter: Router = Router();

const METHODS: AttendanceMethod[] = ["facial", "biometric", "qr"];

const FACE_WORDING: FaceCheckWording = {
  purpose: "mark attendance",
  notEnrolled:
    "Set up the face check in your profile before marking attendance with your face.",
  mismatch:
    "That doesn't look like you. Attendance has to be marked by the resident themselves.",
  restart: "Start marking attendance again.",
};

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
   * so a picture of a sofa marked attendance just as well as a face. What the
   * check consists of now lives in the face module, which mess entry shares.
   */
  let faceMatchDistance: number | null = null;
  let facePhoto: Buffer | null = null;

  if (method === "facial") {
    const verified = await verifyEnrolledFace(residentId, body, FACE_WORDING);
    faceMatchDistance = verified.faceMatchDistance;
    facePhoto = verified.photo;
  }

  // Every method is placed against the fence — a fingerprint or a QR scan
  // proves who marked, never where they were.
  const { withinGeofence, locationLabel } = await placeAgainstFence(
    { latitude: body.latitude, longitude: body.longitude },
    "hostel"
  );

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
