import { eq } from "drizzle-orm";
import {
  DEFAULT_GEOFENCE,
  type AttendanceGeofence,
  type UpdateGeofenceBody,
} from "@proj/shared";
import { db } from "../db/client";
import * as t from "../db/schema";

/** This deployment serves one property, so settings live under one fixed key. */
const SETTINGS_ID = "default";

/**
 * Falls back to the shipped defaults when the row is missing, so attendance
 * keeps working on a database that hasn't been seeded yet. A missing geofence
 * should never be the reason nobody can mark in.
 */
export async function getGeofence(): Promise<AttendanceGeofence> {
  const [row] = await db
    .select()
    .from(t.siteSettings)
    .where(eq(t.siteSettings.id, SETTINGS_ID))
    .limit(1);

  if (!row) return { ...DEFAULT_GEOFENCE, updatedAt: null, updatedBy: null };

  return {
    latitude: row.geofenceLatitude,
    longitude: row.geofenceLongitude,
    radiusMetres: row.geofenceRadiusMetres,
    locationLabel: row.geofenceLabel,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function saveGeofence(
  body: UpdateGeofenceBody,
  updatedBy: string
): Promise<AttendanceGeofence> {
  const values = {
    geofenceLatitude: body.latitude,
    geofenceLongitude: body.longitude,
    geofenceRadiusMetres: body.radiusMetres,
    geofenceLabel: body.locationLabel,
    updatedAt: new Date(),
    updatedBy,
  };

  // Upsert rather than update: the row is absent on a database that predates
  // this table, and the first save should create it rather than silently no-op.
  await db
    .insert(t.siteSettings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({ target: t.siteSettings.id, set: values });

  return getGeofence();
}
