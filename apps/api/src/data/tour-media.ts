import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import type {
  TourMediaItem,
  TourMediaKind,
  TourPhoto,
  TourSpace,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { env } from "../env";
import { db } from "../db/client";
import * as t from "../db/schema";

/**
 * Media for the property tour.
 *
 * The tour used to be a list of rooms with `panoramaUri: null` on every one of
 * them, which meant "Look around" showed a grey gradient and a caption saying
 * the photo hadn't been uploaded. There was nowhere to upload one to. This is
 * that missing half: somewhere for the property's photos to live, and a route
 * that hands them to the app.
 */

const SUBDIR = "tours";

/**
 * Where these are served from. Scoped to the tour directory on purpose: the
 * uploads root also holds attendance selfies, which must never be reachable
 * without an authenticated request for a specific record.
 */
export const TOUR_MEDIA_ROUTE = "/media/tours";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function decode(base64: string): Buffer {
  const payload = base64.includes(",")
    ? base64.slice(base64.indexOf(",") + 1)
    : base64;
  const buffer = Buffer.from(payload, "base64");

  if (buffer.length === 0) {
    throw HttpError.badRequest("That image didn't come through. Try again.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw HttpError.badRequest(
      "That image is too large. Panoramas should be under 12 MB."
    );
  }
  return buffer;
}

export function tourMediaDir(): string {
  return join(env.uploadsDir, SUBDIR);
}

function toItem(row: typeof t.tourMedia.$inferSelect): TourMediaItem {
  return {
    id: row.id,
    spaceId: row.spaceId,
    kind: row.kind,
    uri: row.uri,
    caption: row.caption,
    position: row.position,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export async function listTourMedia(): Promise<TourMediaItem[]> {
  const rows = await db
    .select()
    .from(t.tourMedia)
    .orderBy(asc(t.tourMedia.spaceId), asc(t.tourMedia.position));
  return rows.map(toItem);
}

export async function addTourMedia(input: {
  spaceId: string;
  kind: TourMediaKind;
  caption: string;
  imageBase64?: string;
  url?: string;
  uploadedBy: string;
}): Promise<TourMediaItem> {
  const id = `TM-${randomUUID().slice(0, 8)}`;

  let uri: string;
  if (input.url) {
    uri = input.url;
  } else if (input.imageBase64) {
    const image = decode(input.imageBase64);
    const name = `${id}.jpg`;
    await mkdir(tourMediaDir(), { recursive: true });
    await writeFile(join(tourMediaDir(), name), image);
    uri = `${TOUR_MEDIA_ROUTE}/${name}`;
  } else {
    throw HttpError.badRequest("Upload an image, or give a link to one.");
  }

  // New photos go on the end of whatever the space already has.
  const existing = await db
    .select({ position: t.tourMedia.position })
    .from(t.tourMedia)
    .where(eq(t.tourMedia.spaceId, input.spaceId));
  const position = existing.reduce((max, r) => Math.max(max, r.position), -1) + 1;

  const [row] = await db
    .insert(t.tourMedia)
    .values({
      id,
      spaceId: input.spaceId,
      kind: input.kind,
      uri,
      caption: input.caption,
      position,
      uploadedBy: input.uploadedBy,
    })
    .returning();

  return toItem(row as typeof t.tourMedia.$inferSelect);
}

export async function removeTourMedia(id: string): Promise<boolean> {
  const [row] = await db
    .delete(t.tourMedia)
    .where(eq(t.tourMedia.id, id))
    .returning();

  if (!row) return false;

  // Best effort: the row is what the tour reads, so a file left behind is
  // clutter rather than a broken tour.
  if (row.uri.startsWith(`${TOUR_MEDIA_ROUTE}/`)) {
    const name = row.uri.slice(`${TOUR_MEDIA_ROUTE}/`.length);
    await unlink(join(tourMediaDir(), name)).catch(() => undefined);
  }

  return true;
}

/**
 * Lays uploaded media over the fixed list of spaces. Spaces with nothing
 * uploaded come back exactly as before — an empty gallery and a null panorama,
 * which the app already knows how to say out loud.
 */
export async function withTourMedia(
  spaces: readonly Omit<TourSpace, "photos">[]
): Promise<TourSpace[]> {
  const rows = await db
    .select()
    .from(t.tourMedia)
    .orderBy(asc(t.tourMedia.position));

  const photos = new Map<string, TourPhoto[]>();
  const panoramas = new Map<string, string>();

  for (const row of rows) {
    if (row.kind === "panorama") {
      // One panorama per space; the lowest position wins, so re-ordering is
      // how you replace it without deleting the old one first.
      if (!panoramas.has(row.spaceId)) panoramas.set(row.spaceId, row.uri);
      continue;
    }

    const list = photos.get(row.spaceId) ?? [];
    list.push({ id: row.id, uri: row.uri, caption: row.caption });
    photos.set(row.spaceId, list);
  }

  return spaces.map((space) => ({
    ...space,
    panoramaUri: panoramas.get(space.id) ?? space.panoramaUri,
    photos: photos.get(space.id) ?? [],
  }));
}
