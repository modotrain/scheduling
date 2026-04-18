import { pgTable, unique, integer, varchar, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: varchar({ length: 255 }).notNull(),
	age: integer().notNull(),
	email: varchar({ length: 255 }).notNull(),
	vip: boolean().default(false).notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const tooReq = pgTable("too_req", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "too_req_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	requestFilename: varchar("request_filename", { length: 255 }),
	requestDate: varchar("request_date", { length: 255 }),
	requestUrgency: varchar("request_urgency", { length: 255 }),
	obsType: varchar("obs_type", { length: 255 }),
	epDbObjectId: varchar("ep_db_object_id", { length: 255 }),
	sourceName: varchar("source_name", { length: 255 }),
	rightAscension: varchar("right_ascension", { length: 255 }),
	declination: varchar({ length: 255 }),
	requestedObsDurationInSeconds: integer("requested_obs_duration_in_seconds").default(0).notNull(),
	requestedObsDurationInOrbits: integer("requested_obs_duration_in_orbits").default(0).notNull(),
	userName: varchar("user_name", { length: 255 }),
	userGroup: varchar("user_group", { length: 255 }),
	cmr: varchar({ length: 255 }),
	x: varchar({ length: 255 }),
	y: varchar({ length: 255 }),
	processSwitchA: varchar("process_switch_a", { length: 255 }),
	observationModeA: varchar("observation_mode_a", { length: 255 }),
	filterA: varchar("filter_a", { length: 255 }),
	processSwitchB: varchar("process_switch_b", { length: 255 }),
	observationModeB: varchar("observation_mode_b", { length: 255 }),
	filterB: varchar("filter_b", { length: 255 }),
	obsPriority: varchar("obs_priority", { length: 255 }),
	timeConstraints: varchar("time_constraints", { length: 255 }),
	sourceId: integer("source_id").default(0).notNull(),
	proposalId: integer("proposal_id").default(0).notNull(),
	proposalNo: integer("proposal_no").default(0).notNull(),
	toGp: boolean("to_gp").default(false).notNull(),
});
