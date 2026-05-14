/**
 * The epoch for Cycle 2 scheduling weeks.
 * The Tuesday starting on this date is counted as Week 1.
 * Change this constant to adjust the week numbering for a new cycle.
 */
export const CYCLE2_EPOCH = "2025-08-12"; // 2025-08-12 is a Tuesday

/**
 * Given any date string (YYYY-MM-DD or ISO datetime), returns the Cycle 2
 * week label (e.g. "W01") based on the Tuesday-start week containing that
 * date, counted relative to CYCLE2_EPOCH.
 */
export function getCycleWeekLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const normalized = dateStr.includes("T") ? dateStr.split("T")[0]! : dateStr.split(" ")[0]!;
  const d = new Date(`${normalized}T00:00:00Z`);
  if (isNaN(d.getTime())) return "—";
  // Snap to the Tuesday of the week containing d
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, …
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  const tuesdayMs = d.getTime() - daysSinceTuesday * 86_400_000;
  const epochMs = new Date(`${CYCLE2_EPOCH}T00:00:00Z`).getTime();
  const weekNo = Math.floor((tuesdayMs - epochMs) / (7 * 86_400_000)) + 1;
  return `W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Returns a stable week key (e.g. "cycle2-W01") for use as a map / lookup
 * key. Returns null for missing or invalid dates.
 * Splitting on "-" and taking index [1] gives the bare label "W01".
 */
export function getWeekKey(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const label = getCycleWeekLabel(dateStr);
  if (label === "—") return null;
  return `cycle2-${label}`;
}
