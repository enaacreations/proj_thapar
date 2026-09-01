import type { RequestHandler } from "express";
import { HttpError } from "./http-error";
import { getResident } from "./data/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      residentId?: string;
    }
  }
}

const TOKEN_PREFIX = "tok_";

export function issueToken(residentId: string): string {
  // Opaque enough for a demo. Replace with a signed JWT before any real use.
  return `${TOKEN_PREFIX}${residentId}`;
}

/** Rejects the request unless a valid bearer token names a known resident. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token.startsWith(TOKEN_PREFIX)) {
    next(new HttpError(401, "unauthorized", "Please sign in again."));
    return;
  }

  const residentId = token.slice(TOKEN_PREFIX.length);

  try {
    // Must be awaited — an un-awaited Promise is always truthy, which would
    // let any well-formed token through.
    if (!(await getResident(residentId))) {
      next(new HttpError(401, "unauthorized", "Please sign in again."));
      return;
    }
  } catch (err) {
    next(err);
    return;
  }

  req.residentId = residentId;
  next();
};

/** Reads the resident id set by `requireAuth`. */
export function residentIdOf(req: { residentId?: string }): string {
  if (!req.residentId) {
    throw new HttpError(401, "unauthorized", "Please sign in again.");
  }
  return req.residentId;
}
