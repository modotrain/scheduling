/**
 * Import GP Cycle 2 source reports data into the gp_cycle2_source_reports table.
 * 
 * Input:
 * - CSV: /longterm_sch/reviewed_cycle2_source_list_GP_visibility_eachday.csv
 * - Text: /longterm_sch/source_reports/{sourceId}_{sourceName}.txt
 * - Schedule: /longterm_sch/schedule_result.csv
 * 
 * Output:
 * - Populates gp_cycle2_source_reports table with chart data and summaries
 */

import * as dotenv from "dotenv";
dotenv.config();

import * as fs from "fs";
import * as path from "path";
import { parse as parseCSV } from "csv-parse/sync";
import { db } from "./db/client.ts";
import { gpCycle2SourceReports } from "./db/schema.ts";

const LONGTERM_SCH_DIR = path.join(process.cwd(), "longterm_sch");

type DatasetType = "cycle2" | "gf";

function readDatasetArg(): DatasetType {
  const arg = process.argv.find((item) => item.startsWith("--dataset="));
  const fromArg = arg?.split("=")[1]?.trim().toLowerCase();
  const fromEnv = process.env.SOURCE_REPORT_DATASET?.trim().toLowerCase();
  const value = fromArg || fromEnv || "cycle2";
  return value === "gf" ? "gf" : "cycle2";
}

function resolveInputs(dataset: DatasetType): {
  sourceCsv: string;
  scheduleCsv: string;
  reportDir: string;
} {
  const defaults = dataset === "gf"
    ? {
      sourceCsv: path.join(LONGTERM_SCH_DIR, "reviewed_cycle2_source_list_GF_forDatabase.csv"),
      scheduleCsv: path.join(LONGTERM_SCH_DIR, "schedule_gf_records.csv"),
      reportDir: path.join(LONGTERM_SCH_DIR, "source_reports_gf"),
    }
    : {
      sourceCsv: path.join(LONGTERM_SCH_DIR, "cc2.csv"),
      scheduleCsv: path.join(LONGTERM_SCH_DIR, "schedule_result.csv"),
      reportDir: path.join(LONGTERM_SCH_DIR, "source_reports"),
    };

  return {
    sourceCsv: process.env.SOURCE_REPORT_SOURCE_CSV || defaults.sourceCsv,
    scheduleCsv: process.env.SOURCE_REPORT_SCHEDULE_CSV || defaults.scheduleCsv,
    reportDir: process.env.SOURCE_REPORT_DIR || defaults.reportDir,
  };
}

// Color mapping for obs types
const OBS_COLORS: Record<string, string> = {
  "GP-PPT-MT": "#dc2626", // red
  "GP-PPT-LT": "#2563eb", // blue
  "GP-PPT-ST": "#16a34a", // green
  "GP-PPT-TT": "#ea580c", // orange
  "GP-CAL": "#7eb117", // default green
};

interface SourceRow {
  source_id: string;
  source_name: string;
  proposal_id: string;
  proposal_no: string;
  pi: string;
  group: string;
  obs_type: string;
  source_priority: string;
  ra: string;
  dec: string;
  total_exposure_time_all: string;
  visit_number: string;
  exposure_per_vist_min: string;
  exposure_per_vist_max: string;
  visible_date_ranges: string;
  visible_total_days: string;
  [key: string]: string | undefined;
}

interface ScheduleRow {
  source_id: string;
  scheduled_date: string;
  week_start_date: string;
  week_index: string;
  exposure_s: string;
  [key: string]: string | undefined;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface ChartData extends Record<string, JsonValue> {
  visibleRanges: Array<[string, string]>;
  visibleTotalDays: number;
  scheduledObs: Array<{
    date: string;
    exp_s: number;
    week: number | null;
  }>;
  dateRange: { min: string; max: string };
  obsType: string;
  color: string;
}

function parseVisibleRanges(visibleRangesStr: string | null): Array<[string, string]> {
  if (!visibleRangesStr || typeof visibleRangesStr !== "string") {
    return [];
  }
  const ranges: Array<[string, string]> = [];
  const segments = visibleRangesStr.split(";");
  for (const seg of segments) {
    const match = seg.match(/(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})/);
    if (match) {
      ranges.push([match[1], match[2]]);
    }
  }
  return ranges;
}

function safeReadTxtFile(sourceId: number, sourceName: string, reportDir: string): string {
  const safeName = String(sourceName)
    .replace(/[^\w\-+.]/g, "_")
    .substring(0, 80);
  const filePath = path.join(reportDir, `${sourceId.toString().padStart(5, "0")}_${safeName}.txt`);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (err) {
    console.warn(`Failed to read ${filePath}:`, err);
  }
  return "";
}

async function main() {
  const dataset = readDatasetArg();
  const { sourceCsv, scheduleCsv, reportDir } = resolveInputs(dataset);

  console.log(`[info] Starting source reports import for dataset=${dataset}...`);

  // Read CSV
  if (!fs.existsSync(sourceCsv)) {
    console.error(`[error] CSV not found: ${sourceCsv}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(sourceCsv, "utf-8");
  const sourceRows = parseCSV(csvContent, { columns: true }) as SourceRow[];
  console.log(`[info] Loaded ${sourceRows.length} source rows from CSV`);

  // Read schedule data
  const scheduleRows = parseCSV(fs.readFileSync(scheduleCsv, "utf-8"), { columns: true }) as ScheduleRow[];
  console.log(`[info] Loaded ${scheduleRows.length} schedule rows`);

  // Group schedule by source_id
  const scheduleBySource: Record<number, ScheduleRow[]> = {};
  for (const row of scheduleRows) {
    const sourceId = parseInt(row.source_id, 10);
    if (!scheduleBySource[sourceId]) {
      scheduleBySource[sourceId] = [];
    }
    scheduleBySource[sourceId].push(row);
  }

  // Date range for chart (plan span)
  let minDate = "2025-08-12";
  let maxDate = "2026-08-12";
  try {
    const dates = scheduleRows
      .map((r) => r.scheduled_date)
      .filter((d) => d && d.match(/\d{4}-\d{2}-\d{2}/));
    if (dates.length > 0) {
      dates.sort();
      minDate = dates[0];
      maxDate = dates[dates.length - 1];
    }
  } catch {
    console.warn("[warn] Failed to parse schedule dates, using defaults");
  }

  let successCount = 0;
  let errorCount = 0;

  // Process sources in batches
  const batchSize = 50;
  for (let i = 0; i < sourceRows.length; i += batchSize) {
    const batch = sourceRows.slice(i, i + batchSize);

    for (const sourceRow of batch) {
      try {
        const sourceId = parseInt(sourceRow.source_id, 10);
        const sourceName = String(sourceRow.source_name || "Unknown").trim();
        const obsType = String(sourceRow.obs_type || "").trim();
        const visibleRangesStr = sourceRow.visible_date_ranges;
        const visibleTotalDays = parseInt(sourceRow.visible_total_days || "0", 10);

        // Parse requirements
        const requiredExp = parseInt(sourceRow.total_exposure_time_all || "0", 10);
        const requiredVisits = parseInt(sourceRow.visit_number || "0", 10);
        const perVisitMin = parseInt(sourceRow.exposure_per_vist_min || "0", 10);
        const perVisitMax = parseInt(sourceRow.exposure_per_vist_max || "0", 10);

        // Get scheduled data
        const scheduled = scheduleBySource[sourceId] || [];
        const scheduledExp = scheduled.reduce((sum, r) => sum + parseInt(r.exposure_s || "0", 10), 0);
        const exposureRatio = requiredExp > 0 ? scheduledExp / requiredExp : null;

        // Build chart data
        const visibleRanges = parseVisibleRanges(visibleRangesStr);
        const chartData: ChartData = {
          visibleRanges,
          visibleTotalDays,
          scheduledObs: scheduled
            .sort((a, b) => {
              const dateA = new Date(a.scheduled_date || a.week_start_date).getTime();
              const dateB = new Date(b.scheduled_date || b.week_start_date).getTime();
              return dateA - dateB;
            })
            .map((r) => ({
              date: r.scheduled_date ? r.scheduled_date.split("T")[0] : "",
              exp_s: parseInt(r.exposure_s || "0", 10),
              week: r.week_index ? parseInt(r.week_index, 10) : null,
            })),
          dateRange: { min: minDate, max: maxDate },
          obsType,
          color: OBS_COLORS[obsType] || "#7eb117",
        };

        // Read summary text
        const summaryText = safeReadTxtFile(sourceId, sourceName, reportDir);

        // Insert or update into DB
        await db
          .insert(gpCycle2SourceReports)
          .values({
            dataset,
            sourceId,
            sourceName,
            proposalId: sourceRow.proposal_id,
            proposalNo: sourceRow.proposal_no,
            pi: sourceRow.pi,
            userGroup: sourceRow.group,
            obsType,
            priority: sourceRow.source_priority,
            ra: sourceRow.ra,
            dec: sourceRow.dec,
            requiredExposureS: requiredExp,
            requiredVisits,
            perVisitMinS: perVisitMin,
            perVisitMaxS: perVisitMax,
            scheduledExposureS: scheduledExp || null,
            scheduledVisits: scheduled.length || null,
            exposureRatio: exposureRatio || null,
            chartData: chartData as JsonValue,
            summaryText,
          })
          .onConflictDoUpdate({
            target: [gpCycle2SourceReports.dataset, gpCycle2SourceReports.sourceId],
            set: {
              chartData: chartData as JsonValue,
              summaryText,
              scheduledExposureS: scheduledExp || null,
              scheduledVisits: scheduled.length || null,
              exposureRatio: exposureRatio || null,
              updatedAt: new Date().toISOString(),
            },
          });

        successCount++;
        if (successCount % 50 === 0) {
          console.log(`[progress] Imported ${successCount} sources...`);
        }
      } catch (err) {
        errorCount++;
        console.warn(
          `[warn] Failed to import source: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  console.log(
    `[ok] Imported ${successCount} sources, ${errorCount} errors, total = ${successCount + errorCount}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[error]", err);
  process.exit(1);
});
