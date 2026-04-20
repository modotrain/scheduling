import { NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { gpCycle2 } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    // Look up source_id from gp_cycle2 row
    const [gpRow] = await db
      .select({ sourceId: gpCycle2.sourceId })
      .from(gpCycle2)
      .where(eq(gpCycle2.id, numId));

    if (!gpRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sourceId = gpRow.sourceId;
    if (!sourceId) {
      return NextResponse.json({
        rows: [],
        totalValidSecs: 0,
        lastValidNomRatio: 0,
        validTimeRatio: 0,
      });
    }

    // Obs list rows
    const obsResult = await db.execute(sql`
      SELECT
        obs_wp.id,
        obs_wp.wp_type,
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
      FROM obs_wp
      LEFT JOIN obslogtest
        ON obslogtest.obs_id_hex = SUBSTRING(obs_wp.obs_id_number FROM 3)
      WHERE obs_wp.source_id = ${sourceId}
      ORDER BY obs_wp.start_date ASC NULLS LAST
    `);

    const rows = Array.isArray(obsResult) ? obsResult : obsResult.rows;

    const totalValidSecs = rows.reduce((sum, row) => {
      const r = row as Record<string, unknown>;
      return sum + (Number(r.valid_secs) || 0);
    }, 0);

    // Compute ratios for this specific gp_cycle2 row
    const ratioResult = await db.execute(sql`
      WITH last_obs AS (
        SELECT
          g.source_id,
          g.visit_number,
          COALESCE(SUM(
            CASE
              WHEN 1 + SUM(
                CASE
                  WHEN LAG(o.qc) OVER (
                    PARTITION BY g.source_id, g.visit_number
                    ORDER BY o.start_date
                  ) IS NOT DISTINCT FROM o.qc
                  THEN 0 ELSE 1
                END
              ) OVER (
                PARTITION BY g.source_id, g.visit_number
                ORDER BY o.start_date DESC NULLS LAST
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) - (
                CASE
                  WHEN LAG(o.qc) OVER (
                    PARTITION BY g.source_id, g.visit_number
                    ORDER BY o.start_date
                  ) IS NOT DISTINCT FROM o.qc
                  THEN 0 ELSE 1
                END
              ) = 1
              THEN t.valid_secs
            END
          ), 0) AS last_valid_secs
        FROM gp_cycle2 g
        LEFT JOIN obs_wp o ON g.source_id = o.source_id
        LEFT JOIN obslogtest t ON t.obs_id_hex = SUBSTRING(o.obs_id_number FROM 3)
        WHERE g.id = ${numId}
        GROUP BY g.source_id, g.visit_number
      )
      SELECT
        CASE
          WHEN NULLIF(BTRIM(g.visit_number), '')::numeric > 0
           AND NULLIF(BTRIM(g.total_exposure_time), '')::numeric > 0
          THEN COALESCE(lo.last_valid_secs, 0)::numeric
               / (
                   NULLIF(NULLIF(BTRIM(g.total_exposure_time), '')::numeric, 0)
                   / NULLIF(NULLIF(BTRIM(g.visit_number), '')::numeric, 0)
                 )
          ELSE 0
        END AS last_valid_nom_ratio,
        CASE
          WHEN NULLIF(BTRIM(g.total_exposure_time), '')::numeric > 0
          THEN ${totalValidSecs}::numeric
               / NULLIF(NULLIF(BTRIM(g.total_exposure_time), '')::numeric, 0)
          ELSE 0
        END AS valid_time_ratio
      FROM gp_cycle2 g
      LEFT JOIN last_obs lo
        ON lo.source_id = g.source_id AND lo.visit_number = g.visit_number
      WHERE g.id = ${numId}
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
