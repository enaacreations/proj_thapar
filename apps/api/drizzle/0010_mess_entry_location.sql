ALTER TABLE "mess_entries" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "mess_entries" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "mess_entries" ADD COLUMN "within_geofence" boolean;--> statement-breakpoint
ALTER TABLE "mess_entries" ADD COLUMN "location_label" text;