import { Router } from "express";
import {
  KYC_DOCUMENT_LABELS,
  type InventoryCondition,
  type KycDocumentType,
  type RecordInventoryBody,
  type RoommateProfileBody,
  type SignLeaseBody,
  type UploadKycDocumentBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import {
  INVENTORY_TEMPLATE,
  LAYOUT_PIECES,
  ROOM_PLAN,
  TOUR_SPACES,
} from "../data/catalog";
import * as ob from "../data/onboarding";

export const onboardingRouter: Router = Router();

function pathParam(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.badRequest(`Missing ${what}.`);
  }
  return value;
}

/* ------------------------------------------------------------- progress */

onboardingRouter.get("/progress", async (req, res) => {
  res.json(await ob.getProgress(residentIdOf(req)));
});

/* ------------------------------------------------------------------ KYC */

onboardingRouter.get("/kyc", async (req, res) => {
  res.json(await ob.getKyc(residentIdOf(req)));
});

onboardingRouter.post("/kyc/documents", async (req, res) => {
  const { type, uri } = req.body as Partial<UploadKycDocumentBody>;

  if (typeof type !== "string" || !(type in KYC_DOCUMENT_LABELS)) {
    throw HttpError.badRequest("Choose which document this is.");
  }
  if (typeof uri !== "string" || uri.length === 0) {
    throw HttpError.badRequest("Take or choose a photo of the document.");
  }

  res
    .status(201)
    .json(await ob.addKycDocument(residentIdOf(req), type as KycDocumentType, uri));
});

onboardingRouter.delete("/kyc/documents/:id", async (req, res) => {
  res.json(
    await ob.removeKycDocument(
      residentIdOf(req),
      pathParam(req.params.id, "document id")
    )
  );
});

onboardingRouter.post("/kyc/submit", async (req, res) => {
  const residentId = residentIdOf(req);
  const current = await ob.getKyc(residentId);

  if (current.status === "verified") {
    throw HttpError.badRequest("Your documents are already verified.");
  }
  if (current.missing.length > 0) {
    const names = current.missing
      .map((m) => KYC_DOCUMENT_LABELS[m].toLowerCase())
      .join(", ");
    throw HttpError.badRequest(`Still needed: ${names}.`);
  }

  res.json(await ob.submitKyc(residentId));
});

/* ---------------------------------------------------------------- lease */

onboardingRouter.get("/lease", async (req, res) => {
  res.json(await ob.getLease(residentIdOf(req)));
});

onboardingRouter.post("/lease/sign", async (req, res) => {
  const { signerName, signaturePath, agreed } = req.body as Partial<SignLeaseBody>;

  if (agreed !== true) {
    throw HttpError.badRequest(
      "Tick the box to confirm you've read the agreement."
    );
  }
  if (typeof signerName !== "string" || signerName.trim().length < 3) {
    throw HttpError.badRequest("Type your full name as it appears above.");
  }
  // A couple of dots isn't a signature; require a real stroke.
  if (typeof signaturePath !== "string" || signaturePath.length < 40) {
    throw HttpError.badRequest("Please sign in the box.");
  }

  const signed = await ob.signLease(
    residentIdOf(req),
    signerName.trim(),
    signaturePath
  );

  if (!signed) {
    throw new HttpError(
      409,
      "not_signable",
      "There's no agreement waiting for your signature. Refresh and try again."
    );
  }

  // Signing is what completes that checklist step.
  await ob.setTaskDone(residentIdOf(req), "agreement", true);
  res.json(signed);
});

/* ------------------------------------------------------------- roommate */

onboardingRouter.get("/roommate/profile", async (req, res) => {
  res.json(await ob.getRoommateProfile(residentIdOf(req)));
});

const SCALE = (value: unknown, field: string): number => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw HttpError.badRequest(`${field} must be between 1 and 5.`);
  }
  return n;
};

onboardingRouter.put("/roommate/profile", async (req, res) => {
  const body = req.body as Partial<RoommateProfileBody>;

  const sleep = body.sleepSchedule;
  if (sleep !== "early" && sleep !== "late" && sleep !== "flexible") {
    throw HttpError.badRequest("Pick your usual sleep schedule.");
  }
  const study = body.studyLocation;
  if (study !== "in_room" && study !== "outside" && study !== "flexible") {
    throw HttpError.badRequest("Pick where you usually study.");
  }
  const food = body.foodPreference;
  if (food !== "veg" && food !== "non_veg" && food !== "either") {
    throw HttpError.badRequest("Pick your food preference.");
  }

  const profile = await ob.saveRoommateProfile(residentIdOf(req), {
    sleepSchedule: sleep,
    cleanliness: SCALE(body.cleanliness, "Tidiness"),
    noiseTolerance: SCALE(body.noiseTolerance, "Noise tolerance"),
    socialLevel: SCALE(body.socialLevel, "Social level"),
    studyLocation: study,
    guestFrequency: SCALE(body.guestFrequency, "Guests"),
    smoking: body.smoking === true,
    foodPreference: food,
  });

  await ob.setTaskDone(residentIdOf(req), "roommate_profile", true);
  res.json(profile);
});

onboardingRouter.get("/roommate/matches", async (req, res) => {
  const residentId = residentIdOf(req);
  const [profile, matches] = await Promise.all([
    ob.getRoommateProfile(residentId),
    ob.findMatches(residentId),
  ]);
  res.json({ profile, matches });
});

/* --------------------------------------------------------------- move-in */

onboardingRouter.get("/move-in", async (req, res) => {
  res.json(await ob.getMoveIn(residentIdOf(req)));
});

onboardingRouter.post("/move-in/tasks/:key", async (req, res) => {
  const residentId = residentIdOf(req);
  const key = pathParam(req.params.key, "task key");
  const done = (req.body as { done?: unknown })?.done !== false;

  const state = await ob.getMoveIn(residentId);
  const task = state.tasks.find((t) => t.key === key);
  if (!task) throw HttpError.notFound("That step isn't on the checklist.");

  // Steps owned by another flow are ticked by finishing that flow, not here.
  if (done && task.blockedBy) {
    const progress = await ob.getProgress(residentId);
    const blocked =
      (task.blockedBy === "kyc" && progress.kycStatus !== "verified") ||
      (task.blockedBy === "lease" && progress.leaseStatus !== "signed") ||
      (task.blockedBy === "inventory" && !progress.inventorySubmitted);

    if (blocked) {
      throw HttpError.badRequest(
        "Finish that step in its own screen and this ticks itself."
      );
    }
  }

  res.json(await ob.setTaskDone(residentId, key, done));
});

onboardingRouter.get("/move-in/inventory/template", (_req, res) => {
  res.json(INVENTORY_TEMPLATE);
});

onboardingRouter.post("/move-in/inventory", async (req, res) => {
  const residentId = residentIdOf(req);

  if (await ob.isInventoryLocked(residentId)) {
    throw HttpError.badRequest(
      "The inventory is already submitted, so it can't be changed. Raise a maintenance request instead."
    );
  }

  const body = req.body as Partial<RecordInventoryBody>;
  const conditions: InventoryCondition[] = ["good", "fair", "damaged", "missing"];

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    throw HttpError.badRequest("What item is this?");
  }
  if (
    typeof body.condition !== "string" ||
    !conditions.includes(body.condition as InventoryCondition)
  ) {
    throw HttpError.badRequest("Choose the condition.");
  }

  const photoUris = Array.isArray(body.photoUris)
    ? body.photoUris.filter((p): p is string => typeof p === "string")
    : [];

  // Damage without a photo is exactly what causes deposit arguments later.
  if (
    (body.condition === "damaged" || body.condition === "missing") &&
    photoUris.length === 0
  ) {
    throw HttpError.badRequest(
      "Add a photo of the damage. It's what protects your deposit at move-out."
    );
  }

  res.status(201).json(
    await ob.addInventoryItem(residentId, {
      name: body.name.trim(),
      condition: body.condition as InventoryCondition,
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
      photoUris,
    })
  );
});

onboardingRouter.delete("/move-in/inventory/:id", async (req, res) => {
  const residentId = residentIdOf(req);
  if (await ob.isInventoryLocked(residentId)) {
    throw HttpError.badRequest("The inventory is already submitted.");
  }
  res.json(
    await ob.removeInventoryItem(residentId, pathParam(req.params.id, "item id"))
  );
});

onboardingRouter.post("/move-in/inventory/submit", async (req, res) => {
  const residentId = residentIdOf(req);

  if (await ob.isInventoryLocked(residentId)) {
    throw HttpError.badRequest("You've already submitted the inventory.");
  }

  const state = await ob.getMoveIn(residentId);
  if (state.inventory.length === 0) {
    throw HttpError.badRequest(
      "Record at least the main fittings before submitting."
    );
  }

  res.json(await ob.submitInventory(residentId));
});

/* ---------------------------------------------------------------- tours */

onboardingRouter.get("/tours", (_req, res) => {
  res.json(TOUR_SPACES);
});

onboardingRouter.get("/tours/plan", (_req, res) => {
  res.json(ROOM_PLAN);
});

onboardingRouter.get("/tours/pieces", (_req, res) => {
  res.json(LAYOUT_PIECES);
});
