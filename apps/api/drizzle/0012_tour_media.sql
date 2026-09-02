CREATE TABLE "tour_media" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"kind" text NOT NULL,
	"uri" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tour_media_space_idx" ON "tour_media" USING btree ("space_id","position");