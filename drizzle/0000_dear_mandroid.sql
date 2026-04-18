-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"age" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"vip" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "too_req" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "too_req_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_filename" varchar(255),
	"request_date" varchar(255),
	"request_urgency" varchar(255),
	"obs_type" varchar(255),
	"ep_db_object_id" varchar(255),
	"source_name" varchar(255),
	"right_ascension" varchar(255),
	"declination" varchar(255),
	"requested_obs_duration_in_seconds" integer DEFAULT 0 NOT NULL,
	"requested_obs_duration_in_orbits" integer DEFAULT 0 NOT NULL,
	"user_name" varchar(255),
	"user_group" varchar(255),
	"cmr" varchar(255),
	"x" varchar(255),
	"y" varchar(255),
	"process_switch_a" varchar(255),
	"observation_mode_a" varchar(255),
	"filter_a" varchar(255),
	"process_switch_b" varchar(255),
	"observation_mode_b" varchar(255),
	"filter_b" varchar(255),
	"obs_priority" varchar(255),
	"time_constraints" varchar(255),
	"source_id" integer DEFAULT 0 NOT NULL,
	"proposal_id" integer DEFAULT 0 NOT NULL,
	"proposal_no" integer DEFAULT 0 NOT NULL,
	"to_gp" boolean DEFAULT false NOT NULL
);

*/