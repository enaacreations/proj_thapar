import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import {
  FOOD_PREF_LABELS,
  SLEEP_LABELS,
  type InventoryItem,
  type KycDocument,
  type KycDocumentType,
  type KycState,
  type KycStatus,
  type LeaseAgreement,
  type LeaseStatus,
  type LeaseTerms,
  type MoveInState,
  type MoveInTask,
  type OnboardingProgress,
  type RoommateMatch,
  type RoommateProfile,
  type RoommateProfileBody,
} from "@proj/shared";
import { db } from "../db/client";
import * as t from "../db/schema";
import { MOVE_IN_TASKS } from "./catalog";
import { nextId } from "./db";

const iso = (d: Date) => d.toISOString();

/** Documents a resident must upload before KYC can go for review. */
const REQUIRED_DOCS: KycDocumentType[] = ["aadhaar_front", "aadhaar_back", "photo"];

/* ------------------------------------------------------------------ KYC */

export async function getKyc(residentId: string): Promise<KycState> {
  const [record] = await db
    .select()
    .from(t.kycRecords)
    .where(eq(t.kycRecords.residentId, residentId))
    .limit(1);

  const docs = await db
    .select()
    .from(t.kycDocuments)
    .where(eq(t.kycDocuments.residentId, residentId))
    .orderBy(t.kycDocuments.uploadedAt);

  const documents: KycDocument[] = docs.map((d) => ({
    id: d.id,
    type: d.type,
    uri: d.uri,
    uploadedAt: iso(d.uploadedAt),
  }));

  const have = new Set(documents.map((d) => d.type));
  const missing = REQUIRED_DOCS.filter((r) => !have.has(r));

  // Derive the "needs documents" state rather than storing it — it's just a
  // function of what's been uploaded.
  const stored = record?.status ?? "not_started";
  const status: KycStatus =
    stored === "not_started" && documents.length > 0
      ? "awaiting_documents"
      : stored;

  return {
    status,
    provider: record?.provider ?? "manual",
    reference: record?.reference ?? null,
    reviewedBy: record?.reviewedBy ?? null,
    reviewedAt: record?.reviewedAt ? iso(record.reviewedAt) : null,
    rejectionReason: record?.rejectionReason ?? null,
    documents,
    missing,
  };
}

async function ensureKycRecord(residentId: string): Promise<void> {
  await db
    .insert(t.kycRecords)
    .values({ residentId, status: "awaiting_documents" })
    .onConflictDoNothing();
}

export async function addKycDocument(
  residentId: string,
  type: KycDocumentType,
  uri: string
): Promise<KycState> {
  await ensureKycRecord(residentId);

  // One document per type: re-uploading replaces rather than stacking.
  await db
    .delete(t.kycDocuments)
    .where(
      and(
        eq(t.kycDocuments.residentId, residentId),
        eq(t.kycDocuments.type, type)
      )
    );

  await db.insert(t.kycDocuments).values({
    id: randomUUID(),
    residentId,
    type,
    uri,
  });

  // A new upload after a rejection puts it back in the queue, not in limbo.
  await db
    .update(t.kycRecords)
    .set({ status: "awaiting_documents", rejectionReason: null })
    .where(
      and(
        eq(t.kycRecords.residentId, residentId),
        ne(t.kycRecords.status, "verified")
      )
    );

  return getKyc(residentId);
}

export async function removeKycDocument(
  residentId: string,
  id: string
): Promise<KycState> {
  await db
    .delete(t.kycDocuments)
    .where(
      and(eq(t.kycDocuments.id, id), eq(t.kycDocuments.residentId, residentId))
    );
  return getKyc(residentId);
}

export async function submitKyc(residentId: string): Promise<KycState> {
  await ensureKycRecord(residentId);
  await db
    .update(t.kycRecords)
    .set({ status: "under_review", rejectionReason: null })
    .where(eq(t.kycRecords.residentId, residentId));
  return getKyc(residentId);
}

export async function reviewKyc(
  residentId: string,
  decision: "verified" | "rejected",
  reviewer: string,
  reason: string | null
): Promise<KycState> {
  await ensureKycRecord(residentId);

  await db
    .update(t.kycRecords)
    .set({
      status: decision,
      reviewedBy: reviewer,
      reviewedAt: new Date(),
      rejectionReason: decision === "rejected" ? reason : null,
      // A real AUA/KUA or DigiLocker check would set its own reference here.
      reference: decision === "verified" ? `MANUAL-${Date.now()}` : null,
    })
    .where(eq(t.kycRecords.residentId, residentId));

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId,
    title: decision === "verified" ? "ID verified" : "ID documents rejected",
    body:
      decision === "verified"
        ? "Your documents checked out. You can sign the agreement now."
        : `We couldn't accept your documents. ${reason ?? "Please upload them again."}`,
    kind: decision === "verified" ? "success" : "danger",
    href: "/onboarding/kyc",
    read: false,
  });

  // The checklist step is owned by this flow, so the decision drives it. The
  // resident can't tick it themselves — it's blocked on exactly this.
  await setTaskDone(residentId, "documents", decision === "verified");

  return getKyc(residentId);
}

/* ---------------------------------------------------------------- lease */

function toLease(row: typeof t.leaseAgreements.$inferSelect): LeaseAgreement {
  return {
    id: row.id,
    residentId: row.residentId,
    status: row.status,
    terms: row.terms as unknown as LeaseTerms,
    issuedAt: iso(row.issuedAt),
    issuedBy: row.issuedBy,
    signedAt: row.signedAt ? iso(row.signedAt) : null,
    signerName: row.signerName,
    signaturePath: row.signaturePath,
  };
}

export async function getLease(
  residentId: string
): Promise<LeaseAgreement | null> {
  const [row] = await db
    .select()
    .from(t.leaseAgreements)
    .where(eq(t.leaseAgreements.residentId, residentId))
    .orderBy(t.leaseAgreements.issuedAt)
    .limit(1);
  return row ? toLease(row) : null;
}

export async function issueLease(
  residentId: string,
  issuedBy: string,
  input: {
    monthlyRent: number;
    securityDeposit: number;
    noticePeriodDays: number;
    startDate: string;
    endDate: string;
  }
): Promise<LeaseAgreement> {
  const [room] = await db
    .select()
    .from(t.rooms)
    .where(eq(t.rooms.residentId, residentId))
    .limit(1);

  const terms: LeaseTerms = {
    ...input,
    roomSummary: room
      ? `Room ${room.roomNumber}, ${room.floor}, ${room.wing} — ${room.roomType}`
      : "Room to be allocated",
    propertyName: room?.propertyName ?? "Thapar",
    propertyAddress:
      room?.propertyAddress ??
      "Thapar Institute Campus, Bhadson Road, Patiala 147004",
    houseRules: [
      "Quiet hours are 10:00 pm to 7:00 am.",
      "Visitors must be registered in the app before they arrive.",
      "Smoking is not permitted anywhere inside the building.",
      "Damage beyond normal wear is deducted from the security deposit.",
      "Give notice before vacating, as set out above.",
    ],
  };

  // One live agreement per resident: re-issuing replaces the unsigned one.
  await db
    .delete(t.leaseAgreements)
    .where(
      and(
        eq(t.leaseAgreements.residentId, residentId),
        ne(t.leaseAgreements.status, "signed")
      )
    );

  const id = await nextId("LSE");
  const [row] = await db
    .insert(t.leaseAgreements)
    .values({
      id,
      residentId,
      status: "issued",
      terms: terms as unknown as Record<string, unknown>,
      issuedBy,
    })
    .returning();

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId,
    title: "Your agreement is ready",
    body: "Read the terms and sign it in the app when you're ready.",
    kind: "info",
    href: "/onboarding/lease",
    read: false,
  });

  return toLease(row as typeof t.leaseAgreements.$inferSelect);
}

export async function signLease(
  residentId: string,
  signerName: string,
  signaturePath: string
): Promise<LeaseAgreement | null> {
  // Only an issued agreement can be signed, so a replayed request can't
  // overwrite an existing signature.
  const [row] = await db
    .update(t.leaseAgreements)
    .set({
      status: "signed",
      signedAt: new Date(),
      signerName,
      signaturePath,
    })
    .where(
      and(
        eq(t.leaseAgreements.residentId, residentId),
        eq(t.leaseAgreements.status, "issued")
      )
    )
    .returning();

  return row ? toLease(row) : null;
}

/* ----------------------------------------------------- roommate matching */

export async function getRoommateProfile(
  residentId: string
): Promise<RoommateProfile | null> {
  const [row] = await db
    .select()
    .from(t.roommateProfiles)
    .where(eq(t.roommateProfiles.residentId, residentId))
    .limit(1);
  if (!row) return null;

  const { residentId: _ignored, updatedAt, ...rest } = row;
  return { ...rest, updatedAt: iso(updatedAt) };
}

export async function saveRoommateProfile(
  residentId: string,
  body: RoommateProfileBody
): Promise<RoommateProfile> {
  await db
    .insert(t.roommateProfiles)
    .values({ ...body, residentId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: t.roommateProfiles.residentId,
      set: { ...body, updatedAt: new Date() },
    });

  return (await getRoommateProfile(residentId)) as RoommateProfile;
}

/**
 * Weighted similarity, not a black box. Each dimension contributes a 0–1
 * agreement score; the weights say how much friction that dimension actually
 * causes when two people share a room.
 */
const WEIGHTS = {
  sleepSchedule: 0.25,
  cleanliness: 0.2,
  noiseTolerance: 0.15,
  socialLevel: 0.1,
  studyLocation: 0.1,
  guestFrequency: 0.1,
  smoking: 0.07,
  foodPreference: 0.03,
} as const;

/** Two 1–5 answers → 0–1, where identical is 1 and opposite ends are 0. */
const closeness = (a: number, b: number) => 1 - Math.abs(a - b) / 4;

const categorical = (a: string, b: string, flexible: string) =>
  a === b ? 1 : a === flexible || b === flexible ? 0.6 : 0.15;

export function scoreCompatibility(
  a: RoommateProfile,
  b: RoommateProfile
): { score: number; agreements: string[]; frictions: string[] } {
  const parts = {
    sleepSchedule: categorical(a.sleepSchedule, b.sleepSchedule, "flexible"),
    cleanliness: closeness(a.cleanliness, b.cleanliness),
    noiseTolerance: closeness(a.noiseTolerance, b.noiseTolerance),
    socialLevel: closeness(a.socialLevel, b.socialLevel),
    studyLocation: categorical(a.studyLocation, b.studyLocation, "flexible"),
    guestFrequency: closeness(a.guestFrequency, b.guestFrequency),
    smoking: a.smoking === b.smoking ? 1 : 0,
    foodPreference: categorical(a.foodPreference, b.foodPreference, "either"),
  };

  const total = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
    (sum, key) => sum + parts[key] * WEIGHTS[key],
    0
  );

  const agreements: string[] = [];
  const frictions: string[] = [];

  if (parts.sleepSchedule >= 0.9) {
    agreements.push(`You both say: ${SLEEP_LABELS[a.sleepSchedule].toLowerCase()}`);
  } else if (parts.sleepSchedule < 0.5) {
    frictions.push("You keep very different hours");
  }

  if (parts.cleanliness >= 0.75) agreements.push("Similar standards of tidiness");
  else if (parts.cleanliness < 0.5) frictions.push("Different ideas about tidiness");

  if (parts.noiseTolerance < 0.5) frictions.push("One of you needs more quiet");
  if (parts.socialLevel >= 0.75) agreements.push("Similar social energy");
  if (parts.guestFrequency < 0.5) frictions.push("Different habits around guests");

  if (parts.studyLocation >= 0.9) agreements.push("You study in the same sort of place");
  if (!parts.smoking) frictions.push("One of you smokes and the other doesn't");
  if (parts.foodPreference >= 0.9) {
    agreements.push(`Both ${FOOD_PREF_LABELS[a.foodPreference].toLowerCase()}`);
  }

  return {
    score: Math.round(total * 100),
    agreements,
    frictions,
  };
}

export async function findMatches(
  residentId: string,
  limit = 5
): Promise<RoommateMatch[]> {
  const mine = await getRoommateProfile(residentId);
  if (!mine) return [];

  const others = await db
    .select({
      residentId: t.roommateProfiles.residentId,
      fullName: t.residents.fullName,
      roomNumber: t.rooms.roomNumber,
      sleepSchedule: t.roommateProfiles.sleepSchedule,
      cleanliness: t.roommateProfiles.cleanliness,
      noiseTolerance: t.roommateProfiles.noiseTolerance,
      socialLevel: t.roommateProfiles.socialLevel,
      studyLocation: t.roommateProfiles.studyLocation,
      guestFrequency: t.roommateProfiles.guestFrequency,
      smoking: t.roommateProfiles.smoking,
      foodPreference: t.roommateProfiles.foodPreference,
      updatedAt: t.roommateProfiles.updatedAt,
    })
    .from(t.roommateProfiles)
    .innerJoin(t.residents, eq(t.roommateProfiles.residentId, t.residents.id))
    .leftJoin(t.rooms, eq(t.roommateProfiles.residentId, t.rooms.residentId))
    .where(
      and(
        ne(t.roommateProfiles.residentId, residentId),
        eq(t.residents.accountStatus, "approved")
      )
    );

  return others
    .map((other) => {
      const { score, agreements, frictions } = scoreCompatibility(mine, {
        ...other,
        updatedAt: iso(other.updatedAt),
      });
      return {
        residentId: other.residentId,
        fullName: other.fullName,
        roomNumber: other.roomNumber,
        score,
        agreements,
        frictions,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* --------------------------------------------------------- move-in flow */

export async function getMoveIn(residentId: string): Promise<MoveInState> {
  const [state] = await db
    .select()
    .from(t.moveInState)
    .where(eq(t.moveInState.residentId, residentId))
    .limit(1);

  const rows = await db
    .select()
    .from(t.moveInTasks)
    .where(eq(t.moveInTasks.residentId, residentId));

  const done = new Map(rows.map((r) => [r.key, r]));

  const tasks: MoveInTask[] = MOVE_IN_TASKS.map((template) => {
    const row = done.get(template.key);
    return {
      key: template.key,
      label: template.label,
      description: template.description,
      done: row?.done ?? false,
      doneAt: row?.doneAt ? iso(row.doneAt) : null,
      blockedBy: template.blockedBy,
    };
  });

  const items = await db
    .select()
    .from(t.inventoryItems)
    .where(eq(t.inventoryItems.residentId, residentId))
    .orderBy(t.inventoryItems.recordedAt);

  const inventory: InventoryItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    condition: i.condition,
    notes: i.notes,
    photoUris: i.photoUris,
    recordedAt: iso(i.recordedAt),
  }));

  return {
    tasks,
    inventory,
    inventorySubmittedAt: state?.inventorySubmittedAt
      ? iso(state.inventorySubmittedAt)
      : null,
    completedAt: state?.completedAt ? iso(state.completedAt) : null,
  };
}

export async function setTaskDone(
  residentId: string,
  key: string,
  done: boolean
): Promise<MoveInState> {
  await db
    .insert(t.moveInTasks)
    .values({ residentId, key, done, doneAt: done ? new Date() : null })
    .onConflictDoUpdate({
      target: [t.moveInTasks.residentId, t.moveInTasks.key],
      set: { done, doneAt: done ? new Date() : null },
    });

  await refreshMoveInCompletion(residentId);
  return getMoveIn(residentId);
}

/** Marks the whole move-in done once every template task is ticked. */
async function refreshMoveInCompletion(residentId: string): Promise<void> {
  const rows = await db
    .select()
    .from(t.moveInTasks)
    .where(eq(t.moveInTasks.residentId, residentId));

  const doneKeys = new Set(rows.filter((r) => r.done).map((r) => r.key));
  const allDone = MOVE_IN_TASKS.every((task) => doneKeys.has(task.key));

  await db
    .insert(t.moveInState)
    .values({ residentId, completedAt: allDone ? new Date() : null })
    .onConflictDoUpdate({
      target: t.moveInState.residentId,
      set: { completedAt: allDone ? new Date() : null },
    });
}

export async function isInventoryLocked(residentId: string): Promise<boolean> {
  const [state] = await db
    .select()
    .from(t.moveInState)
    .where(eq(t.moveInState.residentId, residentId))
    .limit(1);
  return state?.inventorySubmittedAt != null;
}

export async function addInventoryItem(
  residentId: string,
  input: {
    name: string;
    condition: InventoryItem["condition"];
    notes: string;
    photoUris: string[];
  }
): Promise<MoveInState> {
  const id = await nextId("INV");
  await db.insert(t.inventoryItems).values({ ...input, id, residentId });
  return getMoveIn(residentId);
}

export async function removeInventoryItem(
  residentId: string,
  id: string
): Promise<MoveInState> {
  await db
    .delete(t.inventoryItems)
    .where(
      and(
        eq(t.inventoryItems.id, id),
        eq(t.inventoryItems.residentId, residentId)
      )
    );
  return getMoveIn(residentId);
}

export async function submitInventory(
  residentId: string
): Promise<MoveInState> {
  await db
    .insert(t.moveInState)
    .values({ residentId, inventorySubmittedAt: new Date() })
    .onConflictDoUpdate({
      target: t.moveInState.residentId,
      set: { inventorySubmittedAt: new Date() },
    });

  // Submitting the inventory is what completes that checklist step.
  await setTaskDone(residentId, "inventory", true);
  return getMoveIn(residentId);
}

/* -------------------------------------------------------------- progress */

export async function getProgress(
  residentId: string
): Promise<OnboardingProgress> {
  const [kyc, lease, profile, moveIn] = await Promise.all([
    getKyc(residentId),
    getLease(residentId),
    getRoommateProfile(residentId),
    getMoveIn(residentId),
  ]);

  const leaseStatus: LeaseStatus = lease?.status ?? "none";
  const doneTasks = moveIn.tasks.filter((t) => t.done).length;

  // Four equal pillars; the checklist contributes proportionally.
  const pillars = [
    kyc.status === "verified" ? 1 : kyc.status === "under_review" ? 0.5 : 0,
    leaseStatus === "signed" ? 1 : leaseStatus === "issued" ? 0.3 : 0,
    profile ? 1 : 0,
    moveIn.tasks.length ? doneTasks / moveIn.tasks.length : 0,
  ];

  const percentComplete = Math.round(
    (pillars.reduce((a, b) => a + b, 0) / pillars.length) * 100
  );

  let nextStep = "You're all set — welcome in.";
  if (kyc.status !== "verified") {
    nextStep =
      kyc.missing.length > 0
        ? "Upload your ID documents"
        : kyc.status === "under_review"
          ? "We're checking your documents"
          : "Send your documents for review";
  } else if (leaseStatus === "none") {
    nextStep = "Waiting for the office to issue your agreement";
  } else if (leaseStatus === "issued") {
    nextStep = "Read and sign your agreement";
  } else if (!profile) {
    nextStep = "Tell us about your living habits";
  } else if (!moveIn.inventorySubmittedAt) {
    nextStep = "Record the condition of your room";
  } else if (moveIn.tasks.some((t) => !t.done)) {
    nextStep = "Finish the last few move-in steps";
  }

  return {
    kycStatus: kyc.status,
    leaseStatus,
    roommateProfileComplete: profile !== null,
    moveInComplete: moveIn.completedAt !== null,
    inventorySubmitted: moveIn.inventorySubmittedAt !== null,
    percentComplete,
    nextStep,
  };
}
