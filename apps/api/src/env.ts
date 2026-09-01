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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  /** Comma-separated list, or "*" to allow any origin. */
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://localhost:5432/thapar"
  ),
} as const;
