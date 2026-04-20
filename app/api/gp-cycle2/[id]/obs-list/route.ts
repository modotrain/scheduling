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
      return NextResponse.json({ rows: [], totalValidSecs: 0 });
    }

    const result = await db.execute(sql`
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

    const rows = Array.isArray(result) ? result : result.rows;

    const totalValidSecs = rows.reduce((sum, row) => {
      const r = row as Record<string, unknown>;
      return sum + (Number(r.valid_secs) || 0);
    }, 0);

    return NextResponse.json({ rows, totalValidSecs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}
