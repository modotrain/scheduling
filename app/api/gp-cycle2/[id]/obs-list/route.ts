import { NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sql } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    // Single JOIN — mirrors the user's original SQL, avoids two-step lookup bugs
    const obsResult = await db.execute(sql`
      SELECT
        obs_wp.id,
        obs_wp.obs_id,
        obs_wp.ep_db_object_id,
        obs_wp.observation_mode_a,
        obs_wp.filter_a,
        obs_wp.observation_mode_b,
        obs_wp.filter_b,
        obs_wp.start_date,
        obs_wp.end_date,
        obs_wp.pointing_duration_in_orbits,
        obs_wp.pointing_duration_in_seconds,
        COALESCE(obslogtest.valid_secs, 0) AS valid_secs
      FROM gp_cycle2 g
      JOIN obs_wp
        ON obs_wp.source_id = g.source_id
      LEFT JOIN obslogtest
        ON obslogtest.obs_id_hex = SUBSTRING(obs_wp.obs_id_number FROM 3)
      WHERE g.id = ${numId}
      ORDER BY obs_wp.start_date ASC NULLS LAST
    `);

    const rows = Array.isArray(obsResult) ? obsResult : obsResult.rows;

    const totalValidSecs = rows.reduce((sum, row) => {
      const r = row as Record<string, unknown>;
      return sum + (Number(r.valid_secs) || 0);
    }, 0);

    // Ratio calculations using the same CTE logic as the list API
    const ratioResult = await db.execute(sql`
      WITH base AS (
        SELECT
          g.id,
          g.source_id,
          g.visit_number,
          g.total_exposure_time,
          o.qc,
          o.start_date,
          t.valid_secs
        FROM gp_cycle2 g
        JOIN obs_wp o ON o.source_id = g.source_id
        LEFT JOIN obslogtest t ON t.obs_id_hex = SUBSTRING(o.obs_id_number FROM 3)
        WHERE g.id = ${numId}
      ),
      ordered AS (
        SELECT *,
          CASE
            WHEN LAG(qc) OVER (
              PARTITION BY source_id, visit_number
              ORDER BY source_id, start_date
            ) IS NOT DISTINCT FROM qc
            THEN 0 ELSE 1
          END AS qc_changed
        FROM base
      ),
      segmented AS (
        SELECT *,
          1 + SUM(qc_changed) OVER (
            PARTITION BY source_id, visit_number
            ORDER BY source_id, start_date DESC NULLS LAST
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) - qc_changed AS seg_id
        FROM ordered
      ),
      last_valid AS (
        SELECT COALESCE(SUM(valid_secs), 0) AS last_valid_secs,
               source_id, visit_number, total_exposure_time
        FROM segmented
        WHERE seg_id = 1
        GROUP BY source_id, visit_number, total_exposure_time
      )
      SELECT
        CASE
          WHEN NULLIF(BTRIM(lv.visit_number), '')::numeric > 0
           AND NULLIF(BTRIM(lv.total_exposure_time), '')::numeric > 0
          THEN lv.last_valid_secs::numeric
               / (
                   NULLIF(NULLIF(BTRIM(lv.total_exposure_time), '')::numeric, 0)
                   / NULLIF(NULLIF(BTRIM(lv.visit_number), '')::numeric, 0)
                 )
          ELSE 0
        END AS last_valid_nom_ratio,
        CASE
          WHEN NULLIF(BTRIM(lv.total_exposure_time), '')::numeric > 0
          THEN ${totalValidSecs}::numeric
               / NULLIF(NULLIF(BTRIM(lv.total_exposure_time), '')::numeric, 0)
          ELSE 0
        END AS valid_time_ratio
      FROM last_valid lv
      LIMIT 1
    `);

    const ratioRows = Array.isArray(ratioResult) ? ratioResult : ratioResult.rows;
    const ratioRow = (ratioRows[0] ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      rows,
      totalValidSecs,
      lastValidNomRatio: Number(ratioRow.last_valid_nom_ratio ?? 0),
      validTimeRatio: Number(ratioRow.valid_time_ratio ?? 0),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}
