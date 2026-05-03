import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/src/db/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        o.id,
        o.obs_id,
        o.ep_db_object_id,
        o.main_type,
        o.wp_type,
        o.wp_urgency,
        o.obs_type,
        o.source_name,
        o.start_date,
        o.end_date,
        o.pointing_duration_in_seconds,
        o.user_name
      FROM approved_too a
      JOIN obs_wp o
        ON a.ep_db_object_id IS NOT NULL
       AND a.ep_db_object_id <> ''
       AND o.ep_db_object_id IS NOT NULL
       AND o.ep_db_object_id ILIKE '%' || a.ep_db_object_id || '%'
      WHERE a.id = ${numId}
      ORDER BY o.start_date ASC NULLS LAST, o.id ASC
    `);

    const rows = Array.isArray(result) ? result : result.rows;
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch schedule information" },
      { status: 500 },
    );
  }
}