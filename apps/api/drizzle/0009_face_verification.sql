ALTER TABLE "attendance_records" ADD COLUMN "face_match_distance" double precision;--> statement-breakpoint
ALTER TABLE "residents" ADD COLUMN "face_descriptor" jsonb;--> statement-breakpoint
ALTER TABLE "residents" ADD COLUMN "face_enrolled_at" timestamp with time zone;