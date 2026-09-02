CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"geofence_latitude" double precision NOT NULL,
	"geofence_longitude" double precision NOT NULL,
	"geofence_radius_metres" integer NOT NULL,
	"geofence_label" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
INSERT INTO "site_settings"
	("id", "geofence_latitude", "geofence_longitude", "geofence_radius_metres", "geofence_label")
VALUES
	('default', 30.3549, 76.3626, 300, 'Thapar, Block B')
ON CONFLICT ("id") DO NOTHING;
