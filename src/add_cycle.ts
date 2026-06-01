// One-click "add a new observation cycle" provisioning script.
//
// Usage:
//   npx tsx src/add_cycle.ts --cycle 3 --epoch 2026-08-11 [--label "Cycle 3"]
//
// What it does (idempotently):
//   1. Validates the requested cycle is a positive integer that is not already
//      registered in src/db/cycles.config.json.
//   2. Clones every per-cycle physical table from a template cycle (the lowest
//      registered cycle) using `CREATE TABLE ... (LIKE template INCLUDING ALL)`.
//   3. Gives each cloned table its own identity sequence (the LIKE clone would
//      otherwise share the template's serial sequence) and resets dataset
//      defaults that embed the cycle number.
//   4. Appends the new cycle to src/db/cycles.config.json.
//
// It does NOT flip `activeCycle`; switching the default entry point is a
// separate, deliberate edit once the new cycle's data has been injected.

import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sql } from "drizzle-orm";

import { db } from "./db/client";
import { CYCLE_TABLE_NAME } from "./db/cycle-tables";

const CONFIG_PATH = path.join(process.cwd(), "src", "db", "cycles.config.json");

interface CycleEntry {
  cycle: number;
  epoch: string;
  label: string;
}

interface CyclesConfig {
  activeCycle: number;
  cycles: CycleEntry[];
}

// Logical table keys whose `id` column is a serial (needs its own sequence).
const SERIAL_ID_TABLES: Array<keyof ReturnType<typeof CYCLE_TABLE_NAME>> = [
  "gp",
  "gf",
  "longTerm",
  "longTermGf",
  "skymapSources",
  "skymapSchedule",
  "proposal",
];

// Logical table keys with a `dataset` column defaulting to `cycle{n}`.
const DATASET_DEFAULT_TABLES: Array<keyof ReturnType<typeof CYCLE_TABLE_NAME>> = [
  "skymapSources",
  "skymapSchedule",
];

function parseArgs(argv: string[]): { cycle: number; epoch: string; label?: string } {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      args.set(key, value);
      i += 1;
    }
  }

  const cycleRaw = args.get("cycle");
  const epoch = args.get("epoch");
  if (!cycleRaw || !epoch) {
    throw new Error(
      "Usage: npx tsx src/add_cycle.ts --cycle <N> --epoch <YYYY-MM-DD> [--label <text>]",
    );
  }

  const cycle = Number(cycleRaw);
  if (!Number.isInteger(cycle) || cycle <= 0) {
    throw new Error(`--cycle must be a positive integer (got "${cycleRaw}")`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(epoch)) {
    throw new Error(`--epoch must be in YYYY-MM-DD format (got "${epoch}")`);
  }

  return { cycle, epoch, label: args.get("label") };
}

async function readConfig(): Promise<CyclesConfig> {
  const raw = await readFile(CONFIG_PATH, "utf8");
  return JSON.parse(raw) as CyclesConfig;
}

async function writeConfig(config: CyclesConfig): Promise<void> {
  config.cycles.sort((a, b) => a.cycle - b.cycle);
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function tableExists(name: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT to_regclass(${`public.${name}`}) AS reg`,
  );
  const rows = (Array.isArray(result) ? result : result.rows) as Array<{ reg: string | null }>;
  return Boolean(rows[0]?.reg);
}

async function main(): Promise<void> {
  const { cycle, epoch, label } = parseArgs(process.argv.slice(2));
  const config = await readConfig();

  if (config.cycles.some((c) => c.cycle === cycle)) {
    throw new Error(`Cycle ${cycle} is already registered in cycles.config.json.`);
  }

  const registered = config.cycles.map((c) => c.cycle).sort((a, b) => a - b);
  if (registered.length === 0) {
    throw new Error("No template cycle is registered; cannot clone table structure.");
  }
  const templateCycle = registered[0];
  if (cycle === templateCycle) {
    throw new Error(`Cycle ${cycle} collides with the template cycle.`);
  }

  const templateNames = CYCLE_TABLE_NAME(templateCycle);
  const newNames = CYCLE_TABLE_NAME(cycle);
  const keys = Object.keys(newNames) as Array<keyof typeof newNames>;

  console.log(`Adding cycle ${cycle} (epoch ${epoch}) using cycle ${templateCycle} as template.`);

  for (const key of keys) {
    const templateName = templateNames[key];
    const newName = newNames[key];

    if (!(await tableExists(templateName))) {
      throw new Error(
        `Template table "${templateName}" does not exist. Cannot clone "${newName}".`,
      );
    }

    if (await tableExists(newName)) {
      console.log(`  • ${newName} already exists — skipping clone.`);
    } else {
      // `cycle`/`templateCycle` are validated integers, so these identifiers are
      // injection-safe.
      await db.execute(
        sql.raw(
          `CREATE TABLE "${newName}" (LIKE "${templateName}" INCLUDING ALL)`,
        ),
      );
      console.log(`  • Created ${newName} (LIKE ${templateName}).`);
    }

    // Give serial-id tables their own identity sequence (the LIKE clone copies
    // the template's `nextval('..._id_seq')` default, which must be replaced).
    if (SERIAL_ID_TABLES.includes(key)) {
      const seqName = `${newName}_id_seq`;
      await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "${seqName}" OWNED BY "${newName}".id`));
      await db.execute(
        sql.raw(`ALTER TABLE "${newName}" ALTER COLUMN id SET DEFAULT nextval('"${seqName}"')`),
      );
      await db.execute(sql.raw(`SELECT setval('"${seqName}"', 1, false)`));
    }

    // Reset dataset defaults that embed the cycle number.
    if (DATASET_DEFAULT_TABLES.includes(key)) {
      await db.execute(
        sql.raw(`ALTER TABLE "${newName}" ALTER COLUMN dataset SET DEFAULT 'cycle${cycle}'`),
      );
    }
  }

  config.cycles.push({ cycle, epoch, label: label ?? `Cycle ${cycle}` });
  await writeConfig(config);

  console.log(`\nDone. Cycle ${cycle} tables provisioned and registered in cycles.config.json.`);
  console.log("Next steps:");
  console.log(`  1. Inject data, e.g.  npx tsx src/inject_cycle2_gf.ts --cycle ${cycle}`);
  console.log(`  2. When ready to go live, set "activeCycle": ${cycle} in src/db/cycles.config.json.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
