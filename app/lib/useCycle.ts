"use client";

import { useEffect, useState } from "react";

import { parseCycleParam, getCycleLabel } from "./cycles";

/**
 * Client hook that reads the `?cycle=N` query param (falling back to the active
 * cycle) without requiring a Suspense boundary. The initial value is resolved
 * from `window.location` so the first client render already targets the right
 * cycle; data fetching in these pages happens client-side anyway.
 */
export function useCycle(): { cycle: number; label: string; query: string } {
  const read = () => {
    if (typeof window === "undefined") {
      return parseCycleParam(null);
    }
    return parseCycleParam(new URLSearchParams(window.location.search).get("cycle"));
  };

  const [cycle, setCycle] = useState<number>(read);

  useEffect(() => {
    setCycle(read());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { cycle, label: getCycleLabel(cycle), query: `?cycle=${cycle}` };
}
