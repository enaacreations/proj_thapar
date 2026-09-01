CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"name" text NOT NULL,
	"condition" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"photo_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"type" text NOT NULL,
	"uri" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_records" (
	"resident_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"reference" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE "lease_agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"resident_id" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"terms" jsonb NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by" text NOT NULL,
	"signed_at" timestamp with time zone,
	"signer_name" text,
	"signature_path" text
);
--> statement-breakpoint
CREATE TABLE "move_in_state" (
	"resident_id" text PRIMARY KEY NOT NULL,
	"inventory_submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "move_in_tasks" (
	"resident_id" text NOT NULL,
	"key" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roommate_profiles" (
	"resident_id" text PRIMARY KEY NOT NULL,
	"sleep_schedule" text NOT NULL,
	"cleanliness" integer NOT NULL,
	"noise_tolerance" integer NOT NULL,
	"social_level" integer NOT NULL,
	"study_location" text NOT NULL,
	"guest_frequency" integer NOT NULL,
	"smoking" boolean DEFAULT false NOT NULL,
	"food_preference" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_records" ADD CONSTRAINT "kyc_records_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_in_state" ADD CONSTRAINT "move_in_state_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_in_tasks" ADD CONSTRAINT "move_in_tasks_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roommate_profiles" ADD CONSTRAINT "roommate_profiles_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_resident_idx" ON "inventory_items" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "kyc_documents_resident_idx" ON "kyc_documents" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "lease_resident_idx" ON "lease_agreements" USING btree ("resident_id","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "move_in_task_key" ON "move_in_tasks" USING btree ("resident_id","key");