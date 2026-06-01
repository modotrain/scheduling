// Per-cycle table factory + runtime registry.
//
// Every observation cycle owns an identical set of physical tables that differ
// only by the cycle number embedded in their name, e.g. `gp_cycle2`,
// `gp_cycle3`, ... This factory builds the Drizzle table objects for any cycle
// from a single definition, so adding a new cycle never requires copy-pasting
// table definitions.
//
// Physical tables for a new cycle are created by `src/add_cycle.ts` (which
// clones the structure of the template cycle via `CREATE TABLE ... (LIKE ...)`).
// This module only provides the *query-time* Drizzle objects.

import {
  pgTable,
  varchar,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  date,
  json,
  index,
  unique,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";
import cyclesConfig from "./cycles.config.json";

/** Shared column set for the `gp_cycle{n}` and `cycle{n}_gf` source tables. */
function sourceColumns() {
  return {
    id: serial().primaryKey().notNull(),
    tdicId: varchar("tdic_id", { length: 255 }),
    sourceId: varchar("source_id", { length: 255 }),
    proposalId: varchar("proposal_id", { length: 255 }),
    proposalNo: varchar("proposal_no", { length: 255 }),
    pi: varchar({ length: 255 }),
    userGroup: varchar("user_group", { length: 255 }),
    sourceName: varchar("source_name", { length: 255 }),
    obsType: varchar("obs_type", { length: 255 }),
    ra: varchar({ length: 255 }),
    dec: varchar({ length: 255 }),
    totalExposureTime: varchar("total_exposure_time", { length: 255 }),
    exposureTimeUnit: varchar("exposure_time_unit", { length: 255 }),
    continousExposure: varchar("continous_exposure", { length: 255 }),
    visitNumber: varchar("visit_number", { length: 255 }),
    exposurePerVistMin: varchar("exposure_per_vist_min", { length: 255 }),
    exposurePerVistMax: varchar("exposure_per_vist_max", { length: 255 }),
    completeness: varchar({ length: 255 }),
    cadence: varchar({ length: 255 }),
    cadenceUnit: varchar("cadence_unit", { length: 255 }),
    precision: varchar({ length: 255 }),
    precisionUnit: varchar("precision_unit", { length: 255 }),
    startTime: varchar("start_time", { length: 255 }),
    endTime: varchar("end_time", { length: 255 }),
    sourcePriority: varchar("source_priority", { length: 255 }),
    fxt1WindowMode: varchar("fxt1_window_mode", { length: 255 }),
    fxt1Filter: varchar("fxt1_filter", { length: 255 }),
    fxt2WindowMode: varchar("fxt2_window_mode", { length: 255 }),
    fxt2Filter: varchar("fxt2_filter", { length: 255 }),
    isUpdated: varchar("is_updated", { length: 255 }),
    anticipatedToo: varchar("anticipated_too", { length: 255 }),
    stp: varchar({ length: 255 }),
    category: varchar({ length: 255 }),
    type: varchar({ length: 255 }),
    payload: varchar({ length: 255 }).default(""),
    wxtCmos: varchar("wxt_cmos", { length: 255 }).default(""),
    cmosX: varchar("cmos_x", { length: 255 }).default(""),
    cmosY: varchar("cmos_y", { length: 255 }).default(""),
    fxtCmr: varchar("fxt_cmr", { length: 255 }).default(""),
    cmrX: varchar("cmr_x", { length: 255 }).default(""),
    cmrY: varchar("cmr_y", { length: 255 }).default(""),
  };
}

/** Shared column set for the long-term observation list tables (main + GF). */
function longTermColumns() {
  return {
    id: serial("id").primaryKey().notNull(),
    tdicId: varchar("tdic_id", { length: 255 }),
    sourceId: varchar("source_id", { length: 255 }),
    proposalId: varchar("proposal_id", { length: 255 }),
    proposalNo: varchar("proposal_no", { length: 255 }),
    epDbObjectId: varchar("ep_db_object_id", { length: 255 }),
    weekId: varchar("week_id", { length: 255 }),
    pi: varchar("pi", { length: 255 }),
    groupName: varchar("group", { length: 255 }),
    sourceName: varchar("source_name", { length: 255 }),
    obsType: varchar("obs_type", { length: 255 }),
    ra: varchar("ra", { length: 255 }),
    dec: varchar("dec", { length: 255 }),
    totalExposureTime: varchar("total_exposure_time", { length: 255 }),
    totalExposureTimeAll: varchar("total_exposure_time_all", { length: 255 }),
    exposureTimeUnit: varchar("exposure_time_unit", { length: 255 }),
    continousExposure: varchar("continous_exposure", { length: 255 }),
    visitNumber: varchar("visit_number", { length: 255 }),
    exposurePerVistMin: varchar("exposure_per_vist_min", { length: 255 }),
    exposurePerVistMax: varchar("exposure_per_vist_max", { length: 255 }),
    completeness: varchar("completeness", { length: 255 }),
    cadence: varchar("cadence", { length: 255 }),
    cadenceUnit: varchar("cadence_unit", { length: 255 }),
    precision: varchar("precision", { length: 255 }),
    precisionUnit: varchar("precision_unit", { length: 255 }),
    startTime: varchar("start_time", { length: 255 }),
    endTime: varchar("end_time", { length: 255 }),
    sourcePriority: varchar("source_priority", { length: 255 }),
    fxt1WindowMode: varchar("fxt1_window_mode", { length: 255 }),
    fxt1Filter: varchar("fxt1_filter", { length: 255 }),
    fxt2WindowMode: varchar("fxt2_window_mode", { length: 255 }),
    fxt2Filter: varchar("fxt2_filter", { length: 255 }),
    isUpdated: varchar("is_updated", { length: 255 }),
    payload: varchar("payload", { length: 255 }),
    wxtCmos: varchar("wxt_cmos", { length: 255 }),
    wxtCmosX: varchar("wxt_cmos_x", { length: 255 }),
    wxtCmosY: varchar("wxt_cmos_y", { length: 255 }),
    fxtCmr: varchar("fxt_cmr", { length: 255 }),
    fxtX: varchar("fxt_x", { length: 255 }),
    fxtY: varchar("fxt_y", { length: 255 }),
    isForDisrupted: varchar("is_for_disrupted", { length: 255 }),
    visibleDays: varchar("visible_days", { length: 255 }),
    visibleDateRanges: varchar("visible_date_ranges", { length: 255 }),
    visibleRangeCount: varchar("visible_range_count", { length: 255 }),
    visibleTotalDays: varchar("visible_total_days", { length: 255 }),
    visibleDateRangesOnlySun: varchar("visible_date_ranges_only_sun", { length: 255 }),
    visibleFirstEnd: varchar("visible_first_end", { length: 255 }),
    visibleLastEnd: varchar("visible_last_end", { length: 255 }),
    mtDays: varchar("mt_days", { length: 255 }),
    leftMtDays: varchar("left_mt_days", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  };
}

/** Builds the full set of Drizzle table objects for a given cycle number. */
export function makeCycleTables(n: number) {
  const gp = pgTable(`gp_cycle${n}`, sourceColumns());

  const gf = pgTable(`cycle${n}_gf`, sourceColumns());

  const longTerm = pgTable(`long_term_observation_list_cycle${n}`, longTermColumns());

  const longTermGf = pgTable(
    `long_term_observation_list_cycle${n}_gf`,
    longTermColumns(),
    (table) => [
      index(`long_term_observation_list_cycle${n}_gf_source_id_idx`).on(table.sourceId),
      index(`long_term_observation_list_cycle${n}_gf_week_id_idx`).on(table.weekId),
    ],
  );

  const sourceReports = pgTable(
    `gp_cycle${n}_source_reports`,
    {
      dataset: varchar("dataset", { length: 32 }).notNull(),
      sourceId: integer("source_id").notNull(),
      sourceName: varchar("source_name", { length: 255 }).notNull(),
      proposalId: varchar("proposal_id", { length: 255 }),
      proposalNo: varchar("proposal_no", { length: 255 }),
      pi: varchar("pi", { length: 255 }),
      userGroup: varchar("user_group", { length: 255 }),
      obsType: varchar("obs_type", { length: 255 }),
      priority: varchar("priority", { length: 50 }),
      ra: varchar("ra", { length: 255 }),
      dec: varchar("dec", { length: 255 }),
      requiredExposureS: integer("required_exposure_s"),
      requiredVisits: integer("required_visits"),
      perVisitMinS: integer("per_visit_min_s"),
      perVisitMaxS: integer("per_visit_max_s"),
      scheduledExposureS: integer("scheduled_exposure_s"),
      scheduledVisits: integer("scheduled_visits"),
      exposureRatio: doublePrecision("exposure_ratio"),
      chartData: json("chart_data"),
      summaryText: text("summary_text"),
      generatedAt: timestamp("generated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    },
    (table) => [
      primaryKey({ columns: [table.dataset, table.sourceId] }),
      index(`gp_cycle${n}_source_reports_dataset_source_id_idx`).on(table.dataset, table.sourceId),
      index(`gp_cycle${n}_source_reports_dataset_priority_idx`).on(table.dataset, table.priority),
    ],
  );

  const skymapSources = pgTable(
    `cycle${n}_skymap_sources`,
    {
      id: serial("id").primaryKey().notNull(),
      dataset: varchar("dataset", { length: 32 }).notNull().default(`cycle${n}`),
      sourceId: integer("source_id").notNull(),
      sourceName: varchar("source_name", { length: 255 }),
      proposalNo: varchar("proposal_no", { length: 255 }),
      pi: varchar("pi", { length: 255 }),
      obsType: varchar("obs_type", { length: 255 }),
      sourcePriority: varchar("source_priority", { length: 32 }),
      ra: doublePrecision("ra"),
      dec: doublePrecision("dec"),
      totalExposureTimeAll: integer("total_exposure_time_all"),
      createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    },
    (table) => [
      unique(`cycle${n}_skymap_sources_dataset_source_id_unique`).on(table.dataset, table.sourceId),
      index(`cycle${n}_skymap_sources_dataset_source_id_idx`).on(table.dataset, table.sourceId),
      index(`cycle${n}_skymap_sources_priority_idx`).on(table.sourcePriority),
    ],
  );

  const skymapSchedule = pgTable(
    `cycle${n}_skymap_schedule`,
    {
      id: serial("id").primaryKey().notNull(),
      dataset: varchar("dataset", { length: 32 }).notNull().default(`cycle${n}`),
      sourceId: integer("source_id").notNull(),
      visitIndex: integer("visit_index"),
      nVisits: integer("n_visits"),
      exposureS: integer("exposure_s"),
      scheduledDate: date("scheduled_date"),
      weekIndex: integer("week_index"),
      note: text("note"),
      createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    },
    (table) => [
      index(`cycle${n}_skymap_schedule_dataset_source_id_idx`).on(table.dataset, table.sourceId),
      index(`cycle${n}_skymap_schedule_week_index_idx`).on(table.weekIndex),
    ],
  );

  const proposal = pgTable(`gp_cycle${n}_proposal`, {
    id: serial().primaryKey().notNull(),
    no: varchar({ length: 255 }),
    proposalNo: varchar("proposal_no", { length: 255 }),
    pi: varchar({ length: 255 }),
    title: text(),
    stp: varchar({ length: 255 }),
    secondsR: varchar("seconds_r", { length: 255 }),
    obsType: varchar("obs_type", { length: 255 }),
    anticipatedToo: varchar("anticipated_too", { length: 255 }),
    userGroup: varchar("user_group", { length: 255 }),
    category: varchar({ length: 255 }),
    institution: varchar({ length: 255 }),
    ihepOrNaoc: varchar("ihep_or_naoc", { length: 255 }),
  });

  const antiTooProposal = pgTable(`cycle${n}_anti_too_proposal`, {
    proposalId: integer("proposal_id").primaryKey().notNull(),
    proposalNo: text("proposal_no"),
    no: integer(),
    piName: text("pi_name"),
    obsType: text("obs_type"),
    anticipatedToo: boolean("anticipated_too"),
    stp: integer(),
    category: text(),
    groupName: text("group_name"),
    observationsNumber: integer("observations_number"),
    totalExposureTime: integer("total_exposure_time"),
    exposureUnit: text("exposure_unit"),
    sourcePriority: text("source_priority"),
  });

  return {
    gp,
    gf,
    longTerm,
    longTermGf,
    sourceReports,
    skymapSources,
    skymapSchedule,
    proposal,
    antiTooProposal,
  };
}

export type CycleTables = ReturnType<typeof makeCycleTables>;

/** The logical table keys that exist for every cycle (used by the add-cycle script). */
export const CYCLE_TABLE_NAME = (n: number) => ({
  gp: `gp_cycle${n}`,
  gf: `cycle${n}_gf`,
  longTerm: `long_term_observation_list_cycle${n}`,
  longTermGf: `long_term_observation_list_cycle${n}_gf`,
  sourceReports: `gp_cycle${n}_source_reports`,
  skymapSources: `cycle${n}_skymap_sources`,
  skymapSchedule: `cycle${n}_skymap_schedule`,
  proposal: `gp_cycle${n}_proposal`,
  antiTooProposal: `cycle${n}_anti_too_proposal`,
});

// Memoized registry: build each registered cycle's tables exactly once.
const registry = new Map<number, CycleTables>();

const REGISTERED_CYCLES: number[] = (cyclesConfig.cycles as Array<{ cycle: number }>).map(
  (c) => c.cycle,
);

for (const n of REGISTERED_CYCLES) {
  registry.set(n, makeCycleTables(n));
}

/**
 * Returns the Drizzle table objects for the given cycle. Registered cycles are
 * served from the memoized registry; any other cycle is built (and cached) on
 * demand so the helper never throws for an unregistered-but-valid cycle number.
 */
export function getCycleTables(n: number): CycleTables {
  let tables = registry.get(n);
  if (!tables) {
    tables = makeCycleTables(n);
    registry.set(n, tables);
  }
  return tables;
}
