import { Router } from "express";
import {
  GEOFENCE_KINDS,
  GEOFENCE_LIMITS,
  type GeofenceKind,
  type UpdateGeofenceBody,
} from "@proj/shared";
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

/** Both circles at once, so the settings page loads in one round trip. */
adminSettingsRouter.get("/settings/geofences", async (_req, res) => {
  res.json(await settings.getGeofences());
});

adminSettingsRouter.put("/settings/geofence/:kind", async (req, res) => {
  const kind = req.params.kind;
  if (!GEOFENCE_KINDS.includes(kind as GeofenceKind)) {
    throw HttpError.notFound(`There's no "${kind}" geofence to set.`);
  }

  const body = req.body as Partial<UpdateGeofenceBody>;

  const label =
    typeof body.locationLabel === "string" ? body.locationLabel.trim() : "";
  if (label.length === 0) {
    throw HttpError.badRequest("Give the location a name residents will read.");
  }

  const saved = await settings.saveGeofence(
    kind as GeofenceKind,
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
