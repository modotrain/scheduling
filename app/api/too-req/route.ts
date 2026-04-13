import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/src/db/client";
import { tooReqTable } from "@/src/db/schema";

export type TooReqPayload = {
  request_filename?: string;
  request_date?: string;
  request_urgency?: string;
  obs_type?: string;
  ep_db_object_id?: string;
  source_name?: string;
  right_ascension?: string;
  declination?: string;
  requested_obs_duration_in_seconds?: number;
  requested_obs_duration_in_orbits?: number;
  user_name?: string;
  user_group?: string;
  cmr?: string;
  x?: string;
  y?: string;
  process_switch_a?: string;
  observation_mode_a?: string;
  filter_a?: string;
  process_switch_b?: string;
  observation_mode_b?: string;
  filter_b?: string;
  obs_priority?: string;
  time_constraints?: string;
  source_id?: number;
  proposal_id?: number;
  proposal_no?: number;
  toToo?: boolean;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(tooReqTable)
      .orderBy(desc(tooReqTable.id));
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch too_req", error);
    return NextResponse.json({ error: "Failed to fetch too_req" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TooReqPayload;
    const [created] = await db.insert(tooReqTable).values(body).returning();
    return NextResponse.json({ row: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create too_req", error);
    return NextResponse.json({ error: "Failed to create too_req" }, { status: 500 });
  }
}
