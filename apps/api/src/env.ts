import { config } from "dotenv";
import { resolve } from "node:path";

// Loaded from apps/api/.env regardless of the cwd Turbo runs us from.
config({ path: resolve(__dirname, "../.env"), quiet: true });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set. Copy apps/api/.env.example to apps/api/.env and fill it in.`
    );
  }
  return value;
}

function list(name: string): readonly string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: Number(process.env.PORT ?? 4000),
  /** Comma-separated list, or "*" to allow any origin. */
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://localhost:5432/thapar"
  ),
  /**
   * There is no SMS gateway, so store reviewers and demo accounts would have
   * no way in. These numbers — and only these — keep a fixed OTP that the API
   * is willing to echo back. Every other number gets a random code that is
   * never disclosed, so production can't be used to take over an account.
   * Unset both to switch the escape hatch off entirely.
   */
  reviewOtpPhones: list("REVIEW_OTP_PHONES"),
  reviewOtpCode: process.env.REVIEW_OTP_CODE ?? "",
  /**
   * Signs mess passes. The dev fallback keeps `npm run dev` working on a fresh
   * clone; in production an unset value would let anyone mint a valid pass, so
   * it is required outright.
   */
  messPassSecret:
    process.env.NODE_ENV === "production"
      ? required("MESS_PASS_SECRET")
      : (process.env.MESS_PASS_SECRET ?? "dev-only-mess-pass-secret"),
  /**
   * Signs attendance liveness challenges. Same reasoning as the mess pass: an
   * unset value in production would let anyone mint a challenge for the action
   * their prepared photo happens to satisfy.
   */
  livenessSecret:
    process.env.NODE_ENV === "production"
      ? required("LIVENESS_SECRET")
      : (process.env.LIVENESS_SECRET ?? "dev-only-liveness-secret"),
  /**
   * Euclidean distance below which two face descriptors are the same person.
   * face-api's general-purpose default is 0.6; attendance is tightened a
   * little because letting a lookalike through costs more than asking someone
   * to retake a photo. Raise it if residents get rejected in poor light.
   */
  faceMatchThreshold: Number(process.env.FACE_MATCH_THRESHOLD ?? 0.55),
  /** Where attendance face photos are written for the audit trail. */
  uploadsDir: process.env.UPLOADS_DIR ?? resolve(__dirname, "../uploads"),
} as const;

/** True for the allow-listed demo / App Review numbers. */
export function isReviewPhone(mobile: string): boolean {
  return (
    env.reviewOtpCode.length > 0 && env.reviewOtpPhones.includes(mobile)
  );
}
