import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  LAUNDRY_STAGE_STATUS,
  MEAL_LABELS,
  MEAL_TYPES,
  type Amenity,
  type AmenityAvailability,
  type AmenityBooking,
  type AmenitySlot,
  type DietPreference,
  type DietTag,
  type GuestMeal,
  type HousekeepingBooking,
  type LaundryService,
  type LaundryStage,
  type LaundrySubscription,
  type MealRating,
  type MealType,
  type MenuDay,
  type MenuMeal,
  type VendorSla,
} from "@proj/shared";
import { db } from "../db/client";
import * as t from "../db/schema";
import { isoDate, nextId } from "./db";
import {
  AMENITY_SEED,
  GUEST_MEAL_PRICES,
  HOUSEKEEPING_SERVICES,
  LAUNDRY_PLANS,
  MESS_SLA_TARGET,
  MESS_SLA_WINDOW_DAYS,
  menuForDate,
} from "./catalog";

const iso = (d: Date) => d.toISOString();

const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

/* ---------------------------------------------------------------- dietary */

export async function getDiet(residentId: string): Promise<DietPreference> {
  const [row] = await db
    .select()
    .from(t.dietPreferences)
    .where(eq(t.dietPreferences.residentId, residentId))
    .limit(1);

  return {
    tags: (row?.tags ?? []) as DietTag[],
    allergies: row?.allergies ?? "",
    updatedAt: row ? iso(row.updatedAt) : null,
  };
}

export async function saveDiet(
  residentId: string,
  tags: DietTag[],
  allergies: string
): Promise<DietPreference> {
  await db
    .insert(t.dietPreferences)
    .values({ residentId, tags, allergies, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: t.dietPreferences.residentId,
      set: { tags, allergies, updatedAt: new Date() },
    });
  return getDiet(residentId);
}

/* ------------------------------------------------------------------- menu */

/**
 * Seeds a day from the code rotation the first time it's asked for, so the
 * menu is never empty before anyone has used the editor. Once a day exists in
 * the database, the editor is the only thing that changes it.
 */
async function ensureDay(date: string): Promise<void> {
  const existing = await db
    .select({ id: t.menuMeals.id })
    .from(t.menuMeals)
    .where(eq(t.menuMeals.date, date))
    .limit(1);
  if (existing.length > 0) return;

  const fallback = menuForDate(date);

  for (const meal of MEAL_TYPES) {
    const id = `MNU-${date}-${meal}`;
    await db
      .insert(t.menuMeals)
      .values({
        id,
        date,
        meal,
        servingWindow: fallback.meals[meal].servingWindow,
        published: true,
      })
      .onConflictDoNothing();

    const dishes = fallback.meals[meal].items.map((item, i) => ({
      id: `${id}-${i}`,
      mealId: id,
      name: item.name,
      // The old rotation only knew veg vs not; treat that as the base tag.
      tags: item.veg ? ["veg"] : ["non_veg"],
      position: i,
    }));

    if (dishes.length > 0) {
      await db.insert(t.menuDishes).values(dishes).onConflictDoNothing();
    }
  }
}

/** A dish matches only if it carries every tag the resident filters on. */
function matches(dishTags: string[], wanted: DietTag[]): boolean {
  if (wanted.length === 0) return true;
  return wanted.every((tag) => dishTags.includes(tag));
}

export async function getMenu(
  residentId: string,
  from: string,
  days: number
): Promise<MenuDay[]> {
  const dates = Array.from({ length: days }, (_, i) =>
    isoDate(addDays(new Date(from), i))
  );

  for (const date of dates) await ensureDay(date);

  const diet = await getDiet(residentId);

  const meals = await db
    .select()
    .from(t.menuMeals)
    .where(inArray(t.menuMeals.date, dates));

  const dishes = meals.length
    ? await db
        .select()
        .from(t.menuDishes)
        .where(
          inArray(
            t.menuDishes.mealId,
            meals.map((m) => m.id)
          )
        )
        .orderBy(t.menuDishes.position)
    : [];

  const ratings = await db
    .select()
    .from(t.mealRatings)
    .where(
      and(
        eq(t.mealRatings.residentId, residentId),
        inArray(t.mealRatings.date, dates)
      )
    );

  return dates.map((date) => {
    const dayMeals: MenuMeal[] = MEAL_TYPES.map((meal) => {
      const row = meals.find((m) => m.date === date && m.meal === meal);
      if (!row) {
        return { meal, servingWindow: "", published: false, dishes: [] };
      }

      return {
        meal,
        servingWindow: row.servingWindow,
        published: row.published,
        dishes: dishes
          .filter((d) => d.mealId === row.id)
          .map((d) => ({
            id: d.id,
            name: d.name,
            tags: d.tags as DietTag[],
            matchesDiet: matches(d.tags, diet.tags),
          })),
      };
    });

    return {
      date,
      meals: dayMeals,
      ratings: ratings
        .filter((r) => r.date === date)
        .map((r) => ({ meal: r.meal, rating: r.rating })),
    };
  });
}

export async function upsertMenuMeal(input: {
  date: string;
  meal: MealType;
  servingWindow: string;
  published: boolean;
  dishes: { name: string; tags: DietTag[] }[];
}): Promise<void> {
  const id = `MNU-${input.date}-${input.meal}`;

  await db
    .insert(t.menuMeals)
    .values({
      id,
      date: input.date,
      meal: input.meal,
      servingWindow: input.servingWindow,
      published: input.published,
    })
    .onConflictDoUpdate({
      target: [t.menuMeals.date, t.menuMeals.meal],
      set: { servingWindow: input.servingWindow, published: input.published },
    });

  // Replace wholesale: the editor always sends the full list for that meal.
  await db.delete(t.menuDishes).where(eq(t.menuDishes.mealId, id));

  if (input.dishes.length > 0) {
    await db.insert(t.menuDishes).values(
      input.dishes.map((dish, i) => ({
        id: `${id}-${i}-${randomUUID().slice(0, 8)}`,
        mealId: id,
        name: dish.name,
        tags: dish.tags,
        position: i,
      }))
    );
  }
}

/* ---------------------------------------------------------- meal ratings */

export async function rateMeal(
  residentId: string,
  input: { date: string; meal: MealType; rating: number; remarks: string }
): Promise<MealRating> {
  const id = await nextId("MRT");

  // One rating per resident per meal — re-rating updates rather than stacking,
  // so nobody can swing the vendor score by rating repeatedly.
  const [row] = await db
    .insert(t.mealRatings)
    .values({ ...input, id, residentId })
    .onConflictDoUpdate({
      target: [t.mealRatings.residentId, t.mealRatings.date, t.mealRatings.meal],
      set: { rating: input.rating, remarks: input.remarks },
    })
    .returning();

  const r = row as typeof t.mealRatings.$inferSelect;
  return {
    id: r.id,
    date: r.date,
    meal: r.meal,
    rating: r.rating,
    remarks: r.remarks,
    createdAt: iso(r.createdAt),
  };
}

export async function myRatings(residentId: string): Promise<MealRating[]> {
  const rows = await db
    .select()
    .from(t.mealRatings)
    .where(eq(t.mealRatings.residentId, residentId))
    .orderBy(desc(t.mealRatings.date));

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    meal: r.meal,
    rating: r.rating,
    remarks: r.remarks,
    createdAt: iso(r.createdAt),
  }));
}

/** Rolling quality score the mess vendor is measured against. */
export async function vendorSla(): Promise<VendorSla> {
  const since = isoDate(addDays(new Date(), -MESS_SLA_WINDOW_DAYS));

  const rows = await db
    .select()
    .from(t.mealRatings)
    .where(gte(t.mealRatings.date, since));

  const mean = (values: number[]) =>
    values.length === 0
      ? null
      : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

  const average = mean(rows.map((r) => r.rating));

  const byMeal = MEAL_TYPES.map((meal) => {
    const forMeal = rows.filter((r) => r.rating != null && r.meal === meal);
    return {
      meal,
      average: mean(forMeal.map((r) => r.rating)),
      count: forMeal.length,
    };
  });

  // Which dishes were on the plate when people rated badly — the actionable
  // part for the vendor, rather than just a headline number.
  const badDays = rows.filter((r) => r.rating <= 2);
  const worstDishes: { name: string; average: number; count: number }[] = [];

  if (badDays.length > 0) {
    const mealIds = badDays.map((r) => `MNU-${r.date}-${r.meal}`);
    const dishes = await db
      .select({ mealId: t.menuDishes.mealId, name: t.menuDishes.name })
      .from(t.menuDishes)
      .where(inArray(t.menuDishes.mealId, mealIds));

    const tally = new Map<string, number[]>();
    for (const rating of badDays) {
      const key = `MNU-${rating.date}-${rating.meal}`;
      for (const dish of dishes.filter((d) => d.mealId === key)) {
        tally.set(dish.name, [...(tally.get(dish.name) ?? []), rating.rating]);
      }
    }

    for (const [name, values] of tally) {
      worstDishes.push({
        name,
        average: mean(values) as number,
        count: values.length,
      });
    }
    worstDishes.sort((a, b) => a.average - b.average || b.count - a.count);
  }

  return {
    average,
    target: MESS_SLA_TARGET,
    breaching: average !== null && average < MESS_SLA_TARGET,
    ratingCount: rows.length,
    windowDays: MESS_SLA_WINDOW_DAYS,
    byMeal,
    worstDishes: worstDishes.slice(0, 5),
  };
}

/* ------------------------------------------------------------ guest meals */

function toGuestMeal(row: typeof t.guestMeals.$inferSelect): GuestMeal {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    guests: row.guests,
    status: row.status,
    amount: row.amount,
    createdAt: iso(row.createdAt),
  };
}

export async function listGuestMeals(residentId: string): Promise<GuestMeal[]> {
  const rows = await db
    .select()
    .from(t.guestMeals)
    .where(eq(t.guestMeals.residentId, residentId))
    .orderBy(desc(t.guestMeals.date));
  return rows.map(toGuestMeal);
}

export async function bookGuestMeal(
  residentId: string,
  input: { date: string; meal: MealType; guests: number }
): Promise<GuestMeal> {
  const id = await nextId("GST");
  const amount = (GUEST_MEAL_PRICES[input.meal] ?? 100) * input.guests;

  const [row] = await db
    .insert(t.guestMeals)
    .values({ ...input, id, residentId, amount })
    .returning();

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId,
    title: "Guest meal booked",
    body: `${input.guests} guest${input.guests === 1 ? "" : "s"} for ${MEAL_LABELS[input.meal].toLowerCase()} on ${input.date}. ₹${amount.toLocaleString("en-IN")} will be added to your next invoice.`,
    kind: "info",
    href: "/food",
    read: false,
  });

  return toGuestMeal(row as typeof t.guestMeals.$inferSelect);
}

export async function cancelGuestMeal(
  residentId: string,
  id: string
): Promise<GuestMeal | null> {
  const [row] = await db
    .update(t.guestMeals)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(t.guestMeals.id, id),
        eq(t.guestMeals.residentId, residentId),
        eq(t.guestMeals.status, "booked")
      )
    )
    .returning();
  return row ? toGuestMeal(row) : null;
}

/* --------------------------------------------------------------- laundry */

function nextPickup(pickupDay: number): string {
  const today = new Date();
  const delta = (pickupDay - today.getDay() + 7) % 7 || 7;
  return isoDate(addDays(today, delta));
}

function toSubscription(
  row: typeof t.laundrySubscriptions.$inferSelect
): LaundrySubscription {
  return {
    id: row.id,
    plan: row.plan,
    service: row.service,
    piecesPerWeek: row.piecesPerWeek,
    pickupDay: row.pickupDay,
    monthlyPrice: row.monthlyPrice,
    status: row.status,
    startedAt: iso(row.startedAt),
    nextPickupOn: row.status === "active" ? nextPickup(row.pickupDay) : null,
  };
}

export async function getSubscription(
  residentId: string
): Promise<LaundrySubscription | null> {
  const [row] = await db
    .select()
    .from(t.laundrySubscriptions)
    .where(
      and(
        eq(t.laundrySubscriptions.residentId, residentId),
        inArray(t.laundrySubscriptions.status, ["active", "paused"])
      )
    )
    .orderBy(desc(t.laundrySubscriptions.startedAt))
    .limit(1);
  return row ? toSubscription(row) : null;
}

export async function subscribeLaundry(
  residentId: string,
  input: { plan: string; service: LaundryService; pickupDay: number }
): Promise<LaundrySubscription> {
  const tier = LAUNDRY_PLANS.find((p) => p.plan === input.plan);
  if (!tier) throw new Error("Unknown plan");

  // One subscription at a time; a new one replaces the old.
  await db
    .update(t.laundrySubscriptions)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(t.laundrySubscriptions.residentId, residentId),
        inArray(t.laundrySubscriptions.status, ["active", "paused"])
      )
    );

  const id = await nextId("LSB");
  const [row] = await db
    .insert(t.laundrySubscriptions)
    .values({
      id,
      residentId,
      plan: tier.plan,
      service: input.service,
      piecesPerWeek: tier.piecesPerWeek,
      pickupDay: input.pickupDay,
      monthlyPrice: tier.monthlyPrice,
      status: "active",
    })
    .returning();

  return toSubscription(row as typeof t.laundrySubscriptions.$inferSelect);
}

export async function setSubscriptionStatus(
  residentId: string,
  status: "active" | "paused" | "cancelled"
): Promise<LaundrySubscription | null> {
  const current = await getSubscription(residentId);
  if (!current) return null;

  await db
    .update(t.laundrySubscriptions)
    .set({ status })
    .where(eq(t.laundrySubscriptions.id, current.id));

  return status === "cancelled" ? null : getSubscription(residentId);
}

/**
 * Moves a bag along the pipeline. Only forward, and the shared request feed's
 * status is kept in step so "All requests" never disagrees with the tracker.
 */
export async function setLaundryStage(
  id: string,
  stage: LaundryStage,
  note: string
): Promise<boolean> {
  const [row] = await db
    .update(t.laundryRequests)
    .set({ stage, status: LAUNDRY_STAGE_STATUS[stage], updatedAt: new Date() })
    .where(eq(t.laundryRequests.id, id))
    .returning();

  if (!row) return false;

  await db.insert(t.trackingEvents).values({
    requestId: id,
    status: LAUNDRY_STAGE_STATUS[stage],
    note,
  });

  await db.insert(t.notifications).values({
    id: randomUUID(),
    residentId: row.residentId,
    title: "Laundry update",
    body: note,
    kind: stage === "delivered" ? "success" : "info",
    href: `/laundry/${id}`,
    read: false,
  });

  return true;
}

/* ---------------------------------------------------------- housekeeping */

function toBooking(
  row: typeof t.housekeepingBookings.$inferSelect
): HousekeepingBooking {
  return {
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    date: row.date,
    slot: row.slot,
    status: row.status,
    notes: row.notes,
    price: row.price,
    createdAt: iso(row.createdAt),
  };
}

export async function listHousekeeping(
  residentId: string
): Promise<HousekeepingBooking[]> {
  const rows = await db
    .select()
    .from(t.housekeepingBookings)
    .where(eq(t.housekeepingBookings.residentId, residentId))
    .orderBy(desc(t.housekeepingBookings.date));
  return rows.map(toBooking);
}

export async function bookHousekeeping(
  residentId: string,
  input: { serviceId: string; date: string; slot: string; notes: string }
): Promise<HousekeepingBooking> {
  const service = HOUSEKEEPING_SERVICES.find((s) => s.id === input.serviceId);
  if (!service) throw new Error("Unknown service");

  const id = await nextId("HKP");
  const [row] = await db
    .insert(t.housekeepingBookings)
    .values({
      ...input,
      id,
      residentId,
      serviceName: service.name,
      price: service.price,
    })
    .returning();

  return toBooking(row as typeof t.housekeepingBookings.$inferSelect);
}

export async function cancelHousekeeping(
  residentId: string,
  id: string
): Promise<boolean> {
  const rows = await db
    .update(t.housekeepingBookings)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(t.housekeepingBookings.id, id),
        eq(t.housekeepingBookings.residentId, residentId),
        eq(t.housekeepingBookings.status, "booked")
      )
    )
    .returning({ id: t.housekeepingBookings.id });
  return rows.length > 0;
}

/** Slots already taken by this resident on a given day. */
export async function housekeepingTaken(
  residentId: string,
  date: string
): Promise<string[]> {
  const rows = await db
    .select({ slot: t.housekeepingBookings.slot })
    .from(t.housekeepingBookings)
    .where(
      and(
        eq(t.housekeepingBookings.residentId, residentId),
        eq(t.housekeepingBookings.date, date),
        inArray(t.housekeepingBookings.status, ["booked", "in_progress"])
      )
    );
  return rows.map((r) => r.slot);
}

/* -------------------------------------------------------------- amenities */

export async function ensureAmenities(): Promise<void> {
  for (const seed of AMENITY_SEED) {
    await db.insert(t.amenities).values(seed).onConflictDoNothing();
  }
}

export async function listAmenities(): Promise<Amenity[]> {
  await ensureAmenities();
  const rows = await db
    .select()
    .from(t.amenities)
    .where(eq(t.amenities.active, true))
    .orderBy(t.amenities.name);
  return rows;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const toClock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export async function availability(
  residentId: string,
  amenityId: string,
  date: string
): Promise<AmenityAvailability | null> {
  const [amenity] = await db
    .select()
    .from(t.amenities)
    .where(eq(t.amenities.id, amenityId))
    .limit(1);
  if (!amenity) return null;

  const booked = await db
    .select()
    .from(t.amenityBookings)
    .where(
      and(
        eq(t.amenityBookings.amenityId, amenityId),
        eq(t.amenityBookings.date, date),
        inArray(t.amenityBookings.status, ["booked", "in_progress"])
      )
    );

  const open = toMinutes(amenity.openFrom);
  const close = toMinutes(amenity.openTo);
  const slots: AmenitySlot[] = [];

  for (let start = open; start + amenity.slotMinutes <= close; start += amenity.slotMinutes) {
    const startTime = toClock(start);
    const held = booked.filter((b) => b.startTime === startTime);

    slots.push({
      startTime,
      endTime: toClock(start + amenity.slotMinutes),
      booked: held.length,
      capacity: amenity.capacity,
      available: held.length < amenity.capacity,
      mine: held.some((b) => b.residentId === residentId),
    });
  }

  return { amenity, date, slots };
}

export async function bookAmenity(
  residentId: string,
  amenityId: string,
  date: string,
  startTime: string
): Promise<
  | { ok: true; booking: AmenityBooking }
  | { ok: false; reason: "unknown" | "closed" | "full" | "duplicate" }
> {
  const avail = await availability(residentId, amenityId, date);
  if (!avail) return { ok: false, reason: "unknown" };

  const slot = avail.slots.find((s) => s.startTime === startTime);
  if (!slot) return { ok: false, reason: "closed" };
  if (slot.mine) return { ok: false, reason: "duplicate" };
  // Capacity varies per amenity, so it's checked here rather than by a
  // unique index; the index only stops the same person booking twice.
  if (!slot.available) return { ok: false, reason: "full" };

  const id = await nextId("AMB");

  try {
    const [row] = await db
      .insert(t.amenityBookings)
      .values({
        id,
        amenityId,
        residentId,
        date,
        startTime,
        endTime: slot.endTime,
      })
      .returning();

    return {
      ok: true,
      booking: {
        id: row!.id,
        amenityId,
        amenityName: avail.amenity.name,
        amenityKind: avail.amenity.kind,
        date,
        startTime,
        endTime: slot.endTime,
        status: row!.status,
        createdAt: iso(row!.createdAt),
      },
    };
  } catch {
    // The unique index caught a double-tap that raced past the check above.
    return { ok: false, reason: "duplicate" };
  }
}

export async function myAmenityBookings(
  residentId: string
): Promise<AmenityBooking[]> {
  const rows = await db
    .select({
      booking: t.amenityBookings,
      name: t.amenities.name,
      kind: t.amenities.kind,
    })
    .from(t.amenityBookings)
    .innerJoin(t.amenities, eq(t.amenityBookings.amenityId, t.amenities.id))
    .where(eq(t.amenityBookings.residentId, residentId))
    .orderBy(desc(t.amenityBookings.date), t.amenityBookings.startTime);

  return rows.map(({ booking, name, kind }) => ({
    id: booking.id,
    amenityId: booking.amenityId,
    amenityName: name,
    amenityKind: kind,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    createdAt: iso(booking.createdAt),
  }));
}

export async function cancelAmenityBooking(
  residentId: string,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(t.amenityBookings)
    .where(
      and(
        eq(t.amenityBookings.id, id),
        eq(t.amenityBookings.residentId, residentId)
      )
    )
    .returning({ id: t.amenityBookings.id });
  return rows.length > 0;
}
