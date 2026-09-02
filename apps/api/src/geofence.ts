import type { GeofenceKind } from "@proj/shared";
import { getGeofence } from "./data/admin-settings";

/**
 * Where a captured point sits relative to one of the site's fences.
 *
 * Which fence is never implicit: "hostel" is the wide circle attendance is
 * measured against, "mess" the tight one a self-recorded meal is refused
 * outside of. Passing the kind at every call site is deliberate — a default
 * here is how the mess would quietly end up gated on the hostel's radius.
 *
 * The fence is read per-capture rather than cached: an admin moving it should
 * take effect on the next scan, not on the next API restart.
 */

export interface Point {
  latitude: number;
  longitude: number;
}

export interface FencePlacement {
  withinGeofence: boolean;
  distanceMetres: number;
  /** The site's name when inside, or how far outside it when not. */
  locationLabel: string;
}

/** Great-circle distance. Accurate to well under a metre at hostel distances. */
export function metresBetween(a: Point, b: Point): number {
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

/**
 * What the "…m from X" label calls each fence when a point falls outside it.
 * The resident's own name for the place, not the configured label, which is a
 * site name like "Thapar, Block B" and reads oddly after "300 m from".
 */
const OUTSIDE_NOUN: Record<GeofenceKind, string> = {
  hostel: "hostel",
  mess: "the mess",
};

export async function placeAgainstFence(
  point: Point,
  kind: GeofenceKind
): Promise<FencePlacement> {
  const fence = await getGeofence(kind);
  const distanceMetres = metresBetween(fence, point);
  const withinGeofence = distanceMetres <= fence.radiusMetres;

  return {
    withinGeofence,
    distanceMetres,
    locationLabel: withinGeofence
      ? fence.locationLabel
      : `${Math.round(distanceMetres)} m from ${OUTSIDE_NOUN[kind]}`,
  };
}
