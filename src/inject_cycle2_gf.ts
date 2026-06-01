import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";

import { parseCycleArg } from "./db/cycle-cli";

type CsvRow = Record<string, string>;
type Cycle2GfInsert = Record<string, string | null>;

const CSV_PATH = path.join(
  process.cwd(),
  "longterm_sch",
  "reviewed_cycle2_source_list_GF_forDatabase.csv",
);
const INSERT_BATCH_SIZE = 500;

async function loadModules(cycle: number) {
  const clientModule = await import(new URL("./db/client.ts", import.meta.url).href);
  const cycleTablesModule = await import(new URL("./db/cycle-tables.ts", import.meta.url).href);
  const tables = cycleTablesModule.getCycleTables(cycle);

  return {
    db: clientModule.db,
    cycle2GF: tables.gf,
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

function mapRowToInsert(row: CsvRow): Cycle2GfInsert {
  return {
    tdicId: toNullable(row.id),
    sourceId: toNullable(row.source_id),
    proposalId: toNullable(row.proposal_id),
    proposalNo: toNullable(row.proposal_no),
    pi: toNullable(row.pi),
    userGroup: toNullable(row.group),
    sourceName: toNullable(row.source_name),
    obsType: toNullable(row.obs_type),
    ra: toNullable(row.ra),
    dec: toNullable(row.dec),
    totalExposureTime: toNullable(row.total_exposure_time),
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
    anticipatedToo: toNullable(row.is_anticipatedToo),
    stp: toNullable(row.is_stp),
    category: toNullable(row.is_category),
    type: toNullable(row.main_type),
    payload: toNullable(row.Payload),
    wxtCmos: toNullable(row.WXT_CMOS),
    cmosX: toNullable(row.WXT_CMOS_X),
    cmosY: toNullable(row.WXT_CMOS_Y),
    fxtCmr: toNullable(row.FXT_CMR),
    cmrX: toNullable(row.FXT_X),
    cmrY: toNullable(row.FXT_Y),
  };
}

async function main() {
  const cycle = parseCycleArg();
  const { db, cycle2GF } = await loadModules(cycle);

  const csvContent = await readFile(CSV_PATH, "utf8");
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];

  const records = rows.map((row) => mapRowToInsert(row));

  await db.delete(cycle2GF);

  let insertedCount = 0;
  for (let index = 0; index < records.length; index += INSERT_BATCH_SIZE) {
    const batch = records.slice(index, index + INSERT_BATCH_SIZE);
    const inserted = await db
      .insert(cycle2GF)
      .values(batch)
      .returning({ id: cycle2GF.id });
    insertedCount += inserted.length;
  }

  console.log(`Imported ${insertedCount} rows into cycle2_gf from ${CSV_PATH}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
