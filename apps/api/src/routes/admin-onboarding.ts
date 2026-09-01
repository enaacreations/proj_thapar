import { Router } from "express";
import { eq } from "drizzle-orm";
import type {
  AdminOnboardingDetail,
  AdminOnboardingRow,
  IssueLeaseBody,
  ReviewKycBody,
  RoommateMatch,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { adminOf } from "../admin-auth";
import { db } from "../db/client";
import * as t from "../db/schema";
import * as ob from "../data/onboarding";
import { getResident } from "../data/db";

export const adminOnboardingRouter: Router = Router();

function pathParam(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.badRequest(`Missing ${what}.`);
  }
  return value;
}

async function requireResident(id: string): Promise<void> {
  if (!(await getResident(id))) {
    throw HttpError.notFound("We couldn't find that resident.");
  }
}

adminOnboardingRouter.get("/onboarding", async (_req, res) => {
  const residents = await db
    .select({
      id: t.residents.id,
      fullName: t.residents.fullName,
      mobile: t.residents.mobile,
      roomNumber: t.rooms.roomNumber,
    })
    .from(t.residents)
    .leftJoin(t.rooms, eq(t.residents.id, t.rooms.residentId))
    .where(eq(t.residents.accountStatus, "approved"))
    .orderBy(t.residents.fullName);

  const rows: AdminOnboardingRow[] = await Promise.all(
    residents.map(async (r) => {
      const progress = await ob.getProgress(r.id);
      return {
        residentId: r.id,
        fullName: r.fullName,
        mobile: r.mobile,
        roomNumber: r.roomNumber,
        kycStatus: progress.kycStatus,
        leaseStatus: progress.leaseStatus,
        moveInComplete: progress.moveInComplete,
        percentComplete: progress.percentComplete,
      };
    })
  );

  res.json(rows);
});

adminOnboardingRouter.get("/onboarding/:id", async (req, res) => {
  const id = pathParam(req.params.id, "resident id");
  const resident = await getResident(id);
  if (!resident) throw HttpError.notFound("We couldn't find that resident.");

  const [room] = await db
    .select({ roomNumber: t.rooms.roomNumber })
    .from(t.rooms)
    .where(eq(t.rooms.residentId, id))
    .limit(1);

  const [progress, kyc, lease, moveIn, roommateProfile] = await Promise.all([
    ob.getProgress(id),
    ob.getKyc(id),
    ob.getLease(id),
    ob.getMoveIn(id),
    ob.getRoommateProfile(id),
  ]);

  const detail: AdminOnboardingDetail = {
    residentId: id,
    fullName: resident.fullName,
    mobile: resident.mobile,
    roomNumber: room?.roomNumber ?? null,
    kycStatus: progress.kycStatus,
    leaseStatus: progress.leaseStatus,
    moveInComplete: progress.moveInComplete,
    percentComplete: progress.percentComplete,
    kyc,
    lease,
    moveIn,
    roommateProfile,
  };

  res.json(detail);
});

adminOnboardingRouter.post("/onboarding/:id/kyc/review", async (req, res) => {
  const id = pathParam(req.params.id, "resident id");
  await requireResident(id);

  const { decision, reason } = req.body as Partial<ReviewKycBody>;

  if (decision !== "verified" && decision !== "rejected") {
    throw HttpError.badRequest("Decide whether to verify or reject.");
  }
  if (
    decision === "rejected" &&
    (typeof reason !== "string" || reason.trim().length < 5)
  ) {
    throw HttpError.badRequest(
      "Say what was wrong with the documents. The resident sees it."
    );
  }

  const current = await ob.getKyc(id);
  if (current.documents.length === 0) {
    throw HttpError.badRequest("This resident hasn't uploaded anything yet.");
  }

  res.json(
    await ob.reviewKyc(
      id,
      decision,
      adminOf(req).name,
      typeof reason === "string" ? reason.trim() : null
    )
  );
});

adminOnboardingRouter.post("/onboarding/:id/lease", async (req, res) => {
  const id = pathParam(req.params.id, "resident id");
  await requireResident(id);

  const body = req.body as Partial<IssueLeaseBody>;

  const rent = Number(body.monthlyRent);
  const deposit = Number(body.securityDeposit);
  const notice = Number(body.noticePeriodDays);

  if (!Number.isFinite(rent) || rent <= 0) {
    throw HttpError.badRequest("Enter the monthly rent.");
  }
  if (!Number.isFinite(deposit) || deposit < 0) {
    throw HttpError.badRequest("Enter the security deposit.");
  }
  if (!Number.isInteger(notice) || notice < 0) {
    throw HttpError.badRequest("Enter the notice period in days.");
  }

  const dateish = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof body.startDate !== "string" || !dateish.test(body.startDate)) {
    throw HttpError.badRequest("Enter the start date.");
  }
  if (typeof body.endDate !== "string" || !dateish.test(body.endDate)) {
    throw HttpError.badRequest("Enter the end date.");
  }
  if (body.endDate <= body.startDate) {
    throw HttpError.badRequest("The end date must be after the start date.");
  }

  const existing = await ob.getLease(id);
  if (existing?.status === "signed") {
    throw new HttpError(
      409,
      "already_signed",
      "This resident has already signed an agreement. Cancel it before issuing a new one."
    );
  }

  res.status(201).json(
    await ob.issueLease(id, adminOf(req).name, {
      monthlyRent: Math.round(rent),
      securityDeposit: Math.round(deposit),
      noticePeriodDays: notice,
      startDate: body.startDate,
      endDate: body.endDate,
    })
  );
});

/** Compatibility of this resident against everyone else, for room pairing. */
adminOnboardingRouter.get("/onboarding/:id/compatibility", async (req, res) => {
  const id = pathParam(req.params.id, "resident id");
  await requireResident(id);

  const matches: RoommateMatch[] = await ob.findMatches(id, 10);
  res.json(matches);
});
