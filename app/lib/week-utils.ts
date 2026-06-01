import { getCycleEpoch } from "@/app/lib/cycles";

/**
 * The epoch for Cycle 2 scheduling weeks.
 * The Tuesday starting on this date is counted as Week 1.
 *
 * Per-cycle epochs now live in `src/db/cycles.config.json` and are resolved via
 * {@link epochForCycle}. This constant is kept for backward-compatibility and
 * as the default anchor for cycle-agnostic callers (e.g. the shared ToO pages).
 */
export const CYCLE2_EPOCH = "2025-08-12"; // 2025-08-12 is a Tuesday

/** Resolves the scheduling epoch (first Tuesday) for a cycle, defaulting to Cycle 2. */
function epochForCycle(cycle: number): string {
  return getCycleEpoch(cycle) ?? CYCLE2_EPOCH;
}

/**
 * Given any date string (YYYY-MM-DD or ISO datetime), returns the cycle week
 * label (e.g. "W01") based on the Tuesday-start week containing that date,
 * counted relative to the given cycle's epoch (defaults to Cycle 2).
 */
export function getCycleWeekLabel(
  dateStr: string | null | undefined,
  cycle = 2,
): string {
  if (!dateStr) return "—";
  const normalized = dateStr.includes("T") ? dateStr.split("T")[0]! : dateStr.split(" ")[0]!;
  const d = new Date(`${normalized}T00:00:00Z`);
  if (isNaN(d.getTime())) return "—";
  // Snap to the Tuesday of the week containing d
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, …
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  const tuesdayMs = d.getTime() - daysSinceTuesday * 86_400_000;
  const epochMs = new Date(`${epochForCycle(cycle)}T00:00:00Z`).getTime();
  const weekNo = Math.floor((tuesdayMs - epochMs) / (7 * 86_400_000)) + 1;
  return `W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Returns a stable week key (e.g. "cycle2-W01") for use as a map / lookup
 * key. Returns null for missing or invalid dates.
 * Splitting on "-" and taking index [1] gives the bare label "W01".
 */
export function getWeekKey(
  dateStr: string | null | undefined,
  cycle = 2,
): string | null {
  if (!dateStr) return null;
  const label = getCycleWeekLabel(dateStr, cycle);
  if (label === "—") return null;
  return `cycle${cycle}-${label}`;
}
