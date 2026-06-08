"use client";

import { useSearchParams } from "next/navigation";

import { parseCycleParam, getCycleLabel } from "./cycles";

/**
 * Client hook that reads the `?cycle=N` query param reactively via
 * useSearchParams, so client-side navigation changes are reflected immediately
 * without requiring a page refresh.
 */
export function useCycle(): { cycle: number; label: string; query: string; isReady: boolean } {
  const searchParams = useSearchParams();
  const cycle = parseCycleParam(searchParams.get("cycle"));
  return { cycle, label: getCycleLabel(cycle), query: `?cycle=${cycle}`, isReady: true };
}
