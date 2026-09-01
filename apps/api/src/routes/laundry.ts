import { Router } from "express";
import {
  CLOTHING_LABELS,
  LAUNDRY_SERVICE_LABELS,
  type ClothingType,
  type CreateLaundryBody,
  type LaundryItem,
  type LaundryService,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import { LAUNDRY_SLOTS } from "../data/catalog";
import * as db from "../data/db";
import { photoList } from "./helpers";

export const laundryRouter: Router = Router();

laundryRouter.get("/slots", (_req, res) => {
  res.json(LAUNDRY_SLOTS);
});

laundryRouter.get("/", async (req, res) => {
  res.json(await db.listLaundry(residentIdOf(req)));
});

function parseItems(value: unknown): LaundryItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw HttpError.badRequest("Add at least one item to the bag.");
  }

  return value.map((raw) => {
    const item = raw as Partial<LaundryItem>;
    if (typeof item.type !== "string" || !(item.type in CLOTHING_LABELS)) {
      throw HttpError.badRequest("One of the clothing types isn't recognised.");
    }
    if (typeof item.count !== "number" || item.count < 1) {
      throw HttpError.badRequest("Each item needs a count of at least 1.");
    }
    return {
      type: item.type as ClothingType,
      count: Math.floor(item.count),
      pressing: item.pressing === true,
    };
  });
}

laundryRouter.post("/", async (req, res) => {
  const body = req.body as Partial<CreateLaundryBody>;

  const items = parseItems(body.items);
  const totalPieces = items.reduce((sum, i) => sum + i.count, 0);

  if (typeof body.pickupSlot !== "string" || body.pickupSlot.length === 0) {
    throw HttpError.badRequest("Choose a pickup slot.");
  }

  const photos = photoList(body.photoUris);
  if (photos.length === 0) {
    throw HttpError.badRequest(
      "Take a photo of the clothes before handing them over. It protects you if anything goes missing."
    );
  }

  const service =
    typeof (body as { service?: unknown }).service === "string" &&
    (body as { service: string }).service in LAUNDRY_SERVICE_LABELS
      ? ((body as { service: string }).service as LaundryService)
      : "wash_fold";

  const created = await db.createLaundry(residentIdOf(req), {
    title: `${totalPieces} ${totalPieces === 1 ? "piece" : "pieces"} · ${LAUNDRY_SERVICE_LABELS[service]}`,
    service,
    items,
    totalPieces,
    pickupSlot: body.pickupSlot,
    photoUris: photos,
  });

  res.status(201).json(created);
});

laundryRouter.get("/:id", async (req, res) => {
  const found = await db.getLaundry(residentIdOf(req), req.params.id);
  if (!found) throw HttpError.notFound("We couldn't find that laundry request.");
  res.json(found);
});
