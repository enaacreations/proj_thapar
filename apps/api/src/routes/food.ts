import { Router } from "express";
import {
  MEAL_TYPES,
  type DayMenu,
  type MealType,
  type PauseFoodBody,
  type UpdateMealOptInBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import { menuForDate } from "../data/catalog";
import * as db from "../data/db";

export const foodRouter: Router = Router();

/** Returns `days` menus starting at `from` (default today) for the week strip. */
foodRouter.get("/menu", (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const days = Math.min(Number(req.query.days ?? 7) || 7, 14);

  const start = from ? new Date(from) : new Date();
  if (Number.isNaN(start.getTime())) {
    throw HttpError.badRequest("`from` must be a date like 2026-09-01.");
  }

  const body: DayMenu[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return menuForDate(db.isoDate(d));
  });

  res.json(body);
});

foodRouter.get("/preferences", async (req, res) => {
  res.json(await db.getFoodPreferences(residentIdOf(req)));
});

foodRouter.patch("/preferences", async (req, res) => {
  const { meals } = req.body as Partial<UpdateMealOptInBody>;

  if (typeof meals !== "object" || meals === null) {
    throw HttpError.badRequest("Send a `meals` object, e.g. { lunch: false }.");
  }

  const patch: Partial<Record<MealType, boolean>> = {};
  for (const [key, value] of Object.entries(meals)) {
    if (!MEAL_TYPES.includes(key as MealType)) {
      throw HttpError.badRequest(`"${key}" is not a meal.`);
    }
    if (typeof value !== "boolean") {
      throw HttpError.badRequest(`"${key}" must be true or false.`);
    }
    patch[key as MealType] = value;
  }

  res.json(await db.updateMeals(residentIdOf(req), patch));
});

foodRouter.post("/pause", async (req, res) => {
  const { from, to } = req.body as Partial<PauseFoodBody>;

  if (typeof from !== "string" || typeof to !== "string") {
    throw HttpError.badRequest("Pick a start and end date for the pause.");
  }
  if (new Date(to) < new Date(from)) {
    throw HttpError.badRequest("The end date can't be before the start date.");
  }

  res.json(await db.setFoodPause(residentIdOf(req), from, to));
});

foodRouter.delete("/pause", async (req, res) => {
  res.json(await db.setFoodPause(residentIdOf(req), null, null));
});
