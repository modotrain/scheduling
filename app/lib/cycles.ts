// Shared cycle configuration and helpers.
//
// This module is the single source of truth (together with
// `src/db/cycles.config.json`) for which observation cycles exist, which one is
// "active" (shown by default on the home page), and per-cycle metadata such as
// the scheduling epoch.
//
// It is safe to import from both client and server components because it only
// reads a static JSON config and never touches the database.
//
// To add a new cycle, run `npx tsx src/add_cycle.ts --cycle <N> --epoch <YYYY-MM-DD>`
// (see that script). You normally never need to edit this file by hand.

import cyclesConfig from "@/src/db/cycles.config.json";

export interface CycleConfig {
  /** The cycle number, e.g. 2, 3, 4. */
  cycle: number;
  /** First Tuesday of the cycle (week 1), as `YYYY-MM-DD`. */
  epoch: string;
  /** Human-readable label, e.g. "Cycle 2". */
  label: string;
}

/** All registered cycles, sorted ascending by cycle number. */
export const CYCLES: CycleConfig[] = [...(cyclesConfig.cycles as CycleConfig[])].sort(
  (a, b) => a.cycle - b.cycle,
);

/** Just the registered cycle numbers, sorted ascending. */
export const CYCLE_NUMBERS: number[] = CYCLES.map((c) => c.cycle);

/** The cycle shown by default on the home page and used when no `?cycle=` is given. */
export const ACTIVE_CYCLE: number = cyclesConfig.activeCycle;

export function isValidCycle(cycle: number): boolean {
  return CYCLE_NUMBERS.includes(cycle);
}

export function getCycleConfig(cycle: number): CycleConfig | undefined {
  return CYCLES.find((c) => c.cycle === cycle);
}

export function getCycleLabel(cycle: number): string {
  return getCycleConfig(cycle)?.label ?? `Cycle ${cycle}`;
}

export function getCycleEpoch(cycle: number): string | undefined {
  return getCycleConfig(cycle)?.epoch;
}

/**
 * Resolves a cycle number from a raw query-string value (e.g. `?cycle=3`).
 * Falls back to {@link ACTIVE_CYCLE} when the value is missing or not a
 * registered cycle.
 */
export function parseCycleParam(raw: string | null | undefined): number {
  if (raw == null || raw === "") return ACTIVE_CYCLE;
  const n = Number(raw);
  if (Number.isInteger(n) && isValidCycle(n)) return n;
  return ACTIVE_CYCLE;
}

/**
 * The four "Cycle Planning" entries on the home page that switch per cycle.
 * `basePath` keeps the existing route folders for backward-compatibility; the
 * selected cycle is carried via the `?cycle=` query param.
 */
export interface CyclePlanningEntry {
  key: string;
  basePath: string;
  title: string;
  description: string;
}

export const CYCLE_PLANNING_ENTRIES: CyclePlanningEntry[] = [
  {
    key: "sources",
    basePath: "/gp-cycle2",
    title: "Sources & Status",
    description: "Full-source target observation status",
  },
  {
    key: "long-term",
    basePath: "/cycle2-long-term",
    title: "Long-Term Schedule",
    description: "Weekly organized observation plan",
  },
  {
    key: "calibration",
    basePath: "/gp-cal",
    title: "Calibration Workspace",
    description: "Calibration source planning",
  },
  {
    key: "gap-filling",
    basePath: "/cycle2-gf",
    title: "Gap Filling Sources",
    description: "Gap filling observation pool",
  },
];

/** Builds the href for a planning entry pointing at the given cycle. */
export function cycleHref(basePath: string, cycle: number): string {
  return `${basePath}?cycle=${cycle}`;
}

/**
 * Resolves the requested cycle from an incoming API request's `?cycle=` query
 * param, falling back to {@link ACTIVE_CYCLE}. Safe to use in route handlers.
 */
export function resolveCycleFromRequest(request: { url: string }): number {
  try {
    const url = new URL(request.url);
    return parseCycleParam(url.searchParams.get("cycle"));
  } catch {
    return ACTIVE_CYCLE;
  }
}
