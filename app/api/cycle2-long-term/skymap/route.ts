import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { cycle2SkymapSchedule, cycle2SkymapSources } from "@/src/db/schema";

type SourceRow = {
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
  sourceId: number;
  nScheduled: number;
  minWeek: number | null;
  maxWeek: number | null;
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

const N_RA = 6;
const N_DEC = 2;
const RA_EDGES = Array.from({ length: N_RA + 1 }, (_v, i) => (360 / N_RA) * i);
const DEC_EDGES = [-90, 0, 90];

function normalizeRa(ra: number): number {
  const mod = ((ra % 360) + 360) % 360;
  return mod === 360 ? 0 : mod;
}

export async function GET() {
  try {
    const [sourcesRaw, scheduleAggRaw] = await Promise.all([
      db.select().from(cycle2SkymapSources),
      db
        .select({
          sourceId: cycle2SkymapSchedule.sourceId,
          nScheduled: cycle2SkymapSchedule.id,
          minWeek: cycle2SkymapSchedule.weekIndex,
          maxWeek: cycle2SkymapSchedule.weekIndex,
        })
        .from(cycle2SkymapSchedule),
    ]);

    const sources = sourcesRaw as SourceRow[];

    const scheduleMap = new Map<number, ScheduleAggRow>();
    for (const row of scheduleAggRaw) {
      const sourceId = row.sourceId;
      const existing = scheduleMap.get(sourceId);
      if (!existing) {
        scheduleMap.set(sourceId, {
          sourceId,
          nScheduled: 1,
          minWeek: row.minWeek ?? null,
          maxWeek: row.maxWeek ?? null,
        });
        continue;
      }
      existing.nScheduled += 1;
      if (row.minWeek !== null && row.minWeek !== undefined) {
        existing.minWeek = existing.minWeek === null ? row.minWeek : Math.min(existing.minWeek, row.minWeek);
      }
      if (row.maxWeek !== null && row.maxWeek !== undefined) {
        existing.maxWeek = existing.maxWeek === null ? row.maxWeek : Math.max(existing.maxWeek, row.maxWeek);
      }
    }

    const points = sources
      .filter((row) => row.ra !== null && row.dec !== null)
      .map((row) => {
        const exposureS = row.totalExposureTimeAll ?? 0;
        const exposureClipped = Math.max(exposureS, 1);
        const scheduleAgg = scheduleMap.get(row.sourceId);
        return {
          sourceId: row.sourceId,
          sourceName: row.sourceName,
          proposalNo: row.proposalNo,
          pi: row.pi,
          obsType: row.obsType,
          sourcePriority: row.sourcePriority,
          ra: row.ra,
          dec: row.dec,
          totalExposureTimeAll: exposureS,
          totalExposureKs: exposureS / 1000,
          pointSize: 20 + Math.sqrt(exposureClipped) * 1.5,
          nScheduled: scheduleAgg?.nScheduled ?? 0,
          minWeek: scheduleAgg?.minWeek ?? null,
          maxWeek: scheduleAgg?.maxWeek ?? null,
        };
      });

    const regionMap = new Map<string, RegionStat>();
    for (let iRa = 0; iRa < N_RA; iRa += 1) {
      for (let iDec = 0; iDec < N_DEC; iDec += 1) {
        const raLo = RA_EDGES[iRa];
        const raHi = RA_EDGES[iRa + 1];
        const decLo = DEC_EDGES[iDec];
        const decHi = DEC_EDGES[iDec + 1];
        regionMap.set(`${iRa}-${iDec}`, {
          iRa,
          iDec,
          raLo,
          raHi,
          decLo,
          decHi,
          totalExposureKs: 0,
          alpha: 0.45,
          nSources: 0,
        });
      }
    }

    for (const point of points) {
      const ra = normalizeRa(point.ra as number);
      const dec = point.dec as number;
      const iRa = Math.min(Math.floor(ra / (360 / N_RA)), N_RA - 1);
      const iDec = dec < 0 ? 0 : 1;
      const key = `${iRa}-${iDec}`;
      const region = regionMap.get(key);
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

    const totalExposureS = points.reduce((sum, point) => sum + point.totalExposureTimeAll, 0);
    const priorities = {
      A: points.filter((item) => item.sourcePriority === "A").length,
      B: points.filter((item) => item.sourcePriority === "B").length,
      C: points.filter((item) => item.sourcePriority === "C").length,
    };

    return NextResponse.json({
      points,
      regions,
      projection: {
        type: "mollweide",
        raEdges: RA_EDGES,
        decEdges: DEC_EDGES,
      },
      summary: {
        totalSources: points.length,
        totalExposureS,
        totalExposureMillionS: totalExposureS / 1_000_000,
        priorities,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sky map data" },
      { status: 500 },
    );
  }
}
