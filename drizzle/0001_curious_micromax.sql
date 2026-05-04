CREATE TABLE "tootogp_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"approved_too_id" integer NOT NULL,
	"parent_ep_db_object_id" varchar(255) NOT NULL,
	"generated_ep_db_object_id" varchar(255) NOT NULL,
	"sequence_no" integer NOT NULL,
	"earliest_start_time" timestamp with time zone,
	"planned_start_time" timestamp with time zone,
	"planned_end_time" timestamp with time zone,
	"cadence_value" integer,
	"cadence_unit" varchar(32),
	"reviewed_number_of_visits_snapshot" integer,
	"reviewed_single_exposure_time_snapshot" integer,
	"reviewed_total_exposure_time_snapshot" integer,
	"status" varchar(32) DEFAULT 'planned' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tootogp_schedule_generated_ep_db_object_id_unique" UNIQUE("generated_ep_db_object_id"),
	CONSTRAINT "tootogp_schedule_parent_sequence_unique" UNIQUE("approved_too_id","sequence_no")
);
ALTER TABLE "tootogp_schedule" ADD CONSTRAINT "tootogp_schedule_approved_too_id_approved_too_id_fk" FOREIGN KEY ("approved_too_id") REFERENCES "public"."approved_too"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint