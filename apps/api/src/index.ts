import { createApp } from "./app";
import { env } from "./env";
import { assertDatabaseReachable, pool } from "./db/client";

async function main(): Promise<void> {
  // Fail before binding the port rather than 500ing on the first request.
  await assertDatabaseReachable();

  const app = createApp();

  // 0.0.0.0 so a physical device on the same LAN can reach the dev server.
  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(
      `API listening on http://localhost:${env.port} (${env.nodeEnv})`
    );
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => {
        void pool.end().then(() => process.exit(0));
      });
    });
  }
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
