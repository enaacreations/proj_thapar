import { Router } from "express";
import type { AttendanceMethod, MarkAttendanceBody } from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import * as db from "../data/db";
import { getGeofence } from "../data/admin-settings";

export const attendanceRouter: Router = Router();

const METHODS: AttendanceMethod[] = ["facial", "biometric", "qr"];

function metresBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

attendanceRouter.get("/", async (req, res) => {
  res.json(await db.getAttendanceSummary(residentIdOf(req)));
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

  // Read per-mark rather than caching: an admin moving the fence should take
  // effect on the next attendance, not on the next API restart.
  const fence = await getGeofence();
  const distance = metresBetween(fence, {
    latitude: body.latitude,
    longitude: body.longitude,
  });
  const withinGeofence = distance <= fence.radiusMetres;

  await db.markAttendance(residentId, {
    method: body.method as AttendanceMethod,
    latitude: body.latitude,
    longitude: body.longitude,
    locationLabel: withinGeofence
      ? fence.locationLabel
      : `${Math.round(distance)} m from hostel`,
    photoUri: body.photoUri ?? null,
    withinGeofence,
  });

  res.status(201).json(await db.getAttendanceSummary(residentId));
});
