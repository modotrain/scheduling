// Shared CLI helper for the cycle-aware inject scripts.
//
// Every inject_*.ts script accepts an optional `--cycle N` flag. When omitted,
// the script targets the active cycle declared in cycles.config.json, so the
// existing (cycle-2) workflows keep working with no extra arguments.

import cyclesConfig from "./cycles.config.json";

export const ACTIVE_CYCLE: number = cyclesConfig.activeCycle;

export function parseCycleArg(argv: string[] = process.argv.slice(2)): number {
  const idx = argv.findIndex((a) => a === "--cycle");
  if (idx === -1) {
    return ACTIVE_CYCLE;
  }
  const raw = argv[idx + 1];
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid --cycle value: "${raw}". Expected a positive integer.`);
  }
  return value;
}
