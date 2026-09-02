import { Router } from "express";
import { kycNumberProblem, normaliseKycNumber } from "@proj/shared";
import type {
  AuthSession,
  MpinLoginBody,
  RegistrationBody,
  RegistrationResponse,
  SendOtpBody,
  SendOtpResponse,
  SetMpinBody,
  VerifyOtpBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { env, isReviewPhone } from "../env";
import { issueToken, requireAuth, residentIdOf } from "../auth";
import * as db from "../data/db";

export const authRouter: Router = Router();

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw HttpError.badRequest(`Please enter your ${field}.`);
  }
  return value.trim();
}

function requireMobile(value: unknown): string {
  const mobile = requireString(value, "mobile number");
  if (!/^\d{10}$/.test(mobile)) {
    throw HttpError.badRequest("Mobile number must be 10 digits.");
  }
  return mobile;
}

authRouter.post("/register", async (req, res) => {
  const body = req.body as Partial<RegistrationBody>;

  const mobile = requireMobile(body.mobile);
  if (await db.findResidentByMobile(mobile)) {
    throw HttpError.badRequest(
      "This mobile number is already registered. Try signing in instead."
    );
  }

  const kycType = body.kycType === "pan" ? "pan" : "aadhaar";
  // Structure only — the number is checked for shape and checksum here, and
  // against the physical card by the hostel office at move-in. Nothing in this
  // app talks to UIDAI or NSDL.
  const kycNumber = normaliseKycNumber(
    requireString(body.kycNumber, "KYC number")
  );

  const kycProblem = kycNumberProblem(kycType, kycNumber);
  if (kycProblem) throw HttpError.badRequest(kycProblem);

  const resident = await db.createResident({
    fullName: requireString(body.fullName, "full name"),
    dob: requireString(body.dob, "date of birth"),
    gender:
      body.gender === "female" || body.gender === "other"
        ? body.gender
        : "male",
    kycType,
    kycNumber,
    mobile,
  });

  const response: RegistrationResponse = {
    requestId: resident.id,
    status: resident.accountStatus,
    message:
      "Registration submitted. The hostel office will approve it, and you'll get a notification when you can sign in.",
  };
  res.status(201).json(response);
});

authRouter.post("/otp/send", async (req, res) => {
  const { mobile } = req.body as Partial<SendOtpBody>;
  const normalised = requireMobile(mobile);

  const resident = await db.findResidentByMobile(normalised);
  if (!resident) {
    throw HttpError.notFound(
      "We couldn't find this number. Please register first."
    );
  }
  if (resident.accountStatus === "rejected") {
    throw new HttpError(
      403,
      "registration_rejected",
      resident.reviewNote
        ? `Your registration wasn't approved. ${resident.reviewNote}`
        : "Your registration wasn't approved. Please contact the hostel office."
    );
  }
  if (resident.accountStatus !== "approved") {
    throw new HttpError(
      403,
      "pending_approval",
      "Your registration is still awaiting approval from the hostel office."
    );
  }

  const { code, ttlSeconds } = await db.issueOtp(normalised);
  // Never echo a real number's code in production — that would let anyone
  // sign in as anyone. Demo and App Review numbers are the exception.
  const echo = !env.isProduction || isReviewPhone(normalised);
  const response: SendOtpResponse = {
    ...(echo ? { devOtp: code } : {}),
    expiresInSeconds: ttlSeconds,
  };
  res.json(response);
});

authRouter.post("/otp/verify", async (req, res) => {
  const { mobile, otp } = req.body as Partial<VerifyOtpBody>;
  const normalised = requireMobile(mobile);

  if (!(await db.verifyOtp(normalised, requireString(otp, "OTP")))) {
    throw HttpError.badRequest("That OTP is wrong or has expired. Try again.");
  }

  const resident = await db.findResidentByMobile(normalised);
  if (!resident) throw HttpError.notFound("Resident not found.");

  const session: AuthSession = {
    token: issueToken(resident.id),
    residentId: resident.id,
    mpinSet: resident.mpin !== null,
  };
  res.json(session);
});

authRouter.post("/mpin", requireAuth, async (req, res) => {
  const { mpin, biometricEnabled } = req.body as Partial<SetMpinBody>;
  const code = requireString(mpin, "MPIN");

  if (!/^\d{6}$/.test(code)) {
    throw HttpError.badRequest("MPIN must be exactly 6 digits.");
  }

  const residentId = residentIdOf(req);
  await db.setMpin(residentId, code, biometricEnabled === true);

  const session: AuthSession = {
    token: issueToken(residentId),
    residentId,
    mpinSet: true,
  };
  res.json(session);
});

authRouter.post("/mpin/login", async (req, res) => {
  const { mobile, mpin } = req.body as Partial<MpinLoginBody>;
  const normalised = requireMobile(mobile);

  const resident = await db.verifyMpin(normalised, requireString(mpin, "MPIN"));
  if (!resident) {
    throw new HttpError(401, "invalid_mpin", "That MPIN is incorrect.");
  }

  const session: AuthSession = {
    token: issueToken(resident.id),
    residentId: resident.id,
    mpinSet: true,
  };
  res.json(session);
});

/**
 * In-app account deletion. Apple requires this for any app with sign-in
 * (App Store Review guideline 5.1.1(v)); a web page alone is not enough.
 * Google accepts the published web instructions, but this covers both.
 */
authRouter.delete("/account", requireAuth, async (req, res) => {
  await db.deleteResidentAccount(residentIdOf(req));
  // The token is derived from the resident id, so removing the row is what
  // invalidates every session on every device.
  res.status(204).end();
});
