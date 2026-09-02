import { eq } from "drizzle-orm";
import {
  DEFAULT_GEOFENCE,
  type GeofenceKind,
  type SiteGeofence,
  type SiteGeofences,
  type UpdateGeofenceBody,
} from "@proj/shared";
import { db } from "../db/client";
import * as t from "../db/schema";

/** This deployment serves one property, so settings live under one fixed key. */
const SETTINGS_ID = "default";

type Row = typeof t.siteSettings.$inferSelect;

/**
 * The wide circle attendance is measured against. Falls back to the shipped
 * defaults when the row is missing, so attendance keeps working on a database
 * that hasn't been seeded yet — a missing geofence should never be the reason
 * nobody can mark in.
 */
function hostelFrom(row: Row | undefined): SiteGeofence {
  if (!row) {
    return {
      ...DEFAULT_GEOFENCE,
      updatedAt: null,
      updatedBy: null,
      configured: true,
    };
  }

  return {
    latitude: row.geofenceLatitude,
    longitude: row.geofenceLongitude,
    radiusMetres: row.geofenceRadiusMetres,
    locationLabel: row.geofenceLabel,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    configured: true,
  };
}

/**
 * The tight circle a self-recorded mess entry is refused outside of.
 *
 * When no mess fence has been drawn, this borrows the hostel one wholesale and
 * reports `configured: false`. Borrowing the *whole* circle rather than, say,
 * its centre with a tighter radius is the point: an upgraded deployment
 * behaves exactly as it did before anyone knew there were two fences, and the
 * console is what tells the office to go and draw the real one. Guessing a
 * radius here would silently refuse meals to residents standing in the servery.
 */
function messFrom(row: Row | undefined): SiteGeofence {
  const hostel = hostelFrom(row);

  if (
    !row ||
    row.messGeofenceLatitude === null ||
    row.messGeofenceLongitude === null ||
    row.messGeofenceRadiusMetres === null ||
    row.messGeofenceLabel === null
  ) {
    return { ...hostel, updatedAt: null, updatedBy: null, configured: false };
  }

  return {
    latitude: row.messGeofenceLatitude,
    longitude: row.messGeofenceLongitude,
    radiusMetres: row.messGeofenceRadiusMetres,
    locationLabel: row.messGeofenceLabel,
    updatedAt: row.messGeofenceUpdatedAt?.toISOString() ?? null,
    updatedBy: row.messGeofenceUpdatedBy,
    configured: true,
  };
}

async function readRow(): Promise<Row | undefined> {
  const [row] = await db
    .select()
    .from(t.siteSettings)
    .where(eq(t.siteSettings.id, SETTINGS_ID))
    .limit(1);

  return row;
}

export async function getGeofence(kind: GeofenceKind): Promise<SiteGeofence> {
  const row = await readRow();
  return kind === "mess" ? messFrom(row) : hostelFrom(row);
}

export async function getGeofences(): Promise<SiteGeofences> {
  const row = await readRow();
  return { hostel: hostelFrom(row), mess: messFrom(row) };
}

export async function saveGeofence(
  kind: GeofenceKind,
  body: UpdateGeofenceBody,
  updatedBy: string
): Promise<SiteGeofence> {
  const now = new Date();

  const values =
    kind === "mess"
      ? {
          messGeofenceLatitude: body.latitude,
          messGeofenceLongitude: body.longitude,
          messGeofenceRadiusMetres: body.radiusMetres,
          messGeofenceLabel: body.locationLabel,
          messGeofenceUpdatedAt: now,
          messGeofenceUpdatedBy: updatedBy,
        }
      : {
          geofenceLatitude: body.latitude,
          geofenceLongitude: body.longitude,
          geofenceRadiusMetres: body.radiusMetres,
          geofenceLabel: body.locationLabel,
          updatedAt: now,
          updatedBy,
        };

  // Upsert rather than update: the row is absent on a database that predates
  // this table, and the first save should create it rather than silently no-op.
  //
  // Saving the mess fence first would leave the hostel columns with nothing to
  // insert, and they are NOT NULL — so an insert always carries the shipped
  // hostel defaults, which the update branch then leaves alone.
  await db
    .insert(t.siteSettings)
    .values({
      id: SETTINGS_ID,
      geofenceLatitude: DEFAULT_GEOFENCE.latitude,
      geofenceLongitude: DEFAULT_GEOFENCE.longitude,
      geofenceRadiusMetres: DEFAULT_GEOFENCE.radiusMetres,
      geofenceLabel: DEFAULT_GEOFENCE.locationLabel,
      ...values,
    })
    .onConflictDoUpdate({ target: t.siteSettings.id, set: values });

  return getGeofence(kind);
}
