import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  LIVENESS_INSTRUCTIONS,
  type LivenessAction,
  type LivenessChallenge,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { env } from "../env";
import type { FaceSample } from "./index";
import type { faceapi } from "./models";

/**
 * Liveness for the facial checks — attendance, and self-recorded mess entry.
 *
 * Matching a face against the enrolled one answers "whose face is this?". It
 * does not answer "is this a face, here, now" — a photo of the resident on
 * someone else's phone matches perfectly. This module is the second question.
 *
 * How it works: the API picks an action at random and signs it into a
 * short-lived token. The resident sends two frames — one looking straight at
 * the camera, one doing what was asked — and the server checks the second
 * differs from the first in exactly the way that action would change a face.
 * The action isn't known until the moment attendance starts, so a print or a
 * saved photo can't be prepared for it.
 *
 * What this does not stop: someone replaying a live video of the resident on a
 * screen and reacting to the prompt. Defeating that needs depth or infrared,
 * which a phone camera and a JPEG upload can't provide. The framing check in
 * `describeFace` raises the bar (a screen held far enough back to look right
 * fails the face-size test), and the photo of every mark is kept so a disputed
 * one can be looked at. Beyond that, this is what a stills pipeline can honestly
 * claim.
 */

const ACTIONS: LivenessAction[] = [
  "smile",
  "open_mouth",
  "close_eyes",
  "turn_head",
];

/**
 * How long a challenge stays valid. Long enough to read the prompt and take
 * two photos without hurrying, short enough that it isn't worth sitting on.
 */
const CHALLENGE_TTL_SECONDS = 180;

/* ------------------------------------------------------------- challenge */

function sign(payload: string): string {
  return createHmac("sha256", env.livenessSecret).update(payload).digest("base64url");
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Mints a challenge for one attendance attempt. Stateless — the token carries
 * its own action and expiry and is signed, so nothing has to be stored or
 * cleaned up when an attempt is abandoned (most are: people open the screen
 * and put the phone down).
 */
export function issueLivenessChallenge(residentId: string): LivenessChallenge {
  const action = ACTIONS[randomBytes(1)[0]! % ACTIONS.length]!;
  const issuedAt = Date.now();
  const nonce = randomBytes(9).toString("base64url");
  const payload = `${residentId}.${action}.${issuedAt}.${nonce}`;

  return {
    token: `${payload}.${sign(payload)}`,
    action,
    instruction: LIVENESS_INSTRUCTIONS[action],
    expiresInSeconds: CHALLENGE_TTL_SECONDS,
  };
}

function challengeError(message: string): HttpError {
  return new HttpError(400, "liveness_failed", message);
}

/**
 * Returns the action a token was issued for, or throws. A token minted for
 * someone else is treated the same as an expired one — there's nothing useful
 * to tell apart.
 *
 * `restart` completes "That check timed out. …", so the resident is told to
 * start the thing they were actually doing again.
 */
export function readLivenessChallenge(
  token: string,
  residentId: string,
  restart: string
): LivenessAction {
  const stale = challengeError(`That check timed out. ${restart}`);

  const parts = token.split(".");
  if (parts.length !== 5) throw stale;

  const [owner, action, issuedAtRaw, nonce, signature] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  if (!equals(signature, sign(`${owner}.${action}.${issuedAtRaw}.${nonce}`))) {
    throw stale;
  }
  if (owner !== residentId) throw stale;
  if (!ACTIONS.includes(action as LivenessAction)) throw stale;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) throw stale;
  if (Date.now() - issuedAt > CHALLENGE_TTL_SECONDS * 1000) throw stale;
  // A token dated in the future is a forgery attempt or a badly wrong clock.
  if (issuedAt > Date.now() + 60_000) throw stale;

  return action as LivenessAction;
}

/* -------------------------------------------------------------- geometry */

type Point = { x: number; y: number };

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Eye aspect ratio: eye height over eye width. Around 0.3 for an open eye and
 * near 0.1 when shut. Being a ratio, it doesn't care how big the face is in
 * the frame or how far away the phone was held.
 */
function eyeOpenness(eye: Point[]): number {
  const width = distance(eye[0]!, eye[3]!);
  if (width === 0) return 0;
  return (distance(eye[1]!, eye[5]!) + distance(eye[2]!, eye[4]!)) / (2 * width);
}

function eyesOpenness(landmarks: faceapi.FaceLandmarks68): number {
  return (
    (eyeOpenness(landmarks.getLeftEye()) + eyeOpenness(landmarks.getRightEye())) /
    2
  );
}

/** Inner-lip gap over mouth width: ~0 with the mouth shut, >0.25 open. */
function mouthOpenness(landmarks: faceapi.FaceLandmarks68): number {
  // getMouth() returns points 48–67 in order, so index i is point 48 + i.
  const mouth = landmarks.getMouth();
  const width = distance(mouth[0]!, mouth[6]!); // corners, 48 → 54
  if (width === 0) return 0;
  return distance(mouth[14]!, mouth[18]!) / width; // inner lips, 62 → 66
}

/**
 * How far the head is turned, as the nose tip's offset from the midpoint
 * between the outer eye corners, over the distance between them. Zero looking
 * straight on, and roughly ±0.2 at a clear turn. Sign depends on which way the
 * head went *and* on whether the phone mirrored the shot, so only the
 * magnitude is ever used.
 */
function headTurn(landmarks: faceapi.FaceLandmarks68): number {
  const leftOuter = landmarks.getLeftEye()[0]!; // point 36
  const rightOuter = landmarks.getRightEye()[3]!; // point 45
  const noseTip = landmarks.getNose()[3]!; // point 30

  const span = distance(leftOuter, rightOuter);
  if (span === 0) return 0;
  return (noseTip.x - (leftOuter.x + rightOuter.x) / 2) / span;
}

/* ----------------------------------------------------------- the checks */

/**
 * Thresholds are deliberately compared against the resident's *own* neutral
 * frame rather than against fixed numbers. Faces differ — some people rest
 * with their lips apart, some have narrow eyes — and a fixed bar either fails
 * them every day or passes anything. The absolute floors are only there to
 * stop a tiny change from being read as a big one.
 */
const CHECKS: Record<
  LivenessAction,
  (neutral: FaceSample, challenge: FaceSample) => string | null
> = {
  smile: (neutral, challenge) => {
    const before = neutral.expressions.happy;
    const after = challenge.expressions.happy;
    if (after < 0.65 || after - before < 0.25) {
      return "We couldn't see a smile. Try again, and give the camera a clear one.";
    }
    return null;
  },

  open_mouth: (neutral, challenge) => {
    const before = mouthOpenness(neutral.landmarks);
    const after = mouthOpenness(challenge.landmarks);
    if (after < 0.22 || after - before < 0.14) {
      return "We couldn't see your mouth open. Try again, and open it wider.";
    }
    return null;
  },

  close_eyes: (neutral, challenge) => {
    const before = eyesOpenness(neutral.landmarks);
    const after = eyesOpenness(challenge.landmarks);
    // Without an open-eyed frame to compare against there's no baseline, so
    // say what to fix rather than failing on the closed frame.
    if (before < 0.19) {
      return "Keep your eyes open for the first photo, then close them for the second.";
    }
    if (after > 0.17 || after > before * 0.65) {
      return "We couldn't see your eyes close. Try again, and shut them fully.";
    }
    return null;
  },

  turn_head: (neutral, challenge) => {
    const before = headTurn(neutral.landmarks);
    const after = headTurn(challenge.landmarks);
    if (Math.abs(before) > 0.12) {
      return "Look straight at the camera for the first photo, then turn your head for the second.";
    }
    if (Math.abs(after) < 0.15 || Math.abs(after - before) < 0.12) {
      return "We couldn't see your head turn. Try again, and turn a bit further.";
    }
    return null;
  },
};

/**
 * Checks the pair of frames against the action the challenge asked for.
 * Throws an HttpError the resident can act on; returns nothing when it passes.
 *
 * The caller has already established that both frames hold one clear face and
 * that it's the enrolled resident's.
 */
export function assertLive(
  action: LivenessAction,
  neutral: FaceSample,
  challenge: FaceSample
): void {
  // The same file sent twice is the cheapest possible spoof, and no amount of
  // geometry would catch it — the two frames would agree perfectly.
  if (neutral.imageDigest === challenge.imageDigest) {
    throw challengeError(
      "Both photos are the same shot. Take the second one after the prompt."
    );
  }

  const problem = CHECKS[action](neutral, challenge);
  if (problem) throw challengeError(problem);
}
