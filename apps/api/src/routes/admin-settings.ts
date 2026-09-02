import { Router } from "express";
import { GEOFENCE_LIMITS, type UpdateGeofenceBody } from "@proj/shared";
import { HttpError } from "../http-error";
import { adminOf } from "../admin-auth";
import * as settings from "../data/admin-settings";

export const adminSettingsRouter: Router = Router();

function requireNumber(
  value: unknown,
  field: string,
  { min, max }: { min: number; max: number }
): number {
  // Number inputs post empty strings when cleared; treat that as "missing"
  // rather than letting Number("") coerce it to a silent 0.
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw HttpError.badRequest(`${field} is required.`);
  }
  if (value < min || value > max) {
    throw HttpError.badRequest(`${field} must be between ${min} and ${max}.`);
  }
  return value;
}

adminSettingsRouter.get("/settings/geofence", async (_req, res) => {
  res.json(await settings.getGeofence());
});

adminSettingsRouter.put("/settings/geofence", async (req, res) => {
  const body = req.body as Partial<UpdateGeofenceBody>;

  const label =
    typeof body.locationLabel === "string" ? body.locationLabel.trim() : "";
  if (label.length === 0) {
    throw HttpError.badRequest("Give the location a name residents will read.");
  }

  const saved = await settings.saveGeofence(
    {
      latitude: requireNumber(body.latitude, "Latitude", GEOFENCE_LIMITS.latitude),
      longitude: requireNumber(
        body.longitude,
        "Longitude",
        GEOFENCE_LIMITS.longitude
      ),
      radiusMetres: Math.round(
        requireNumber(body.radiusMetres, "Radius", GEOFENCE_LIMITS.radiusMetres)
      ),
      locationLabel: label,
    },
    adminOf(req).name
  );

  res.json(saved);
});
