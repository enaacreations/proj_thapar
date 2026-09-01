import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from "express";
import cors from "cors";
import morgan from "morgan";
import type { ApiError } from "@proj/shared";
import { env } from "./env";
import { HttpError } from "./http-error";
import { requireAuth } from "./auth";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { meRouter } from "./routes/me";
import { foodRouter } from "./routes/food";
import { maintenanceRouter } from "./routes/maintenance";
import { laundryRouter } from "./routes/laundry";
import { complaintsRouter } from "./routes/complaints";
import { visitsRouter } from "./routes/visits";
import { attendanceRouter } from "./routes/attendance";
import { feedbackRouter } from "./routes/feedback";
import { messRouter, notificationsRouter, requestsRouter } from "./routes/misc";
import { onboardingRouter } from "./routes/onboarding";
import { financeRouter } from "./routes/finance";
import {
  documentsRouter,
  paymentsPublicRouter,
} from "./routes/payments-public";

const notFound: RequestHandler = (req) => {
  throw HttpError.notFound(`Cannot ${req.method} ${req.path}`);
};

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = { error: err.code, message: err.message };
    res.status(err.status).json(body);
    return;
  }

  console.error(err);
  const body: ApiError = {
    error: "internal_error",
    message: "Something went wrong. Please try again.",
  };
  res.status(500).json(body);
};

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(","),
    })
  );
  app.use(express.json({ limit: "2mb" }));
  if (env.nodeEnv !== "test") app.use(morgan("dev"));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);

  // Admin surface has its own session scheme; guarded inside the router.
  app.use("/api/admin", adminRouter);

  // Everything below needs a signed-in resident.
  app.use("/api/me", requireAuth, meRouter);
  app.use("/api/food", requireAuth, foodRouter);
  app.use("/api/maintenance", requireAuth, maintenanceRouter);
  app.use("/api/laundry", requireAuth, laundryRouter);
  app.use("/api/complaints", requireAuth, complaintsRouter);
  app.use("/api/visits", requireAuth, visitsRouter);
  app.use("/api/attendance", requireAuth, attendanceRouter);
  app.use("/api/feedback", requireAuth, feedbackRouter);
  app.use("/api/mess", requireAuth, messRouter);
  app.use("/api/requests", requireAuth, requestsRouter);
  app.use("/api/notifications", requireAuth, notificationsRouter);
  app.use("/api/onboarding", requireAuth, onboardingRouter);
  app.use("/api/finance", requireAuth, financeRouter);

  // Gateway callbacks and document pages can't carry a resident token: the
  // webhook is server-to-server and documents open in the system browser,
  // so each authenticates itself (signature / signed URL).
  app.use("/api/payments", paymentsPublicRouter);
  app.use("/api/documents", documentsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
