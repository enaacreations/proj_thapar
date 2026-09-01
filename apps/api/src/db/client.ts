import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import * as schema from "./schema";

export const pool = new Pool({ connectionString: env.databaseUrl });

export const db = drizzle(pool, { schema });

export type Db = typeof db;

/** Fails fast at boot with a message that says what to do, not just what broke. */
export async function assertDatabaseReachable(): Promise<void> {
  try {
    await pool.query("select 1");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Can't reach Postgres at ${redact(env.databaseUrl)}.\n` +
        `  ${reason}\n` +
        `  Check the database is running and DATABASE_URL in apps/api/.env is correct,\n` +
        `  then run: npm run db:migrate --workspace @proj/api`
    );
  }
}

function redact(url: string): string {
  return url.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
}
