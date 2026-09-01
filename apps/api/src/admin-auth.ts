import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { RequestHandler } from "express";
import { and, eq, gt } from "drizzle-orm";
import type { AdminUser } from "@proj/shared";
import { HttpError } from "./http-error";
import { db } from "./db/client";
import * as t from "./db/schema";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * Admin passwords are hashed with scrypt from node's own crypto — no extra
 * dependency, and nothing reversible is ever stored.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;

  const derived = await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    KEY_LENGTH
  );
  const expected = Buffer.from(keyHex, "hex");

  if (expected.length !== derived.length) return false;
  // Constant-time compare so a wrong password can't be found by timing.
  return timingSafeEqual(derived, expected);
}

const SESSION_HOURS = 12;

export async function createAdminSession(adminId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);

  await db.insert(t.adminSessions).values({ token, adminId, expiresAt });
  return { token, expiresAt };
}

export async function destroyAdminSession(token: string): Promise<void> {
  await db.delete(t.adminSessions).where(eq(t.adminSessions.token, token));
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminUser;
      adminToken?: string;
    }
  }
}

/** Rejects unless the bearer token maps to a live, unexpired admin session. */
export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    next(new HttpError(401, "unauthorized", "Please sign in again."));
    return;
  }

  try {
    const [row] = await db
      .select({
        id: t.adminUsers.id,
        name: t.adminUsers.name,
        email: t.adminUsers.email,
        role: t.adminUsers.role,
        active: t.adminUsers.active,
      })
      .from(t.adminSessions)
      .innerJoin(t.adminUsers, eq(t.adminSessions.adminId, t.adminUsers.id))
      .where(
        and(
          eq(t.adminSessions.token, token),
          gt(t.adminSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!row || !row.active) {
      next(
        new HttpError(401, "unauthorized", "Your session expired. Sign in again.")
      );
      return;
    }

    req.admin = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
    };
    req.adminToken = token;
    next();
  } catch (err) {
    next(err);
  }
};

export function adminOf(req: { admin?: AdminUser }): AdminUser {
  if (!req.admin) {
    throw new HttpError(401, "unauthorized", "Please sign in again.");
  }
  return req.admin;
}
