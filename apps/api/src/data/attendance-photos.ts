import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../env";

/**
 * Keeps the selfie behind each facial mark so a disputed attendance can be
 * looked at later — the whole point of a photo-backed check is being able to
 * go back and see who actually stood in front of the camera.
 *
 * These are photos of residents' faces, so they are deliberately *not* served
 * over a static route: nothing hands them out without an authenticated caller
 * asking for a specific record.
 */

const SUBDIR = "attendance";

/** Returns the stored reference to put on the record, or null if the write failed. */
export async function storeAttendancePhoto(
  attendanceId: string,
  image: Buffer
): Promise<string | null> {
  const dir = join(env.uploadsDir, SUBDIR);
  const name = `${attendanceId}.jpg`;

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), image);
    return `${SUBDIR}/${name}`;
  } catch (err) {
    // The mark itself already passed the face check; losing the audit copy
    // shouldn't fail the resident's attendance.
    console.error(`could not store attendance photo for ${attendanceId}`, err);
    return null;
  }
}

export function attendancePhotoPath(reference: string): string {
  return join(env.uploadsDir, reference);
}
