import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";

import { db } from "@/src/db/client";
import { approvedToO } from "@/src/db/schema";

export async function GET() {
  try {
    const [rows, statusResult] = await Promise.all([
      db.select().from(approvedToO).orderBy(desc(approvedToO.id)),
      db.execute(sql`
        WITH gp_stats AS (
          SELECT
            tg.approved_too_id,
            COUNT(*) AS total_plans,
            SUM(CASE WHEN EXISTS(
              SELECT 1 FROM obs_wp o
              WHERE o.ep_db_object_id = REGEXP_REPLACE(tg.generated_ep_db_object_id, '_ToO$', '')
            ) THEN 1 ELSE 0 END) AS scheduled_plans
          FROM tootogp_schedule tg
          GROUP BY tg.approved_too_id
        )
        SELECT
          a.id,
          CASE
            WHEN gs.total_plans IS NULL OR gs.total_plans = 0 THEN 'new'
            WHEN gs.scheduled_plans = 0 THEN 'planned'
            WHEN gs.scheduled_plans < gs.total_plans THEN 'in_progress'
            ELSE 'done'
          END AS scheduled_status
        FROM approved_too a
        LEFT JOIN gp_stats gs ON gs.approved_too_id = a.id
      `),
    ]);

    type StatusRow = { id: number | string; scheduled_status: string };
    const statusMap = new Map(
      (Array.isArray(statusResult) ? statusResult : statusResult.rows).map((row) => [
        Number((row as StatusRow).id),
        (row as StatusRow).scheduled_status as "new" | "planned" | "in_progress" | "done",
      ]),
    );

    return NextResponse.json({
      rows: rows.map((row) => ({
        ...row,
        scheduledStatus: statusMap.get(row.id) ?? "new",
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<typeof approvedToO.$inferInsert>;
    const [inserted] = await db.insert(approvedToO).values(body).returning();
    return NextResponse.json({ row: inserted }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 500 },
    );
  }
}
