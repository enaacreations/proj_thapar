import { createHmac, timingSafeEqual } from "node:crypto";
import { MESS_PASS_ROTATE_SECONDS } from "@proj/shared";
import { env } from "./env";

/**
 * Mess passes are HMACs over (residentId, time window) rather than rows in a
 * table. The counter can then verify a pass by recomputing it — no lookup, no
 * round trip to the resident's phone, and nothing to clean up when a pass goes
 * unused. The phone is a display; the counter's device is what the API trusts.
 */

const WINDOW_MS = MESS_PASS_ROTATE_SECONDS * 1000;

/**
 * How many past windows still verify. A pass is shown, queued with, and then
 * scanned — allowing one window back covers that lag and modest clock skew
 * without widening the relay window much beyond a minute.
 */
const GRACE_WINDOWS = 1;

function windowAt(ms: number): number {
  return Math.floor(ms / WINDOW_MS);
}

function sign(residentId: string, window: number): string {
  return createHmac("sha256", env.messPassSecret)
    .update(`${residentId}.${window}`)
    .digest("base64url");
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // Compare lengths first: timingSafeEqual throws on a mismatch.
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface IssuedPass {
  token: string;
  expiresAt: Date;
}

export function issueMessPass(residentId: string, now = Date.now()): IssuedPass {
  const window = windowAt(now);
  const signature = sign(residentId, window);

  return {
    token: `${residentId}.${window}.${signature}`,
    expiresAt: new Date((window + 1) * WINDOW_MS),
  };
}

/**
 * Returns the resident id a pass belongs to, or null when it is malformed,
 * expired or forged. Callers must not distinguish those cases to the scanner
 * beyond "that pass didn't work".
 */
export function verifyMessPass(token: string, now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [residentId, rawWindow, signature] = parts as [string, string, string];
  const window = Number(rawWindow);
  if (!residentId || !signature || !Number.isInteger(window)) return null;

  const current = windowAt(now);
  // A pass from a future window is either clock skew or someone minting their
  // own; neither should be honoured.
  if (window > current || window < current - GRACE_WINDOWS) return null;

  return equals(signature, sign(residentId, window)) ? residentId : null;
}
