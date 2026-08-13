import { ACTIVE_CYCLE } from "@/app/lib/cycles";

/**
 * Builds the generated EP_DB_Object_ID for a ToO GP planning row.
 * The cycle prefix (e.g. "cycle3") is derived from the active cycle at runtime.
 */
export function buildGeneratedId(epDbObjectId: string, seqNo: number): string {
  const cyclePrefix = `cycle${ACTIVE_CYCLE}`;
  const normalized = epDbObjectId.trim();
  const match = normalized.match(/^EP_ToO_Season-\d+-([^-]+)-([^-]+)$/i);
  if (match) {
    const [, p2, p3] = match;
    return `${cyclePrefix}-${p2}_${p3}_${seqNo}_ToO_P2`;
  }
  return `${normalized.replace(/^EP_ToO_Season/i, cyclePrefix)}_${seqNo}_ToO_P2`;
}
