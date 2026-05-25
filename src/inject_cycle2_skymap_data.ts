import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";
import { sql } from "drizzle-orm";

type SourceCsvRow = {
  source_id?: string;
  source_name?: string;
  proposal_no?: string;
  pi?: string;
  obs_type?: string;
  source_priority?: string;
  ra?: string;
  dec?: string;
  total_exposure_time_all?: string;
};

type ScheduleCsvRow = {
  source_id?: string;
  visit_index?: string;
  n_visits?: string;
  exposure_s?: string;
  scheduled_date?: string;
  week_index?: string;
  note?: string;
};

const ROOT_DIR = process.cwd();
const LONGTERM_DIR = path.join(ROOT_DIR, "longterm_sch");
const SOURCE_CSV_PATH = path.join(LONGTERM_DIR, "cc2.csv");
const SCHEDULE_CSV_PATH = path.join(LONGTERM_DIR, "schedule_result.csv");
const BATCH_SIZE = 500;

async function loadModules() {
  const clientModule = await import(new URL("./db/client.ts", import.meta.url).href);
  const schemaModule = await import(new URL("./db/schema.ts", import.meta.url).href);

  return {
    db: clientModule.db,
    cycle2SkymapSources: schemaModule.cycle2SkymapSources,
    cycle2SkymapSchedule: schemaModule.cycle2SkymapSchedule,
  };
}

function toInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFloat(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: string | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function toIsoDate(value: string | undefined): string | null {
  const text = toText(value);
  if (!text) return null;
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (!match) return null;
  return match[0];
}

async function loadCsvRows<T extends Record<string, string | undefined>>(csvPath: string): Promise<T[]> {
  const content = await readFile(csvPath, "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}

async function insertInBatches<T extends Record<string, unknown>>(
  rows: T[],
  insertFn: (batch: T[]) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await insertFn(batch);
  }
}

async function main() {
  const { db, cycle2SkymapSources, cycle2SkymapSchedule } = await loadModules();

  console.log("[info] Importing cycle2 sky map source and schedule CSV data...");

  const [sourceCsvRows, scheduleCsvRows] = await Promise.all([
    loadCsvRows<SourceCsvRow>(SOURCE_CSV_PATH),
    loadCsvRows<ScheduleCsvRow>(SCHEDULE_CSV_PATH),
  ]);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cycle2_skymap_sources (
      id serial PRIMARY KEY,
      source_id integer NOT NULL,
      source_name varchar(255),
      proposal_no varchar(255),
      pi varchar(255),
      obs_type varchar(255),
      source_priority varchar(32),
      ra double precision,
      dec double precision,
      total_exposure_time_all integer,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT cycle2_skymap_sources_source_id_unique UNIQUE (source_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cycle2_skymap_schedule (
      id serial PRIMARY KEY,
      source_id integer NOT NULL,
      visit_index integer,
      n_visits integer,
      exposure_s integer,
      scheduled_date date,
      week_index integer,
      note text,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS cycle2_skymap_sources_source_id_idx ON cycle2_skymap_sources (source_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cycle2_skymap_sources_priority_idx ON cycle2_skymap_sources (source_priority)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cycle2_skymap_schedule_source_id_idx ON cycle2_skymap_schedule (source_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cycle2_skymap_schedule_week_index_idx ON cycle2_skymap_schedule (week_index)`);

  const sourceRows = sourceCsvRows
    .map((row) => {
      const sourceId = toInt(row.source_id);
      if (sourceId === null) return null;
      return {
        sourceId,
        sourceName: toText(row.source_name),
        proposalNo: toText(row.proposal_no),
        pi: toText(row.pi),
        obsType: toText(row.obs_type),
        sourcePriority: toText(row.source_priority),
        ra: toFloat(row.ra),
        dec: toFloat(row.dec),
        totalExposureTimeAll: toInt(row.total_exposure_time_all),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const scheduleRows = scheduleCsvRows
    .map((row) => {
      const sourceId = toInt(row.source_id);
      if (sourceId === null) return null;
      return {
        sourceId,
        visitIndex: toInt(row.visit_index),
        nVisits: toInt(row.n_visits),
        exposureS: toInt(row.exposure_s),
        scheduledDate: toIsoDate(row.scheduled_date),
        weekIndex: toInt(row.week_index),
        note: toText(row.note),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  await db.delete(cycle2SkymapSchedule).where(sql`${cycle2SkymapSchedule.dataset} = 'cycle2'`);
  await db.delete(cycle2SkymapSources).where(sql`${cycle2SkymapSources.dataset} = 'cycle2'`);

  await insertInBatches(sourceRows, async (batch) => {
    await db.insert(cycle2SkymapSources).values(batch);
  });

  await insertInBatches(scheduleRows, async (batch) => {
    await db.insert(cycle2SkymapSchedule).values(batch);
  });

  console.log(`[ok] Imported sources: ${sourceRows.length}`);
  console.log(`[ok] Imported schedule rows: ${scheduleRows.length}`);
}

main().catch((error) => {
  console.error("[error] Failed to import cycle2 sky map data:", error);
  process.exitCode = 1;
});
