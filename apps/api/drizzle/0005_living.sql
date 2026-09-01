CREATE TABLE "amenities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"slot_minutes" integer DEFAULT 60 NOT NULL,
	"open_from" text NOT NULL,
	"open_to" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amenity_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"amenity_id" text NOT NULL,
	"resident_id" text NOT NULL,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diet_preferences" (
	"resident_id" text PRIMARY KEY NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allergies" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_meals" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"date" date NOT NULL,
	"meal" text NOT NULL,
	"guests" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "housekeeping_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"service_id" text NOT NULL,
	"service_name" text NOT NULL,
	"date" date NOT NULL,
	"slot" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "laundry_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"plan" text NOT NULL,
	"service" text NOT NULL,
	"pieces_per_week" integer NOT NULL,
	"pickup_day" integer NOT NULL,
	"monthly_price" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"date" date NOT NULL,
	"meal" text NOT NULL,
	"rating" integer NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_dishes" (
	"id" text PRIMARY KEY NOT NULL,
	"meal_id" text NOT NULL,
	"name" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_meals" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"meal" text NOT NULL,
	"serving_window" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "laundry_requests" ADD COLUMN "stage" text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "laundry_requests" ADD COLUMN "service" text DEFAULT 'wash_fold' NOT NULL;--> statement-breakpoint
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_preferences" ADD CONSTRAINT "diet_preferences_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_meals" ADD CONSTRAINT "guest_meals_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_bookings" ADD CONSTRAINT "housekeeping_bookings_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laundry_subscriptions" ADD CONSTRAINT "laundry_subscriptions_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_ratings" ADD CONSTRAINT "meal_ratings_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_dishes" ADD CONSTRAINT "menu_dishes_meal_id_menu_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."menu_meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amenity_booking_key" ON "amenity_bookings" USING btree ("amenity_id","date","start_time","resident_id");--> statement-breakpoint
CREATE INDEX "amenity_booking_slot_idx" ON "amenity_bookings" USING btree ("amenity_id","date","start_time");--> statement-breakpoint
CREATE INDEX "guest_meal_resident_idx" ON "guest_meals" USING btree ("resident_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_slot_key" ON "housekeeping_bookings" USING btree ("resident_id","date","slot");--> statement-breakpoint
CREATE INDEX "housekeeping_date_idx" ON "housekeeping_bookings" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_rating_key" ON "meal_ratings" USING btree ("resident_id","date","meal");--> statement-breakpoint
CREATE INDEX "meal_rating_window_idx" ON "meal_ratings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "menu_dish_meal_idx" ON "menu_dishes" USING btree ("meal_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_meal_key" ON "menu_meals" USING btree ("date","meal");