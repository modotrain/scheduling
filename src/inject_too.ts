import 'dotenv/config';
import { parse } from 'csv-parse/sync';
import { drizzle } from 'drizzle-orm/neon-http';
import { tooReqTable } from './db/schema';

const db = drizzle(process.env.DATABASE_URL!);

const csvData = `id,request_filename,request_date,request_urgency,obs_type,ep_db_object_id,source_name,right_ascension,declination,requested_obs_duration_in_seconds,requested_obs_duration_in_orbits,user_name,user_group,cmr,x,y,process_switch_a,observation_mode_a,filter_a,process_switch_b,observation_mode_b,filter_b,obs_priority,time_constraints,source_id,proposal_id,proposal_no
1,,2025-02-26T00:00:00Z,urgent,ToO-NOM-AT,EP_ToO_Season-0990-9532-32255,EP250223a,98.2722,-22.4442,,2,Wenjie Zhang,CHN,A,197.81,186.23,on,ff,THIN FILTER,on,ff,THIN FILTER,1,2025-02-26T08:21:21Z,,,
2,,2025-02-25T00:00:00Z,urgent,ToO-MM,EP_ToO_Season-0988-9525-32252,Crab,83.6331,22.0145,1200,,Huaqing Cheng,CHN,,,,on,ff,THIN FILTER,on,ff,THIN FILTER,1,2025-02-25T21:09:00Z,,,
3,,2025-02-25T00:00:00Z,urgent,ToO-MM,EP_ToO_Season-0988-9525-32253,Crab,83.6331,22.0145,1200,,Huaqing Cheng,CHN,,,,on,ff,THIN FILTER,on,ff,THIN FILTER,1,2025-02-25T21:09:00Z,,,
4,,2025-02-24T00:00:00Z,urgent,ToO-NOM-AT,EP_ToO_Season-0987-9519-32251,EP250223a,98.2722,-22.4442,,2,Wenjie Zhang,CHN,A,197.81,186.23,on,ff,THIN FILTER,on,ff,THIN FILTER,1,2025-02-24T14:43:36Z,,,
5,,2025-02-24T00:00:00Z,urgent,ToO-MM,EP_ToO_Season-0986-9514-32249,Crab,83.6324,22.0174,1200,,Huaqing Cheng,CHN,,,,on,ff,THIN FILTER,on,ff,THIN FILTER,3,2025-02-24T13:07:32Z,,,
6,,2025-02-24T00:00:00Z,urgent,ToO-MM,EP_ToO_Season-0986-9514-32250,Crab,83.6324,22.0174,1200,,Huaqing Cheng,CHN,,,,on,ff,THIN FILTER,on,ff,THIN FILTER,3,2025-02-24T13:07:32Z,,,
7,,2025-02-24T00:00:00Z,urgent,ToO-MM,EP_ToO_Season-0985-9513-32247,Crab,83.6324,22.0174,1200,,Huaqing Cheng,CHN,,,,on,ff,THIN FILTER,on,ff,THIN FILTER,2,2025-02-24T11:31:28Z,,,
8,,2025-02-24T00:00:00Z,urgent,ToO-MM,EP_ToO_Season-0985-9513-32248,Crab,83.6324,22.0174,1200,,Huaqing Cheng,CHN,,,,on,ff,THIN FILTER,on,ff,THIN FILTER,2,2025-02-24T11:31:28Z,,,
9,,2025-02-24T00:00:00Z,urgent,ToO-MM,EP_ToO_Season-0984-9512-32245,Crab,83.6324,22.0174,1200,,Huaqing Cheng,CHN,,,,on,ff,THIN FILTER,on,ff,THIN FILTER,1,2025-02-24T09:55:23Z,,,
10,,2025-02-24T00:00:00Z,urgent,ToO-MM,EP_ToO_Season-0984-9512-32246,Crab,83.6324,22.0174,1200,,Huaqing Cheng,CHN,,,,on,ff,THIN FILTER,on,ff,THIN FILTER,1,2025-02-24T09:55:23Z,,,`;

interface CsvRow {
  id: string;
  request_filename: string;
  request_date: string;
  request_urgency: string;
  obs_type: string;
  ep_db_object_id: string;
  source_name: string;
  right_ascension: string;
  declination: string;
  requested_obs_duration_in_seconds: string;
  requested_obs_duration_in_orbits: string;
  user_name: string;
  user_group: string;
  cmr: string;
  x: string;
  y: string;
  process_switch_a: string;
  observation_mode_a: string;
  filter_a: string;
  process_switch_b: string;
  observation_mode_b: string;
  filter_b: string;
  obs_priority: string;
  time_constraints: string;
  source_id: string;
  proposal_id: string;
  proposal_no: string;
}

function toInt(val: string): number {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function toNullable(val: string): string | null {
  return val.trim() === '' ? null : val.trim();
}

async function main() {
  const csvRows: CsvRow[] = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
  });

  const records: (typeof tooReqTable.$inferInsert)[] = csvRows.map((row) => ({
    request_filename: toNullable(row.request_filename),
    request_date: toNullable(row.request_date),
    request_urgency: toNullable(row.request_urgency),
    obs_type: toNullable(row.obs_type),
    ep_db_object_id: toNullable(row.ep_db_object_id),
    source_name: toNullable(row.source_name),
    right_ascension: toNullable(row.right_ascension),
    declination: toNullable(row.declination),
    requested_obs_duration_in_seconds: toInt(row.requested_obs_duration_in_seconds),
    requested_obs_duration_in_orbits: toInt(row.requested_obs_duration_in_orbits),
    user_name: toNullable(row.user_name),
    user_group: toNullable(row.user_group),
    cmr: toNullable(row.cmr),
    x: toNullable(row.x),
    y: toNullable(row.y),
    process_switch_a: toNullable(row.process_switch_a),
    observation_mode_a: toNullable(row.observation_mode_a),
    filter_a: toNullable(row.filter_a),
    process_switch_b: toNullable(row.process_switch_b),
    observation_mode_b: toNullable(row.observation_mode_b),
    filter_b: toNullable(row.filter_b),
    obs_priority: toNullable(row.obs_priority),
    time_constraints: toNullable(row.time_constraints),
    // last 4 columns missing from CSV — use schema defaults
    source_id: toInt(row.source_id),
    proposal_id: toInt(row.proposal_id),
    proposal_no: toInt(row.proposal_no),
    to_gp: false,
  }));

  const inserted = await db.insert(tooReqTable).values(records).returning();
  console.log(`Inserted ${inserted.length} rows into too_req:`);
  inserted.forEach((r) => console.log(` - id=${r.id}  source=${r.source_name}  date=${r.request_date}`));
}

main();