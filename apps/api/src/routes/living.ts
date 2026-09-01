import { Router } from "express";
import {
  DIET_TAG_LABELS,
  LAUNDRY_SERVICE_LABELS,
  MEAL_LABELS,
  type DietTag,
  type LaundryService,
  type MealType,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import {
  HOUSEKEEPING_SERVICES,
  HOUSEKEEPING_SLOTS,
  LAUNDRY_PLANS,
} from "../data/catalog";
import * as living from "../data/living";
import { isoDate } from "../data/db";

export const diningRouter: Router = Router();
export const housekeepingRouter: Router = Router();
export const amenitiesRouter: Router = Router();

function pathParam(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.badRequest(`Missing ${what}.`);
  }
  return value;
}

function requireDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw HttpError.badRequest(`${field} must be a date like 2026-09-01.`);
  }
  return value;
}

function requireMeal(value: unknown): MealType {
  if (typeof value !== "string" || !(value in MEAL_LABELS)) {
    throw HttpError.badRequest("Which meal?");
  }
  return value as MealType;
}

/* ------------------------------------------------------------------ menu */

diningRouter.get("/menu", async (req, res) => {
  const from =
    typeof req.query.from === "string" ? req.query.from : isoDate(new Date());
  const days = Math.min(Number(req.query.days ?? 7) || 7, 14);

  res.json(await living.getMenu(residentIdOf(req), from, days));
});

diningRouter.get("/diet", async (req, res) => {
  res.json(await living.getDiet(residentIdOf(req)));
});

diningRouter.put("/diet", async (req, res) => {
  const body = req.body as { tags?: unknown; allergies?: unknown };
  const tags = Array.isArray(body.tags) ? body.tags : [];

  for (const tag of tags) {
    if (typeof tag !== "string" || !(tag in DIET_TAG_LABELS)) {
      throw HttpError.badRequest(`"${String(tag)}" isn't a dietary option.`);
    }
  }

  res.json(
    await living.saveDiet(
      residentIdOf(req),
      tags as DietTag[],
      typeof body.allergies === "string" ? body.allergies.trim() : ""
    )
  );
});

/* --------------------------------------------------------- meal ratings */

diningRouter.get("/ratings/mine", async (req, res) => {
  res.json(await living.myRatings(residentIdOf(req)));
});

diningRouter.post("/ratings", async (req, res) => {
  const body = req.body as {
    date?: unknown;
    meal?: unknown;
    rating?: unknown;
    remarks?: unknown;
  };

  const date = requireDate(body.date, "Date");
  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw HttpError.badRequest("Rate the meal between 1 and 5.");
  }
  // Rating tomorrow's dinner would be meaningless and would skew the vendor
  // score, so only meals that have actually been served can be rated.
  if (date > isoDate(new Date())) {
    throw HttpError.badRequest("You can only rate a meal after it's served.");
  }

  res.status(201).json(
    await living.rateMeal(residentIdOf(req), {
      date,
      meal: requireMeal(body.meal),
      rating,
      remarks: typeof body.remarks === "string" ? body.remarks.trim() : "",
    })
  );
});

/* ------------------------------------------------------------ guest meals */

diningRouter.get("/guest-meals", async (req, res) => {
  res.json(await living.listGuestMeals(residentIdOf(req)));
});

diningRouter.post("/guest-meals", async (req, res) => {
  const body = req.body as { date?: unknown; meal?: unknown; guests?: unknown };

  const date = requireDate(body.date, "Date");
  const guests = Number(body.guests);

  if (!Number.isInteger(guests) || guests < 1 || guests > 6) {
    throw HttpError.badRequest("Book between 1 and 6 guests.");
  }

  // The mess plans quantities a day ahead, so same-day guests can't be added.
  const tomorrow = isoDate(new Date(Date.now() + 86_400_000));
  if (date < tomorrow) {
    throw HttpError.badRequest(
      "Guest meals need a day's notice so the mess can cook for them."
    );
  }

  res.status(201).json(
    await living.bookGuestMeal(residentIdOf(req), {
      date,
      meal: requireMeal(body.meal),
      guests,
    })
  );
});

diningRouter.delete("/guest-meals/:id", async (req, res) => {
  const cancelled = await living.cancelGuestMeal(
    residentIdOf(req),
    pathParam(req.params.id, "booking id")
  );
  if (!cancelled) {
    throw HttpError.notFound("That booking doesn't exist or is already done.");
  }
  res.json(cancelled);
});

/* --------------------------------------------------- laundry subscription */

export const laundryExtrasRouter: Router = Router();

laundryExtrasRouter.get("/plans", (_req, res) => {
  res.json(LAUNDRY_PLANS);
});

laundryExtrasRouter.get("/subscription", async (req, res) => {
  res.json(await living.getSubscription(residentIdOf(req)));
});

laundryExtrasRouter.post("/subscription", async (req, res) => {
  const body = req.body as {
    plan?: unknown;
    service?: unknown;
    pickupDay?: unknown;
  };

  if (
    typeof body.plan !== "string" ||
    !LAUNDRY_PLANS.some((p) => p.plan === body.plan)
  ) {
    throw HttpError.badRequest("Choose one of the plans.");
  }
  if (
    typeof body.service !== "string" ||
    !(body.service in LAUNDRY_SERVICE_LABELS)
  ) {
    throw HttpError.badRequest("Choose a service.");
  }

  const day = Number(body.pickupDay);
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    throw HttpError.badRequest("Pick a collection day.");
  }

  res.status(201).json(
    await living.subscribeLaundry(residentIdOf(req), {
      plan: body.plan,
      service: body.service as LaundryService,
      pickupDay: day,
    })
  );
});

laundryExtrasRouter.post("/subscription/pause", async (req, res) => {
  const { resume } = req.body as { resume?: boolean };
  const updated = await living.setSubscriptionStatus(
    residentIdOf(req),
    resume === true ? "active" : "paused"
  );
  if (!updated) throw HttpError.notFound("You don't have a laundry plan.");
  res.json(updated);
});

laundryExtrasRouter.delete("/subscription", async (req, res) => {
  await living.setSubscriptionStatus(residentIdOf(req), "cancelled");
  res.status(204).end();
});

/* ---------------------------------------------------------- housekeeping */

housekeepingRouter.get("/services", (_req, res) => {
  res.json(HOUSEKEEPING_SERVICES);
});

housekeepingRouter.get("/slots", async (req, res) => {
  const date = requireDate(req.query.date, "Date");
  const taken = await living.housekeepingTaken(residentIdOf(req), date);

  res.json(
    HOUSEKEEPING_SLOTS.map((slot) => ({
      slot,
      available: !taken.includes(slot),
    }))
  );
});

housekeepingRouter.get("/bookings", async (req, res) => {
  res.json(await living.listHousekeeping(residentIdOf(req)));
});

housekeepingRouter.post("/bookings", async (req, res) => {
  const body = req.body as {
    serviceId?: unknown;
    date?: unknown;
    slot?: unknown;
    notes?: unknown;
  };

  const service = HOUSEKEEPING_SERVICES.find((s) => s.id === body.serviceId);
  if (!service) throw HttpError.badRequest("Choose a service.");

  const date = requireDate(body.date, "Date");
  if (date < isoDate(new Date())) {
    throw HttpError.badRequest("Pick today or a future date.");
  }
  if (typeof body.slot !== "string" || !HOUSEKEEPING_SLOTS.includes(body.slot)) {
    throw HttpError.badRequest("Choose one of the available slots.");
  }

  const taken = await living.housekeepingTaken(residentIdOf(req), date);
  if (taken.includes(body.slot)) {
    throw HttpError.badRequest("You already have a booking in that slot.");
  }

  res.status(201).json(
    await living.bookHousekeeping(residentIdOf(req), {
      serviceId: service.id,
      date,
      slot: body.slot,
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
    })
  );
});

housekeepingRouter.delete("/bookings/:id", async (req, res) => {
  const ok = await living.cancelHousekeeping(
    residentIdOf(req),
    pathParam(req.params.id, "booking id")
  );
  if (!ok) {
    throw HttpError.notFound("That booking doesn't exist or has already run.");
  }
  res.status(204).end();
});

/* -------------------------------------------------------------- amenities */

amenitiesRouter.get("/", async (_req, res) => {
  res.json(await living.listAmenities());
});

amenitiesRouter.get("/bookings", async (req, res) => {
  res.json(await living.myAmenityBookings(residentIdOf(req)));
});

amenitiesRouter.post("/bookings", async (req, res) => {
  const body = req.body as {
    amenityId?: unknown;
    date?: unknown;
    startTime?: unknown;
  };

  const date = requireDate(body.date, "Date");
  if (date < isoDate(new Date())) {
    throw HttpError.badRequest("Pick today or a future date.");
  }
  if (typeof body.startTime !== "string") {
    throw HttpError.badRequest("Choose a time slot.");
  }

  const result = await living.bookAmenity(
    residentIdOf(req),
    pathParam(body.amenityId, "amenity"),
    date,
    body.startTime
  );

  if (!result.ok) {
    if (result.reason === "unknown") {
      throw HttpError.notFound("We couldn't find that space.");
    }
    if (result.reason === "closed") {
      throw HttpError.badRequest("That space isn't open at that time.");
    }
    if (result.reason === "duplicate") {
      throw HttpError.badRequest("You've already booked that slot.");
    }
    throw new HttpError(
      409,
      "slot_full",
      "Someone just took the last place in that slot. Pick another."
    );
  }

  res.status(201).json(result.booking);
});

amenitiesRouter.delete("/bookings/:id", async (req, res) => {
  const ok = await living.cancelAmenityBooking(
    residentIdOf(req),
    pathParam(req.params.id, "booking id")
  );
  if (!ok) throw HttpError.notFound("We couldn't find that booking.");
  res.status(204).end();
});

amenitiesRouter.get("/:id/availability", async (req, res) => {
  const date = requireDate(req.query.date, "Date");
  const found = await living.availability(
    residentIdOf(req),
    pathParam(req.params.id, "amenity id"),
    date
  );
  if (!found) throw HttpError.notFound("We couldn't find that space.");
  res.json(found);
});
