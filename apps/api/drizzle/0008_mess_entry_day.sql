-- Mess entries gain a serving day so one plate per resident per meal can be
-- enforced by the database. Existing rows are backfilled from entered_at, and
-- any that already double-counted a meal are collapsed to the earliest scan
-- before the unique index goes on — the index cannot be created otherwise.

ALTER TABLE "mess_entries" ADD COLUMN "date" date;--> statement-breakpoint

UPDATE "mess_entries" SET "date" = ("entered_at")::date WHERE "date" IS NULL;--> statement-breakpoint

DELETE FROM "mess_entries" a
USING "mess_entries" b
WHERE a."resident_id" = b."resident_id"
  AND a."meal" = b."meal"
  AND a."date" = b."date"
  AND (
    a."entered_at" > b."entered_at"
    OR (a."entered_at" = b."entered_at" AND a."id" > b."id")
  );--> statement-breakpoint

ALTER TABLE "mess_entries" ALTER COLUMN "date" SET NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "mess_resident_meal_date_key" ON "mess_entries" USING btree ("resident_id","meal","date");
