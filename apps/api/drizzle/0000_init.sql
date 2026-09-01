CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"date" date NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"location_label" text NOT NULL,
	"photo_uri" text,
	"within_geofence" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"category_id" text NOT NULL,
	"category_label" text NOT NULL,
	"sub_category_id" text NOT NULL,
	"sub_category_label" text NOT NULL,
	"remarks" text NOT NULL,
	"against_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"category_id" text NOT NULL,
	"category_label" text NOT NULL,
	"sub_category_id" text NOT NULL,
	"sub_category_label" text NOT NULL,
	"rating" integer NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"photo_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_preferences" (
	"resident_id" text PRIMARY KEY NOT NULL,
	"breakfast" boolean DEFAULT true NOT NULL,
	"lunch" boolean DEFAULT true NOT NULL,
	"snacks" boolean DEFAULT true NOT NULL,
	"dinner" boolean DEFAULT true NOT NULL,
	"pause_from" date,
	"pause_to" date
);
--> statement-breakpoint
CREATE TABLE "laundry_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"items" jsonb NOT NULL,
	"total_pieces" integer NOT NULL,
	"pickup_slot" text NOT NULL,
	"photo_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"category_id" text NOT NULL,
	"category_label" text NOT NULL,
	"sub_category_id" text NOT NULL,
	"sub_category_label" text NOT NULL,
	"remarks" text NOT NULL,
	"photo_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mess_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"meal" text NOT NULL,
	"method" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"href" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"mobile" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"paid_on" date NOT NULL,
	"amount" integer NOT NULL,
	"mode" text NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"receipt_no" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"resident_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"paid_up_to" date NOT NULL,
	"next_due_on" date,
	"next_due_amount" integer
);
--> statement-breakpoint
CREATE TABLE "residents" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"dob" date NOT NULL,
	"gender" text NOT NULL,
	"kyc_type" text NOT NULL,
	"kyc_number" text NOT NULL,
	"mobile" text NOT NULL,
	"account_status" text DEFAULT 'pending_approval' NOT NULL,
	"mpin" text,
	"biometric_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"resident_id" text PRIMARY KEY NOT NULL,
	"room_number" text NOT NULL,
	"floor" text NOT NULL,
	"wing" text NOT NULL,
	"building_name" text NOT NULL,
	"property_name" text NOT NULL,
	"property_address" text NOT NULL,
	"room_type" text NOT NULL,
	"occupancy" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tracking_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"visitor_name" text NOT NULL,
	"relation" text NOT NULL,
	"visit_date" date NOT NULL,
	"duration_hours" integer NOT NULL,
	"food_required" boolean DEFAULT false NOT NULL,
	"food_selections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_entries" ADD CONSTRAINT "feedback_entries_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_preferences" ADD CONSTRAINT "food_preferences_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laundry_requests" ADD CONSTRAINT "laundry_requests_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mess_entries" ADD CONSTRAINT "mess_entries_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_resident_date_key" ON "attendance_records" USING btree ("resident_id","date");--> statement-breakpoint
CREATE INDEX "complaints_resident_idx" ON "complaints" USING btree ("resident_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_resident_idx" ON "feedback_entries" USING btree ("resident_id","created_at");--> statement-breakpoint
CREATE INDEX "laundry_resident_idx" ON "laundry_requests" USING btree ("resident_id","created_at");--> statement-breakpoint
CREATE INDEX "maintenance_resident_idx" ON "maintenance_requests" USING btree ("resident_id","created_at");--> statement-breakpoint
CREATE INDEX "mess_resident_idx" ON "mess_entries" USING btree ("resident_id","entered_at");--> statement-breakpoint
CREATE INDEX "notifications_resident_idx" ON "notifications" USING btree ("resident_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_entries_resident_idx" ON "payment_entries" USING btree ("resident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "residents_mobile_key" ON "residents" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX "tracking_request_idx" ON "tracking_events" USING btree ("request_id","at");--> statement-breakpoint
CREATE INDEX "visits_resident_idx" ON "visit_requests" USING btree ("resident_id","created_at");