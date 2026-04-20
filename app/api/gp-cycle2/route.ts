import { NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { gpCycle2 } from "@/src/db/schema";
import { sql } from "drizzle-orm";

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function toCamelCaseRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toCamelCaseKey(key), value]),
  );
}

export async function GET() {
  try {
    const result = await db.execute(sql`
      WITH base AS (
        SELECT
          g.id,
          g.source_id,
          g.visit_number,
          o.qc,
          o.start_date,
          o.end_date,
          t.valid_secs,
          t.start_time
        FROM gp_cycle2 g
        LEFT JOIN obs_wp o
          ON g.source_id = o.source_id
        LEFT JOIN obslogtest t
          ON t.obs_id_hex = SUBSTRING(o.obs_id_number, 3)
        WHERE g.type LIKE 'FSTO'
          AND COALESCE(g.obs_type, '') <> 'GP-CAL'
      ),
      ordered AS (
        SELECT
          id,
          source_id,
          visit_number,
          qc,
          start_date,
          end_date,
          valid_secs,
          start_time,
          CASE
            WHEN LAG(qc) OVER (
              PARTITION BY source_id, visit_number
              ORDER BY source_id, start_date
            ) IS NOT DISTINCT FROM qc
            THEN 0
            ELSE 1
          END AS qc_changed
        FROM base
      ),
      segmented AS (
        SELECT
          id,
          source_id,
          visit_number,
          qc,
          start_date,
          end_date,
          valid_secs,
          start_time,
          1 + SUM(qc_changed) OVER (
            PARTITION BY source_id, visit_number
            ORDER BY source_id, start_date DESC NULLS LAST
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) - qc_changed AS seg_id
        FROM ordered
      ),
      last_obs AS (
        SELECT
          source_id,
          visit_number,
          COALESCE(SUM(valid_secs), 0) AS last_valid_secs
        FROM segmented
        WHERE seg_id = 1
        GROUP BY source_id, visit_number
      ),
      ratios AS (
        SELECT
          g.id,
          CASE
            WHEN NULLIF(BTRIM(g.visit_number), '')::numeric > 0
              AND NULLIF(BTRIM(g.total_exposure_time), '')::numeric > 0
            THEN
              COALESCE(MAX(lo.last_valid_secs), 0)::numeric
              /
              (
                NULLIF(NULLIF(BTRIM(g.total_exposure_time), '')::numeric, 0)
                / NULLIF(NULLIF(BTRIM(g.visit_number), '')::numeric, 0)
              )
            ELSE 0
          END AS last_valid_nom_ratio,
          CASE
            WHEN NULLIF(BTRIM(g.total_exposure_time), '')::numeric > 0
            THEN COALESCE(SUM(t.valid_secs), 0)::numeric
              / NULLIF(NULLIF(BTRIM(g.total_exposure_time), '')::numeric, 0)
            ELSE 0
          END AS valid_time_ratio
        FROM gp_cycle2 g
        LEFT JOIN obs_wp o
          ON g.source_id = o.source_id
        LEFT JOIN obslogtest t
          ON t.obs_id_hex = SUBSTRING(o.obs_id_number, 3)
        LEFT JOIN last_obs lo
          ON lo.source_id = g.source_id
          AND lo.visit_number = g.visit_number
        WHERE g.type LIKE 'FSTO'
          AND COALESCE(g.obs_type, '') <> 'GP-CAL'
        GROUP BY g.id, g.visit_number, g.total_exposure_time
      )
      SELECT
        g.*,
        COALESCE(r.last_valid_nom_ratio, 0) AS last_valid_nom_ratio,
        COALESCE(r.valid_time_ratio, 0) AS valid_time_ratio
      FROM gp_cycle2 g
      LEFT JOIN ratios r ON r.id = g.id
      WHERE COALESCE(g.obs_type, '') <> 'GP-CAL'
      ORDER BY g.id DESC;
    `);

    const rawRows = Array.isArray(result) ? result : result.rows;
    const rows = rawRows.map((row) => toCamelCaseRow(row as Record<string, unknown>));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string | null>;
    const [inserted] = await db.insert(gpCycle2).values(body).returning();
    return NextResponse.json({ row: inserted }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 500 },
    );
  }
}
