import { Router } from "express";
import type { CreateFeedbackBody } from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import { FEEDBACK_CATEGORIES } from "../data/catalog";
import * as db from "../data/db";
import { photoList, resolveCategory } from "./helpers";

export const feedbackRouter: Router = Router();

feedbackRouter.get("/categories", (_req, res) => {
  res.json(FEEDBACK_CATEGORIES);
});

feedbackRouter.get("/", async (req, res) => {
  res.json(await db.listFeedback(residentIdOf(req)));
});

feedbackRouter.post("/", async (req, res) => {
  const body = req.body as Partial<CreateFeedbackBody>;
  const category = resolveCategory(
    FEEDBACK_CATEGORIES,
    body.categoryId,
    body.subCategoryId
  );

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw HttpError.badRequest("Give a rating between 1 and 5 stars.");
  }

  const created = await db.createFeedback(residentIdOf(req), {
    ...category,
    rating,
    remarks: typeof body.remarks === "string" ? body.remarks.trim() : "",
    photoUris: photoList(body.photoUris),
  });

  res.status(201).json(created);
});
