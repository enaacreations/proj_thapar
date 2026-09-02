import { createHash } from "node:crypto";
import { HttpError } from "../http-error";
import { env } from "../env";
import type * as FaceApi from "@vladmandic/face-api";
import { getFaceRuntime, loadFaceModels } from "./models";

/**
 * Face checks for attendance.
 *
 * This has to run on the server. The phone is under the resident's control, so
 * a check done in the app is a check that can be skipped — the API must be the
 * thing that decides whether a photo is really the resident's face.
 *
 * Two separate questions get answered here, and both matter:
 *   1. Is there a genuine, well-framed, single human face in this photo?
 *      (Without this, a photo of a sofa marks attendance.)
 *   2. Is it the face this resident enrolled with?
 *      (Without this, a roommate's face marks attendance.)
 */

/** A face must be at least this confident to count. */
const MIN_DETECTION_SCORE = 0.7;

/**
 * Face width as a fraction of the frame's shorter side. A selfie taken at
 * arm's length clears this easily; a face on a poster or a screen across the
 * room does not.
 */
const MIN_FACE_RATIO = 0.18;

const MIN_IMAGE_SIDE = 200;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface FaceSample {
  /** 128 floats. Not reversible into an image — safe to store. */
  descriptor: number[];
  score: number;
  /**
   * 68-point geometry and expression scores for the same face. Enrolment
   * ignores both; the liveness challenge is built out of them.
   */
  landmarks: FaceApi.FaceLandmarks68;
  expressions: FaceApi.FaceExpressions;
  /**
   * SHA-256 of the decoded image bytes, so two frames that are byte-identical
   * can be spotted without keeping the images around.
   */
  imageDigest: string;
}

function faceError(code: string, message: string): HttpError {
  return new HttpError(400, code, message);
}

function decodeBase64Image(base64: string): Buffer {
  // Accepts both a bare base64 payload and a "data:image/jpeg;base64,…" URL.
  const payload = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const buffer = Buffer.from(payload, "base64");

  if (buffer.length === 0) {
    throw faceError("face_bad_image", "That photo didn't come through. Try again.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw faceError(
      "face_bad_image",
      "That photo is too large. Try again with a normal camera shot."
    );
  }
  return buffer;
}

/**
 * tfjs holds a single global backend, so overlapping detections would compete
 * for it and for the whole CPU. Attendance is bursty (everyone marks at once),
 * so requests queue here instead of thrashing.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  // Keep the chain alive even when a caller's work rejects.
  queue = next.catch(() => undefined);
  return next;
}

/**
 * Finds the single face in `base64` and returns its descriptor, or throws an
 * HttpError explaining what the resident should do differently.
 */
export async function describeFace(base64: string): Promise<FaceSample> {
  const buffer = decodeBase64Image(base64);

  try {
    await loadFaceModels();
  } catch (err) {
    console.error("face models failed to load", err);
    throw new HttpError(
      503,
      "face_unavailable",
      "Face check isn't available right now. Use your fingerprint instead."
    );
  }

  return serialise(async () => {
    const { faceapi, tf } = await getFaceRuntime();
    let image: import("@tensorflow/tfjs-node").Tensor3D;
    try {
      image = tf.node.decodeImage(buffer, 3) as import("@tensorflow/tfjs-node").Tensor3D;
    } catch {
      throw faceError(
        "face_bad_image",
        "We couldn't read that photo. Take it again."
      );
    }

    try {
      const [height, width] = image.shape;
      if (Math.min(width, height) < MIN_IMAGE_SIDE) {
        throw faceError(
          "face_bad_image",
          "That photo is too small to check. Take it again."
        );
      }

      const faces = await faceapi
        .detectAllFaces(
          image as unknown as FaceApi.TNetInput,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
        )
        .withFaceLandmarks()
        .withFaceExpressions()
        .withFaceDescriptors();

      if (faces.length === 0) {
        throw faceError(
          "face_not_detected",
          "We couldn't find a face in that photo. Hold the phone up to your face, in good light, and try again."
        );
      }
      if (faces.length > 1) {
        throw faceError(
          "face_multiple",
          "We found more than one face. Make sure it's just you in the shot."
        );
      }

      const face = faces[0]!;
      const { score, box } = face.detection;

      // Framing is checked before confidence: a face lost in the frame fails
      // both, and "you're too far away" tells the resident what to change.
      if (box.width / Math.min(width, height) < MIN_FACE_RATIO) {
        throw faceError(
          "face_too_far",
          "You're too far from the camera. Hold the phone at arm's length and try again."
        );
      }
      if (score < MIN_DETECTION_SCORE) {
        throw faceError(
          "face_low_quality",
          "That photo wasn't clear enough. Find better light, hold still and try again."
        );
      }

      return {
        descriptor: Array.from(face.descriptor),
        score,
        landmarks: face.landmarks,
        expressions: face.expressions,
        imageDigest: createHash("sha256").update(buffer).digest("hex"),
      };
    } finally {
      image.dispose();
    }
  });
}

/** Lower is more similar; identical photos score 0. */
export function faceDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function facesMatch(a: number[], b: number[]): boolean {
  return faceDistance(a, b) <= env.faceMatchThreshold;
}
