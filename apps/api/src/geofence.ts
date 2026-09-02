import { getGeofence } from "./data/admin-settings";

/**
 * Where a captured point sits relative to the site fence.
 *
 * Attendance and the mess counter both need this, and both read the fence
 * per-capture rather than caching it: an admin moving the fence should take
 * effect on the next scan, not on the next API restart.
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

export async function placeAgainstFence(point: Point): Promise<FencePlacement> {
  const fence = await getGeofence();
  const distanceMetres = metresBetween(fence, point);
  const withinGeofence = distanceMetres <= fence.radiusMetres;

  return {
    withinGeofence,
    distanceMetres,
    locationLabel: withinGeofence
      ? fence.locationLabel
      : `${Math.round(distanceMetres)} m from hostel`,
  };
}
