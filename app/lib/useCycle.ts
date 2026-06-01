"use client";

import { useEffect, useState } from "react";

import { parseCycleParam, getCycleLabel } from "./cycles";

/**
 * Client hook that reads the `?cycle=N` query param (falling back to the active
 * cycle) without requiring a Suspense boundary.
 *
 * Keep the initial render deterministic across server/client to avoid hydration
 * mismatches, then resolve the real query value after mount.
 */
export function useCycle(): { cycle: number; label: string; query: string; isReady: boolean } {
  const read = () => {
    if (typeof window === "undefined") {
      return parseCycleParam(null);
    }
    return parseCycleParam(new URLSearchParams(window.location.search).get("cycle"));
  };

  const [cycle, setCycle] = useState<number>(() => parseCycleParam(null));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setCycle(read());
    setIsReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { cycle, label: getCycleLabel(cycle), query: `?cycle=${cycle}`, isReady };
}
