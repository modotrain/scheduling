CREATE TABLE "cycle2_skymap_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"visit_index" integer,
	"n_visits" integer,
	"exposure_s" integer,
	"scheduled_date" date,
	"week_index" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle2_skymap_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"source_name" varchar(255),
	"proposal_no" varchar(255),
	"pi" varchar(255),
	"obs_type" varchar(255),
	"source_priority" varchar(32),
	"ra" double precision,
	"dec" double precision,
	"total_exposure_time_all" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cycle2_skymap_sources_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE INDEX "cycle2_skymap_schedule_source_id_idx" ON "cycle2_skymap_schedule" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "cycle2_skymap_schedule_week_index_idx" ON "cycle2_skymap_schedule" USING btree ("week_index");--> statement-breakpoint
CREATE INDEX "cycle2_skymap_sources_source_id_idx" ON "cycle2_skymap_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "cycle2_skymap_sources_priority_idx" ON "cycle2_skymap_sources" USING btree ("source_priority");