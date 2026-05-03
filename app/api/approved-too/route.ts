import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";

import { db } from "@/src/db/client";
import { approvedToO } from "@/src/db/schema";

export async function GET() {
  try {
    const [rows, scheduledResult] = await Promise.all([
      db.select().from(approvedToO).orderBy(desc(approvedToO.id)),
      db.execute(sql`
        SELECT a.id
        FROM approved_too a
        WHERE a.ep_db_object_id IS NOT NULL
          AND a.ep_db_object_id <> ''
          AND EXISTS (
            SELECT 1
            FROM obs_wp o
            WHERE o.ep_db_object_id IS NOT NULL
              AND o.ep_db_object_id ILIKE '%' || a.ep_db_object_id || '%'
          )
      `),
    ]);

    const scheduledIds = new Set(
      (Array.isArray(scheduledResult) ? scheduledResult : scheduledResult.rows).map((row) =>
        Number((row as { id: number | string }).id),
      ),
    );

    return NextResponse.json({
      rows: rows.map((row) => ({
        ...row,
        scheduledStatus: scheduledIds.has(row.id) ? "scheduled" : "unscheduled",
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
