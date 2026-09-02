import { HttpError } from "../http-error";
import { env } from "../env";
import * as db from "../data/db";
import { describeFace, faceDistance } from "./index";
import { assertLive, readLivenessChallenge } from "./liveness";

/**
 * The facial check, shared by attendance and mess entry.
 *
 * Both ask the same question — "is the person holding this phone the resident
 * it belongs to, right now?" — and both are only worth anything because the
 * server answers it. The phone is under the resident's control, so a check the
 * app performs is a check the app can be made to skip.
 *
 * Three things have to hold, and each covers a different way of cheating:
 *   1. Each photo holds one clear, well-framed face — not a sofa, not a crowd.
 *   2. That face is the one this resident enrolled with — not their roommate.
 *   3. The pair satisfies a challenge issued seconds earlier — not a photo of
 *      the resident held up to the camera.
 */

/**
 * The parts of the refusal text that differ between callers. Kept as strings
 * rather than derived from a noun, because "mark attendance" and "collect your
 * meal" don't decline the same way and half-generated English reads worse than
 * either.
 */
export interface FaceCheckWording {
  /** Completes "Take a photo of your face to …" and "Update it, then …". */
  purpose: string;
  /** Sent with `face_not_enrolled`. */
  notEnrolled: string;
  /** Sent with `face_mismatch`. */
  mismatch: string;
  /** Completes "That check timed out. …". */
  restart: string;
}

/** The three fields a facial request carries, before they've been validated. */
export interface FaceProof {
  photoBase64?: unknown;
  livenessToken?: unknown;
  livenessPhotoBase64?: unknown;
}

export interface VerifiedFace {
  /** Distance from the enrolled descriptor to the identity frame. */
  faceMatchDistance: number;
  /** The decoded identity frame, for callers that keep it against the record. */
  photo: Buffer;
}

function decodeBase64(base64: string): Buffer {
  return Buffer.from(
    base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64,
    "base64"
  );
}

/**
 * Verifies a two-frame facial submission against the resident's enrolled face,
 * or throws an HttpError the resident can act on. Returns the match distance
 * to store on the record, and the identity frame for callers that keep it.
 */
export async function verifyEnrolledFace(
  residentId: string,
  proof: FaceProof,
  wording: FaceCheckWording
): Promise<VerifiedFace> {
  if (typeof proof.photoBase64 !== "string" || proof.photoBase64.length === 0) {
    throw HttpError.badRequest(
      `Take a photo of your face to ${wording.purpose}.`
    );
  }
  if (
    typeof proof.livenessToken !== "string" ||
    typeof proof.livenessPhotoBase64 !== "string" ||
    proof.livenessPhotoBase64.length === 0
  ) {
    // A distinct code so an app that predates the check tells the resident to
    // update rather than showing a raw validation message.
    throw new HttpError(
      400,
      "liveness_required",
      `This version of the app can't complete the face check. Update it, then ${wording.purpose}.`
    );
  }

  const resident = await db.getResident(residentId);
  if (!resident) throw HttpError.notFound("Resident not found.");

  const enrolled = resident.faceDescriptor;
  if (!enrolled || enrolled.length === 0) {
    throw new HttpError(400, "face_not_enrolled", wording.notEnrolled);
  }

  // Read the challenge before spending time on the models: an expired token is
  // the cheapest thing to reject.
  const action = readLivenessChallenge(
    proof.livenessToken,
    residentId,
    wording.restart
  );

  // Each throws with a specific reason when there is no face, several faces, or
  // the shot is too poor or too distant to judge. Serialised inside the face
  // module, so awaiting them one at a time costs nothing.
  const neutral = await describeFace(proof.photoBase64);
  const challenge = await describeFace(proof.livenessPhotoBase64);

  const faceMatchDistance = faceDistance(enrolled, neutral.descriptor);

  // Both frames have to be the resident. Checking only the first would let
  // someone pose for the identity shot and hand the phone over for the second,
  // which is the whole point of the second one.
  if (
    faceMatchDistance > env.faceMatchThreshold ||
    faceDistance(enrolled, challenge.descriptor) > env.faceMatchThreshold
  ) {
    throw new HttpError(403, "face_mismatch", wording.mismatch);
  }

  assertLive(action, neutral, challenge);

  return { faceMatchDistance, photo: decodeBase64(proof.photoBase64) };
}
