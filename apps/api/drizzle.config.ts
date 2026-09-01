import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgres://localhost:5432/thapar",
  },
  verbose: true,
  strict: true,
});
