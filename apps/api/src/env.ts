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
} as const;

/** True for the allow-listed demo / App Review numbers. */
export function isReviewPhone(mobile: string): boolean {
  return (
    env.reviewOtpCode.length > 0 && env.reviewOtpPhones.includes(mobile)
  );
}
