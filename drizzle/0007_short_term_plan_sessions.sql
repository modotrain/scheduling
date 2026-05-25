CREATE TABLE "short_term_plan_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "week_id" varchar(32) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'active',
  "operator_name" varchar(255),
  "excluded_cycle2_ids" json NOT NULL DEFAULT '[]',
  "excluded_gf_ids" json NOT NULL DEFAULT '[]',
  "merged_csv_text" text,
  "uploaded_obs_plan_text" text,
  "unscheduled_ep_db_ids" json NOT NULL DEFAULT '[]',
  "week_id_changes" json NOT NULL DEFAULT '[]',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
