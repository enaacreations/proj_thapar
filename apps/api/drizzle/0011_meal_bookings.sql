-- Meals become an explicit choice: a day-by-day booking table, and a recurring
-- plan that has to be switched on rather than assumed.
--
-- The new defaults are all false, which only affects rows created from here on.
-- Residents who already have a row were opted in to everything by the old
-- defaults, and some of them will have meant it — so `recurring` is backfilled
-- to true wherever any meal is set. Dropping several hundred people off the
-- mess roll to make a point about defaults would be the wrong migration.

CREATE TABLE "meal_bookings" (
	"resident_id" text NOT NULL,
	"date" date NOT NULL,
	"meal" text NOT NULL,
	"booked" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_bookings_resident_id_date_meal_pk" PRIMARY KEY("resident_id","date","meal")
);
--> statement-breakpoint
ALTER TABLE "food_preferences" ALTER COLUMN "breakfast" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "food_preferences" ALTER COLUMN "lunch" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "food_preferences" ALTER COLUMN "snacks" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "food_preferences" ALTER COLUMN "dinner" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "food_preferences" ADD COLUMN "recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_bookings" ADD CONSTRAINT "meal_bookings_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_bookings_day_idx" ON "meal_bookings" USING btree ("date","meal");--> statement-breakpoint

UPDATE "food_preferences"
SET "recurring" = true
WHERE "breakfast" OR "lunch" OR "snacks" OR "dinner";