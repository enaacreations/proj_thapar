import { Router } from "express";
import {
  RELATION_LABELS,
  type CreateVisitBody,
  type VisitorRelation,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import * as db from "../data/db";

export const visitsRouter: Router = Router();

visitsRouter.get("/", async (req, res) => {
  res.json(await db.listVisits(residentIdOf(req)));
});

visitsRouter.post("/", async (req, res) => {
  const body = req.body as Partial<CreateVisitBody>;

  if (typeof body.visitorName !== "string" || body.visitorName.trim() === "") {
    throw HttpError.badRequest("Enter the visitor's name.");
  }
  if (typeof body.relation !== "string" || !(body.relation in RELATION_LABELS)) {
    throw HttpError.badRequest("Pick how the visitor is related to you.");
  }
  if (typeof body.visitDate !== "string") {
    throw HttpError.badRequest("Pick a visit date.");
  }

  const visitDate = new Date(body.visitDate);
  if (Number.isNaN(visitDate.getTime())) {
    throw HttpError.badRequest("That visit date isn't valid.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (visitDate < today) {
    throw HttpError.badRequest("Visits can only be booked for future dates.");
  }

  const durationHours = Number(body.durationHours ?? 0);
  if (!Number.isFinite(durationHours) || durationHours < 1) {
    throw HttpError.badRequest("How long is the visit? Enter at least 1 hour.");
  }

  const foodRequired = body.foodRequired === true;
  const foodSelections = foodRequired ? (body.foodSelections ?? []) : [];

  // Mess needs a day's notice to add a plate, so food must be picked in advance.
  if (foodRequired && foodSelections.length > 0) {
    const cutoff = new Date(visitDate);
    cutoff.setDate(cutoff.getDate() - 1);
    if (today > cutoff) {
      throw HttpError.badRequest(
        "Food for a visit has to be chosen at least one day before. You can still book the visit without food."
      );
    }
  }

  const relation = body.relation as VisitorRelation;
  const visitorName = body.visitorName.trim();

  const created = await db.createVisit(residentIdOf(req), {
    title: `${visitorName} · ${RELATION_LABELS[relation]}`,
    visitorName,
    relation,
    visitDate: body.visitDate,
    durationHours: Math.round(durationHours),
    foodRequired,
    foodSelections,
  });

  res.status(201).json(created);
});

visitsRouter.get("/:id", async (req, res) => {
  const found = await db.getVisit(residentIdOf(req), req.params.id);
  if (!found) throw HttpError.notFound("We couldn't find that visit request.");
  res.json(found);
});
