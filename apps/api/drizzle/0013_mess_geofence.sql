ALTER TABLE "site_settings" ADD COLUMN "mess_geofence_latitude" double precision;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "mess_geofence_longitude" double precision;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "mess_geofence_radius_metres" integer;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "mess_geofence_label" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "mess_geofence_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "mess_geofence_updated_by" text;