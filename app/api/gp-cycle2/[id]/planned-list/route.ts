import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/src/db/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        lt.id,
        lt.source_name AS "sourceName",
        lt.week_id AS "weekId",
        lt.start_time AS "startTime",
        lt.end_time AS "endTime",
        lt.total_exposure_time AS "totalExposureTime",
        lt.visit_number AS "visitNumber",
        lt.fxt1_window_mode AS "fxt1WindowMode",
        lt.fxt1_filter AS "fxt1Filter",
        lt.fxt2_window_mode AS "fxt2WindowMode",
        lt.fxt2_filter AS "fxt2Filter"
      FROM gp_cycle2 g
      JOIN long_term_observation_list_cycle2 lt
        ON lt.source_id = g.source_id
      WHERE g.id = ${numId}
      ORDER BY
        CASE WHEN lt.week_id ~ '^[0-9]+$' THEN lt.week_id::int END ASC NULLS LAST,
        lt.id ASC
    `);

    const rows = Array.isArray(result) ? result : result.rows;
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch planned list" },
      { status: 500 },
    );
  }
}
