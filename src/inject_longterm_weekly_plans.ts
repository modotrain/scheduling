import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";

import { parseCycleArg } from "./db/cycle-cli";

type CsvRow = Record<string, string>;
type LongTermInsert = Record<string, string | null>;

const WEEKLY_PLANS_DIR = path.join(process.cwd(), "longterm_sch", "weekly_plans");
const WEEK_FILE_PATTERN = /^week_(\d{2})_\d{4}-\d{2}-\d{2}\.csv$/;
const INSERT_BATCH_SIZE = 500;

async function loadModules(cycle: number) {
  const clientModule = await import(new URL("./db/client.ts", import.meta.url).href);
  const cycleTablesModule = await import(new URL("./db/cycle-tables.ts", import.meta.url).href);
  const tables = cycleTablesModule.getCycleTables(cycle);

  return {
    db: clientModule.db,
    longTermObservationListCycle2: tables.longTerm,
  };
}

function toNullable(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "null") {
    return null;
  }

  return normalized;
}

function parseWeekId(fileName: string): string {
  const match = fileName.match(WEEK_FILE_PATTERN);
  if (!match) {
    throw new Error(`Unexpected weekly plan filename: ${fileName}`);
  }

  return String(Number.parseInt(match[1], 10));
}

function mapRowToInsert(row: CsvRow, weekId: string): LongTermInsert {
  return {
    tdicId: toNullable(row.id),
    sourceId: toNullable(row.source_id),
    proposalId: toNullable(row.proposal_id),
    proposalNo: toNullable(row.proposal_no),
    epDbObjectId: toNullable(row.EP_DB_OBJECT_ID),
    weekId,
    pi: toNullable(row.pi),
    groupName: toNullable(row.group),
    sourceName: toNullable(row.source_name),
    obsType: toNullable(row.obs_type),
    ra: toNullable(row.ra),
    dec: toNullable(row.dec),
    totalExposureTime: toNullable(row.total_exposure_time),
    totalExposureTimeAll: toNullable(row.total_exposure_time_all),
    exposureTimeUnit: toNullable(row.exposure_time_unit),
    continousExposure: toNullable(row.continous_exposure),
    visitNumber: toNullable(row.visit_number),
    exposurePerVistMin: toNullable(row.exposure_per_vist_min),
    exposurePerVistMax: toNullable(row.exposure_per_vist_max),
    completeness: toNullable(row.completeness),
    cadence: toNullable(row.cadence),
    cadenceUnit: toNullable(row.cadence_unit),
    precision: toNullable(row.precision),
    precisionUnit: toNullable(row.precision_unit),
    startTime: toNullable(row.start_time),
    endTime: toNullable(row.end_time),
    sourcePriority: toNullable(row.source_priority),
    fxt1WindowMode: toNullable(row.fxt1_window_mode),
    fxt1Filter: toNullable(row.fxt1_filter),
    fxt2WindowMode: toNullable(row.fxt2_window_mode),
    fxt2Filter: toNullable(row.fxt2_filter),
    isUpdated: toNullable(row.is_updated),
    payload: toNullable(row.Payload),
    wxtCmos: toNullable(row.WXT_CMOS),
    wxtCmosX: toNullable(row.WXT_CMOS_X),
    wxtCmosY: toNullable(row.WXT_CMOS_Y),
    fxtCmr: toNullable(row.FXT_CMR),
    fxtX: toNullable(row.FXT_X),
    fxtY: toNullable(row.FXT_Y),
    isForDisrupted: toNullable(row.is_for_disrupted),
    visibleDays: toNullable(row.visible_days),
    visibleDateRanges: toNullable(row.visible_date_ranges),
    visibleRangeCount: toNullable(row.visible_range_count),
    visibleTotalDays: toNullable(row.visible_total_days),
    visibleDateRangesOnlySun: toNullable(row.visible_date_ranges_onlySun),
    visibleFirstEnd: toNullable(row.visible_first_end),
    visibleLastEnd: toNullable(row.visible_last_end),
    mtDays: toNullable(row.MT_days),
    leftMtDays: toNullable(row.left_MT_days),
  };
}

async function main() {
  const cycle = parseCycleArg();
  const { db, longTermObservationListCycle2 } = await loadModules(cycle);
  const fileNames = (await readdir(WEEKLY_PLANS_DIR))
    .filter((fileName) => WEEK_FILE_PATTERN.test(fileName))
    .sort((left, right) => left.localeCompare(right));

  if (fileNames.length === 0) {
    throw new Error(`No weekly plan CSV files found in ${WEEKLY_PLANS_DIR}`);
  }

  const records: LongTermInsert[] = [];

  for (const fileName of fileNames) {
    const weekId = parseWeekId(fileName);
    const csvFilePath = path.join(WEEKLY_PLANS_DIR, fileName);
    const csvContent = await readFile(csvFilePath, "utf8");
    const rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as CsvRow[];

    for (const row of rows) {
      records.push(mapRowToInsert(row, weekId));
    }
  }

  await db.delete(longTermObservationListCycle2);

  let insertedCount = 0;

  for (let index = 0; index < records.length; index += INSERT_BATCH_SIZE) {
    const batch = records.slice(index, index + INSERT_BATCH_SIZE);
    const inserted = await db
      .insert(longTermObservationListCycle2)
      .values(batch)
      .returning({ id: longTermObservationListCycle2.id });
    insertedCount += inserted.length;
  }

  console.log(`Imported ${insertedCount} rows into long_term_observation_list_cycle2 from ${fileNames.length} weekly plan files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
