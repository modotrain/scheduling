import "dotenv/config";

import { eq } from "drizzle-orm";

import { parseCycleArg } from "./db/cycle-cli";

/**
 * Imports GF sources and schedule data from the existing cycle2_gf and
 * long_term_observation_list_cycle2_gf tables into the shared
 * cycle2_skymap_sources / cycle2_skymap_schedule tables under dataset='gf'.
 *
 * Run after the 0006 migration:
 *   npx tsx src/inject_cycle_gf_skymap_data.ts
 */

const BATCH_SIZE = 500;
const DATASET = "gf" as const;

async function loadModules(cycle: number) {
  const clientModule = await import(new URL("./db/client.ts", import.meta.url).href);
  const cycleTablesModule = await import(new URL("./db/cycle-tables.ts", import.meta.url).href);
  const tables = cycleTablesModule.getCycleTables(cycle);

  return {
    db: clientModule.db,
    cycle2GF: tables.gf,
    longTermObservationListCycle2GF: tables.longTermGf,
    cycle2SkymapSources: tables.skymapSources,
    cycle2SkymapSchedule: tables.skymapSchedule,
  };
}

function toInt(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFloat(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

/**
 * Convert exposure to integer seconds.
 * GF data uses 'second' as unit; other units are handled defensively.
 */
function toExposureSeconds(value: string | null | undefined, unit: string | null | undefined): number | null {
  const amount = toFloat(value);
  if (amount === null) return null;
  const u = (unit ?? "second").trim().toLowerCase();
  if (u === "ks" || u === "kilosecond" || u === "kiloseconds") return Math.round(amount * 1000);
  if (u === "hr" || u === "hour" || u === "hours") return Math.round(amount * 3600);
  if (u === "ms" || u === "millisecond" || u === "milliseconds") return Math.round(amount / 1000);
  // 'second' / 's' / fallback
  return Math.round(amount);
}

function toIsoDate(value: string | null | undefined): string | null {
  const text = toText(value);
  if (!text) return null;
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function parseWeekIndex(weekId: string | null | undefined): number | null {
  if (!weekId) return null;
  const match = weekId.match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function insertInBatches<T extends Record<string, unknown>>(
  rows: T[],
  insertFn: (batch: T[]) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await insertFn(rows.slice(i, i + BATCH_SIZE));
  }
}

async function main() {
  const cycle = parseCycleArg();
  const { db, cycle2GF, longTermObservationListCycle2GF, cycle2SkymapSources, cycle2SkymapSchedule } =
    await loadModules(cycle);

  console.log("[info] Loading GF source and schedule data from DB...");

  const [gfSources, gfPlanRows] = await Promise.all([
    db.select().from(cycle2GF),
    db.select().from(longTermObservationListCycle2GF),
  ]);

  console.log(`[info] GF sources: ${gfSources.length}, GF weekly plan rows: ${gfPlanRows.length}`);

  // ── Build source rows (deduplicate by sourceId, first row wins) ──────────
  const seenSourceIds = new Set<number>();
  const sourceRows: Array<{
    dataset: string;
    sourceId: number;
    sourceName: string | null;
    proposalNo: string | null;
    pi: string | null;
    obsType: string | null;
    sourcePriority: string | null;
    ra: number | null;
    dec: number | null;
    totalExposureTimeAll: number | null;
  }> = [];

  for (const row of gfSources) {
    const sourceId = toInt(row.sourceId);
    if (sourceId === null) continue;
    if (seenSourceIds.has(sourceId)) continue;
    seenSourceIds.add(sourceId);
    sourceRows.push({
      dataset: DATASET,
      sourceId,
      sourceName: toText(row.sourceName),
      proposalNo: toText(row.proposalNo),
      pi: toText(row.pi),
      obsType: toText(row.obsType),
      sourcePriority: toText(row.sourcePriority),
      ra: toFloat(row.ra),
      dec: toFloat(row.dec),
      totalExposureTimeAll: toExposureSeconds(row.totalExposureTime, row.exposureTimeUnit),
    });
  }

  // ── Build schedule rows from weekly plan table ───────────────────────────
  // Each row represents one week of observation for one source.
  // totalExposureTime = exposure for that week visit (unit: 'second')
  const scheduleRows: Array<{
    dataset: string;
    sourceId: number;
    weekIndex: number | null;
    exposureS: number | null;
    scheduledDate: string | null;
  }> = [];

  for (const row of gfPlanRows) {
    const sourceId = toInt(row.sourceId);
    if (sourceId === null) continue;
    scheduleRows.push({
      dataset: DATASET,
      sourceId,
      weekIndex: parseWeekIndex(row.weekId),
      exposureS: toExposureSeconds(row.totalExposureTime, row.exposureTimeUnit),
      scheduledDate: toIsoDate(row.startTime),
    });
  }

  // ── Clear existing GF rows and insert fresh ──────────────────────────────
  console.log("[info] Deleting existing GF rows from skymap tables...");
  await db.delete(cycle2SkymapSchedule).where(eq(cycle2SkymapSchedule.dataset, DATASET));
  await db.delete(cycle2SkymapSources).where(eq(cycle2SkymapSources.dataset, DATASET));

  console.log(`[info] Inserting ${sourceRows.length} GF source rows...`);
  await insertInBatches(sourceRows, async (batch) => {
    await db.insert(cycle2SkymapSources).values(batch);
  });

  console.log(`[info] Inserting ${scheduleRows.length} GF schedule rows...`);
  await insertInBatches(scheduleRows, async (batch) => {
    await db.insert(cycle2SkymapSchedule).values(batch);
  });

  console.log(`[ok] GF sources imported: ${sourceRows.length}`);
  console.log(`[ok] GF schedule rows imported: ${scheduleRows.length}`);
}

main().catch((error) => {
  console.error("[error] Failed to import GF skymap data:", error);
  process.exitCode = 1;
});
