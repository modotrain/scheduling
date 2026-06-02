import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { getCycleTables } from "@/src/db/cycle-tables";
import { resolveCycleFromRequest } from "@/app/lib/cycles";

type SourceDataset = string;

type SourceRow = {
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
};

type ScheduleAggRow = {
  nScheduled: number;
  minWeek: number | null;
  maxWeek: number | null;
  minDate: string | null;
  maxDate: string | null;
};

type WeeklyExposure = {
  weekIndex: number;
  exposureS: number;
};

type WeekBound = {
  weekIndex: number;
  startDate: string | null;
  endDate: string | null;
};

type RegionStat = {
  iRa: number;
  iDec: number;
  raLo: number;
  raHi: number;
  decLo: number;
  decHi: number;
  totalExposureKs: number;
  alpha: number;
  nSources: number;
};

type ScheduleRow = {
  dataset: string;
  sourceId: number;
  weekIndex: number | null;
  exposureS: number | null;
  scheduledDate: string | null;
};

const N_RA = 6;
const N_DEC = 2;
const RA_EDGES = Array.from({ length: N_RA + 1 }, (_v, i) => (360 / N_RA) * i);
const DEC_EDGES = [-90, 0, 90];

function makeSourceKey(dataset: SourceDataset, sourceId: number): string {
  return `${dataset}:${sourceId}`;
}

function normalizeRa(ra: number): number {
  const mod = ((ra % 360) + 360) % 360;
  return mod === 360 ? 0 : mod;
}

function extractIsoDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

export async function GET(request: Request) {
  try {
    const cycle = resolveCycleFromRequest(request);
    const cycleTables = getCycleTables(cycle);
    const defaultDataset = `cycle${cycle}`;
    const cycle2SkymapSources = cycleTables.skymapSources;
    const cycle2SkymapSchedule = cycleTables.skymapSchedule;
    const [sourcesRaw, scheduleRowsRaw] = await Promise.all([
      db.select().from(cycle2SkymapSources),
      db
        .select({
          dataset: cycle2SkymapSchedule.dataset,
          sourceId: cycle2SkymapSchedule.sourceId,
          weekIndex: cycle2SkymapSchedule.weekIndex,
          exposureS: cycle2SkymapSchedule.exposureS,
          scheduledDate: cycle2SkymapSchedule.scheduledDate,
        })
        .from(cycle2SkymapSchedule),
    ]);

    const sources = sourcesRaw as SourceRow[];
    const scheduleRows = scheduleRowsRaw as ScheduleRow[];

    // ── Aggregate schedule per (dataset, sourceId) ────────────────────────
    const scheduleAggMap = new Map<string, ScheduleAggRow>();
    const weeklyExposureMap = new Map<string, Map<number, number>>();
    const weekDateMap = new Map<number, { startDate: string | null; endDate: string | null }>();

    for (const row of scheduleRows) {
      const dataset = (row.dataset || defaultDataset) as SourceDataset;
      const sourceKey = makeSourceKey(dataset, row.sourceId);
      const weekIndex = row.weekIndex ?? null;
      const exposureS = row.exposureS ?? 0;
      const scheduledDate = extractIsoDate(row.scheduledDate);

      // Per-source aggregates
      const existing = scheduleAggMap.get(sourceKey);
      if (!existing) {
        scheduleAggMap.set(sourceKey, {
          nScheduled: 1,
          minWeek: weekIndex,
          maxWeek: weekIndex,
          minDate: scheduledDate,
          maxDate: scheduledDate,
        });
      } else {
        existing.nScheduled += 1;
        if (weekIndex !== null) {
          existing.minWeek = existing.minWeek === null ? weekIndex : Math.min(existing.minWeek, weekIndex);
          existing.maxWeek = existing.maxWeek === null ? weekIndex : Math.max(existing.maxWeek, weekIndex);
        }
        if (scheduledDate) {
          existing.minDate = existing.minDate ? (scheduledDate < existing.minDate ? scheduledDate : existing.minDate) : scheduledDate;
          existing.maxDate = existing.maxDate ? (scheduledDate > existing.maxDate ? scheduledDate : existing.maxDate) : scheduledDate;
        }
      }

      // Per-source per-week exposure
      if (weekIndex !== null) {
        const weekMap = weeklyExposureMap.get(sourceKey) ?? new Map<number, number>();
        weekMap.set(weekIndex, (weekMap.get(weekIndex) ?? 0) + exposureS);
        weeklyExposureMap.set(sourceKey, weekMap);
      }

      // Global week bounds (used for weekBounds / slider): keep week index even when date is missing.
      if (weekIndex !== null) {
        const existing = weekDateMap.get(weekIndex);
        if (!existing) {
          weekDateMap.set(weekIndex, { startDate: scheduledDate, endDate: scheduledDate });
        } else if (scheduledDate) {
          existing.startDate = existing.startDate && existing.startDate < scheduledDate ? existing.startDate : scheduledDate;
          existing.endDate = existing.endDate && existing.endDate > scheduledDate ? existing.endDate : scheduledDate;
        }
      }
    }

    const weekBounds: WeekBound[] = Array.from(weekDateMap.entries())
      .map(([weekIndex, value]) => ({ weekIndex, startDate: value.startDate, endDate: value.endDate }))
      .sort((a, b) => a.weekIndex - b.weekIndex);

    // ── Build points from all sources (cycle2 + gf) ───────────────────────
    const points = sources
      .filter((row) => row.ra !== null && row.dec !== null)
      .map((row) => {
        const dataset = (row.dataset || defaultDataset) as SourceDataset;
        const exposureS = row.totalExposureTimeAll ?? 0;
        const exposureClipped = Math.max(exposureS, 1);
        const sourceKey = makeSourceKey(dataset, row.sourceId);
        const scheduleAgg = scheduleAggMap.get(sourceKey);
        const weeklyExposure = Array.from(weeklyExposureMap.get(sourceKey)?.entries() ?? [])
          .map(([weekIndex, weekExposureS]) => ({ weekIndex, exposureS: weekExposureS }))
          .sort((a, b) => a.weekIndex - b.weekIndex) as WeeklyExposure[];

        // Determine point type: calibration or normal
        let pointType: "normal" | "fxt-calibration" | "wxt-calibration" = "normal";
        if (row.obsType === "GP-CAL") {
          if (row.pi === "FXT") {
            pointType = "fxt-calibration";
          } else if (row.pi === "WXT") {
            pointType = "wxt-calibration";
          }
        }

        return {
          dataset,
          sourceId: row.sourceId,
          sourceName: row.sourceName,
          proposalNo: row.proposalNo,
          pi: row.pi,
          obsType: row.obsType,
          sourcePriority: row.sourcePriority,
          pointType,
          ra: row.ra as number,
          dec: row.dec as number,
          totalExposureTimeAll: exposureS,
          totalExposureKs: exposureS / 1000,
          pointSize: 20 + Math.sqrt(exposureClipped) * 1.5,
          nScheduled: scheduleAgg?.nScheduled ?? 0,
          minWeek: scheduleAgg?.minWeek ?? null,
          maxWeek: scheduleAgg?.maxWeek ?? null,
          scheduledDateStart: scheduleAgg?.minDate ?? null,
          scheduledDateEnd: scheduleAgg?.maxDate ?? null,
          visibleDateRanges: null as string | null,
          weeklyExposure,
        };
      });

    const regionMap = new Map<string, RegionStat>();
    for (let iRa = 0; iRa < N_RA; iRa += 1) {
      for (let iDec = 0; iDec < N_DEC; iDec += 1) {
        regionMap.set(`${iRa}-${iDec}`, {
          iRa,
          iDec,
          raLo: RA_EDGES[iRa],
          raHi: RA_EDGES[iRa + 1],
          decLo: DEC_EDGES[iDec],
          decHi: DEC_EDGES[iDec + 1],
          totalExposureKs: 0,
          alpha: 0.45,
          nSources: 0,
        });
      }
    }

    for (const point of points) {
      const ra = normalizeRa(point.ra);
      const dec = point.dec;
      const iRa = Math.min(Math.floor(ra / (360 / N_RA)), N_RA - 1);
      const iDec = dec < 0 ? 0 : 1;
      const region = regionMap.get(`${iRa}-${iDec}`);
      if (!region) continue;
      region.totalExposureKs += point.totalExposureKs;
      region.nSources += 1;
    }

    const regions = Array.from(regionMap.values());
    const exposureValues = regions.map((item) => item.totalExposureKs);
    const minExp = Math.min(...exposureValues);
    const maxExp = Math.max(...exposureValues);
    const expRange = maxExp > minExp ? maxExp - minExp : 1;
    for (const region of regions) {
      const normalized = (region.totalExposureKs - minExp) / expRange;
      region.alpha = 0.45 - normalized * (0.45 - 0.15);
    }

    // ── Identify calibration sources and compute statistics ──────────────
    const calibrationSources = sources.filter(
      (row) => row.obsType === "GP-CAL" && (row.pi === "FXT" || row.pi === "WXT")
    );
    const fxtCalibration = calibrationSources.filter((row) => row.pi === "FXT");
    const wxtCalibration = calibrationSources.filter((row) => row.pi === "WXT");

    const fxtCalibrationExposureS = fxtCalibration.reduce(
      (sum, row) => sum + (row.totalExposureTimeAll ?? 0),
      0
    );
    const wxtCalibrationExposureS = wxtCalibration.reduce(
      (sum, row) => sum + (row.totalExposureTimeAll ?? 0),
      0
    );
    const calibrationIds = new Set(calibrationSources.map((row) => `${row.dataset}:${row.sourceId}`));

    // Count priorities (GF sources are treated as priority D)
    const nonCalibrationPoints = points.filter((p) => !calibrationIds.has(`${p.dataset}:${p.sourceId}`));
    const priorities = {
      A: nonCalibrationPoints.filter((item) => item.sourcePriority === "A").length,
      B: nonCalibrationPoints.filter((item) => item.sourcePriority === "B").length,
      C: nonCalibrationPoints.filter((item) => item.sourcePriority === "C").length,
      D: nonCalibrationPoints.filter((item) => item.dataset === "gf").length,
    };

    const totalExposureS = points.reduce((sum, point) => sum + point.totalExposureTimeAll, 0);

    return NextResponse.json({
      points,
      regions,
      weekBounds,
      projection: { type: "mollweide", raEdges: RA_EDGES, decEdges: DEC_EDGES },
      summary: {
        totalSources: nonCalibrationPoints.length,
        totalExposureS,
        totalExposureMillionS: totalExposureS / 1_000_000,
        priorities,
        fxtCalibration: {
          count: fxtCalibration.length,
          exposureS: fxtCalibrationExposureS,
          exposureMillionS: fxtCalibrationExposureS / 1_000_000,
        },
        wxtCalibration: {
          count: wxtCalibration.length,
          exposureS: wxtCalibrationExposureS,
          exposureMillionS: wxtCalibrationExposureS / 1_000_000,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sky map data" },
      { status: 500 },
    );
  }
}
