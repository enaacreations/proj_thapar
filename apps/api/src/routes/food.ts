import { Router } from "express";
import {
  MEAL_TYPES,
  type DayMenu,
  type MealType,
  type PauseFoodBody,
  type SetMealBookingBody,
  type UpdateFoodPlanBody,
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

function requireMeal(value: unknown): MealType {
  if (typeof value !== "string" || !MEAL_TYPES.includes(value as MealType)) {
    throw HttpError.badRequest("Which meal?");
  }
  return value as MealType;
}

function requireDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw HttpError.badRequest(`${field} must be a date like 2026-09-01.`);
  }
  return value;
}

/* -------------------------------------------------------- recurring plan */

foodRouter.get("/preferences", async (req, res) => {
  res.json(await db.getFoodPreferences(residentIdOf(req)));
});

/**
 * Changes the recurring plan. Both fields are optional and independent: you
 * can adjust which meals a plan covers without switching it on, and switching
 * it on doesn't pick meals for anyone.
 */
foodRouter.patch("/preferences", async (req, res) => {
  const { recurring, meals } = req.body as Partial<UpdateFoodPlanBody>;

  if (recurring !== undefined && typeof recurring !== "boolean") {
    throw HttpError.badRequest("`recurring` must be true or false.");
  }
  if (recurring === undefined && (typeof meals !== "object" || meals === null)) {
    throw HttpError.badRequest(
      "Send `recurring`, or a `meals` object like { lunch: false }."
    );
  }

  const patch: Partial<Record<MealType, boolean>> = {};
  for (const [key, value] of Object.entries(meals ?? {})) {
    if (!MEAL_TYPES.includes(key as MealType)) {
      throw HttpError.badRequest(`"${key}" is not a meal.`);
    }
    if (typeof value !== "boolean") {
      throw HttpError.badRequest(`"${key}" must be true or false.`);
    }
    patch[key as MealType] = value;
  }

  // A plan covering nothing is a plan that does nothing, and it would read on
  // screen as "you're on the mess plan" while booking no meals at all.
  const next = { ...(await db.getFoodPreferences(residentIdOf(req))).optIn, ...patch };
  if (recurring === true && !MEAL_TYPES.some((m) => next[m])) {
    throw HttpError.badRequest(
      "Pick at least one meal for the plan to cover."
    );
  }

  res.json(await db.updateFoodPlan(residentIdOf(req), { recurring, meals: patch }));
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

/* ------------------------------------------------------- day-by-day meals */

foodRouter.get("/bookings", async (req, res) => {
  const from =
    typeof req.query.from === "string"
      ? requireDate(req.query.from, "`from`")
      : db.isoDate(new Date());
  const days = Math.min(Number(req.query.days ?? 7) || 7, 14);

  res.json(await db.getMealBookings(residentIdOf(req), from, days));
});

foodRouter.put("/bookings", async (req, res) => {
  const body = req.body as Partial<SetMealBookingBody>;

  const date = requireDate(body.date, "Date");
  const meal = requireMeal(body.meal);

  if (typeof body.booked !== "boolean") {
    throw HttpError.badRequest("`booked` must be true or false.");
  }
  // The mess has already cooked. Changing a past day would only make the
  // record disagree with what was served.
  if (date < db.isoDate(new Date())) {
    throw HttpError.badRequest("That day has already been and gone.");
  }

  res.json(
    await db.setMealBooking(residentIdOf(req), date, meal, body.booked)
  );
});
