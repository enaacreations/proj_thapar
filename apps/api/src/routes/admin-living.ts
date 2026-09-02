import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  DIET_TAG_LABELS,
  LAUNDRY_PIPELINE,
  LAUNDRY_STAGE_LABELS,
  MEAL_LABELS,
  type AdminBookingRow,
  type AdminLaundryRow,
  type DietTag,
  type LaundryStage,
  type MealHeadcount,
  type MealType,
  type UpsertMenuBody,
} from "@proj/shared";
import { HttpError } from "../http-error";
import { db } from "../db/client";
import * as t from "../db/schema";
import * as living from "../data/living";
import { isoDate, mealHeadcount } from "../data/db";

export const adminLivingRouter: Router = Router();

function pathParam(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw HttpError.badRequest(`Missing ${what}.`);
  }
  return value;
}

/* --------------------------------------------------------- meal headcount */

/**
 * What the kitchen should cook. This is the number the day-by-day booking
 * exists to produce — without it, "which meals do you want" is a question
 * nobody acts on.
 */
adminLivingRouter.get("/dining/counts", async (req, res) => {
  const date =
    typeof req.query.date === "string" ? req.query.date : isoDate(new Date());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw HttpError.badRequest("`date` must look like 2026-09-01.");
  }

  const counts = await mealHeadcount(date);
  const body: MealHeadcount = {
    date,
    counts: (Object.keys(MEAL_LABELS) as MealType[]).map((meal) => ({
      meal,
      residents: counts[meal],
    })),
  };

  res.json(body);
});

/* ------------------------------------------------------------ menu editor */

adminLivingRouter.put("/dining/menu", async (req, res) => {
  const body = req.body as Partial<UpsertMenuBody>;

  if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw HttpError.badRequest("Which date is this menu for?");
  }
  if (typeof body.meal !== "string" || !(body.meal in MEAL_LABELS)) {
    throw HttpError.badRequest("Which meal?");
  }
  if (typeof body.servingWindow !== "string" || body.servingWindow.length < 3) {
    throw HttpError.badRequest("Enter the serving times.");
  }

  const dishes = Array.isArray(body.dishes) ? body.dishes : [];
  for (const dish of dishes) {
    if (typeof dish?.name !== "string" || dish.name.trim().length === 0) {
      throw HttpError.badRequest("Every dish needs a name.");
    }
    for (const tag of dish.tags ?? []) {
      if (!(tag in DIET_TAG_LABELS)) {
        throw HttpError.badRequest(`"${tag}" isn't a dietary tag.`);
      }
    }
  }

  await living.upsertMenuMeal({
    date: body.date,
    meal: body.meal as MealType,
    servingWindow: body.servingWindow,
    published: body.published !== false,
    dishes: dishes.map((d) => ({
      name: d.name.trim(),
      tags: (d.tags ?? []) as DietTag[],
    })),
  });

  res.status(201).json({ ok: true });
});

adminLivingRouter.get("/dining/sla", async (_req, res) => {
  res.json(await living.vendorSla());
});

adminLivingRouter.get("/dining/guest-meals", async (_req, res) => {
  const rows = await db
    .select({
      booking: t.guestMeals,
      residentName: t.residents.fullName,
      roomNumber: t.rooms.roomNumber,
    })
    .from(t.guestMeals)
    .innerJoin(t.residents, eq(t.guestMeals.residentId, t.residents.id))
    .leftJoin(t.rooms, eq(t.guestMeals.residentId, t.rooms.residentId))
    .where(eq(t.guestMeals.status, "booked"))
    .orderBy(t.guestMeals.date);

  const body: AdminBookingRow[] = rows.map(({ booking, residentName, roomNumber }) => ({
    id: booking.id,
    residentId: booking.residentId,
    residentName,
    roomNumber,
    title: `${booking.guests} guest${booking.guests === 1 ? "" : "s"} · ${MEAL_LABELS[booking.meal]}`,
    date: booking.date,
    slot: MEAL_LABELS[booking.meal],
    status: "booked",
  }));

  res.json(body);
});

/* ------------------------------------------------------------ laundry ops */

adminLivingRouter.get("/laundry/board", async (_req, res) => {
  const rows = await db
    .select({
      request: t.laundryRequests,
      residentName: t.residents.fullName,
      roomNumber: t.rooms.roomNumber,
    })
    .from(t.laundryRequests)
    .innerJoin(t.residents, eq(t.laundryRequests.residentId, t.residents.id))
    .leftJoin(t.rooms, eq(t.laundryRequests.residentId, t.rooms.residentId))
    .orderBy(desc(t.laundryRequests.createdAt));

  const body: AdminLaundryRow[] = rows.map(({ request, residentName, roomNumber }) => ({
    id: request.id,
    residentId: request.residentId,
    residentName,
    roomNumber,
    service: request.service,
    stage: request.stage,
    totalPieces: request.totalPieces,
    pickupSlot: request.pickupSlot,
    createdAt: request.createdAt.toISOString(),
  }));

  res.json(body);
});

adminLivingRouter.post("/laundry/:id/stage", async (req, res) => {
  const id = pathParam(req.params.id, "laundry id");
  const { stage, note } = req.body as { stage?: unknown; note?: unknown };

  if (typeof stage !== "string" || !(stage in LAUNDRY_STAGE_LABELS)) {
    throw HttpError.badRequest(
      `Stage must be one of: ${LAUNDRY_PIPELINE.join(", ")}.`
    );
  }

  const [current] = await db
    .select({ stage: t.laundryRequests.stage })
    .from(t.laundryRequests)
    .where(eq(t.laundryRequests.id, id))
    .limit(1);

  if (!current) throw HttpError.notFound("We couldn't find that bag.");

  // The pipeline only runs forwards; a bag that's been delivered can't go back
  // to "washing" because someone clicked the wrong row.
  if (stage !== "cancelled") {
    const from = LAUNDRY_PIPELINE.indexOf(current.stage as LaundryStage);
    const to = LAUNDRY_PIPELINE.indexOf(stage as LaundryStage);

    if (from === -1) {
      throw HttpError.badRequest("This bag is cancelled.");
    }
    if (to <= from) {
      throw HttpError.badRequest(
        `It's already at "${LAUNDRY_STAGE_LABELS[current.stage as LaundryStage]}". Laundry only moves forward.`
      );
    }
  }

  const ok = await living.setLaundryStage(
    id,
    stage as LaundryStage,
    typeof note === "string" && note.trim()
      ? note.trim()
      : LAUNDRY_STAGE_LABELS[stage as LaundryStage]
  );

  if (!ok) throw HttpError.notFound("We couldn't find that bag.");
  res.json({ ok: true, stage });
});

/* --------------------------------------------------------------- bookings */

adminLivingRouter.get("/housekeeping/bookings", async (_req, res) => {
  const rows = await db
    .select({
      booking: t.housekeepingBookings,
      residentName: t.residents.fullName,
      roomNumber: t.rooms.roomNumber,
    })
    .from(t.housekeepingBookings)
    .innerJoin(
      t.residents,
      eq(t.housekeepingBookings.residentId, t.residents.id)
    )
    .leftJoin(t.rooms, eq(t.housekeepingBookings.residentId, t.rooms.residentId))
    .where(inArray(t.housekeepingBookings.status, ["booked", "in_progress"]))
    .orderBy(t.housekeepingBookings.date);

  const body: AdminBookingRow[] = rows.map(({ booking, residentName, roomNumber }) => ({
    id: booking.id,
    residentId: booking.residentId,
    residentName,
    roomNumber,
    title: booking.serviceName,
    date: booking.date,
    slot: booking.slot,
    status: booking.status,
  }));

  res.json(body);
});

adminLivingRouter.post("/housekeeping/bookings/:id", async (req, res) => {
  const id = pathParam(req.params.id, "booking id");
  const { status } = req.body as { status?: unknown };

  if (status !== "in_progress" && status !== "done" && status !== "cancelled") {
    throw HttpError.badRequest("Status must be in_progress, done or cancelled.");
  }

  const rows = await db
    .update(t.housekeepingBookings)
    .set({ status })
    .where(
      and(
        eq(t.housekeepingBookings.id, id),
        inArray(t.housekeepingBookings.status, ["booked", "in_progress"])
      )
    )
    .returning({ id: t.housekeepingBookings.id });

  if (rows.length === 0) {
    throw HttpError.badRequest("That booking is already closed.");
  }
  res.json({ ok: true, status });
});

adminLivingRouter.get("/amenities/bookings", async (_req, res) => {
  const rows = await db
    .select({
      booking: t.amenityBookings,
      amenityName: t.amenities.name,
      residentName: t.residents.fullName,
      roomNumber: t.rooms.roomNumber,
    })
    .from(t.amenityBookings)
    .innerJoin(t.amenities, eq(t.amenityBookings.amenityId, t.amenities.id))
    .innerJoin(t.residents, eq(t.amenityBookings.residentId, t.residents.id))
    .leftJoin(t.rooms, eq(t.amenityBookings.residentId, t.rooms.residentId))
    .orderBy(desc(t.amenityBookings.date), t.amenityBookings.startTime);

  const body: AdminBookingRow[] = rows.map(
    ({ booking, amenityName, residentName, roomNumber }) => ({
      id: booking.id,
      residentId: booking.residentId,
      residentName,
      roomNumber,
      title: amenityName,
      date: booking.date,
      slot: `${booking.startTime} – ${booking.endTime}`,
      status: booking.status,
    })
  );

  res.json(body);
});
