CREATE TABLE IF NOT EXISTS "long_term_observation_list_cycle2_gf" (
	"id" serial PRIMARY KEY NOT NULL,
	"tdic_id" varchar(255),
	"source_id" varchar(255),
	"proposal_id" varchar(255),
	"proposal_no" varchar(255),
	"ep_db_object_id" varchar(255),
	"week_id" varchar(255),
	"pi" varchar(255),
	"group" varchar(255),
	"source_name" varchar(255),
	"obs_type" varchar(255),
	"ra" varchar(255),
	"dec" varchar(255),
	"total_exposure_time" varchar(255),
	"total_exposure_time_all" varchar(255),
	"exposure_time_unit" varchar(255),
	"continous_exposure" varchar(255),
	"visit_number" varchar(255),
	"exposure_per_vist_min" varchar(255),
	"exposure_per_vist_max" varchar(255),
	"completeness" varchar(255),
	"cadence" varchar(255),
	"cadence_unit" varchar(255),
	"precision" varchar(255),
	"precision_unit" varchar(255),
	"start_time" varchar(255),
	"end_time" varchar(255),
	"source_priority" varchar(255),
	"fxt1_window_mode" varchar(255),
	"fxt1_filter" varchar(255),
	"fxt2_window_mode" varchar(255),
	"fxt2_filter" varchar(255),
	"is_updated" varchar(255),
	"payload" varchar(255),
	"wxt_cmos" varchar(255),
	"wxt_cmos_x" varchar(255),
	"wxt_cmos_y" varchar(255),
	"fxt_cmr" varchar(255),
	"fxt_x" varchar(255),
	"fxt_y" varchar(255),
	"is_for_disrupted" varchar(255),
	"visible_days" varchar(255),
	"visible_date_ranges" varchar(255),
	"visible_range_count" varchar(255),
	"visible_total_days" varchar(255),
	"visible_date_ranges_only_sun" varchar(255),
	"visible_first_end" varchar(255),
	"visible_last_end" varchar(255),
	"mt_days" varchar(255),
	"left_mt_days" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "long_term_observation_list_cycle2_gf_source_id_idx"
	ON "long_term_observation_list_cycle2_gf" ("source_id");

CREATE INDEX IF NOT EXISTS "long_term_observation_list_cycle2_gf_week_id_idx"
	ON "long_term_observation_list_cycle2_gf" ("week_id");

ALTER TABLE "gp_cycle2_source_reports"
	ADD COLUMN IF NOT EXISTS "dataset" varchar(32);

UPDATE "gp_cycle2_source_reports"
SET "dataset" = COALESCE("dataset", 'cycle2');

ALTER TABLE "gp_cycle2_source_reports"
	ALTER COLUMN "dataset" SET NOT NULL;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'gp_cycle2_source_reports_pkey'
	) THEN
		ALTER TABLE "gp_cycle2_source_reports"
			DROP CONSTRAINT "gp_cycle2_source_reports_pkey";
	END IF;
END $$;

ALTER TABLE "gp_cycle2_source_reports"
	ADD CONSTRAINT "gp_cycle2_source_reports_pkey"
	PRIMARY KEY ("dataset", "source_id");

CREATE INDEX IF NOT EXISTS "gp_cycle2_source_reports_dataset_source_id_idx"
	ON "gp_cycle2_source_reports" ("dataset", "source_id");

CREATE INDEX IF NOT EXISTS "gp_cycle2_source_reports_dataset_priority_idx"
	ON "gp_cycle2_source_reports" ("dataset", "priority");