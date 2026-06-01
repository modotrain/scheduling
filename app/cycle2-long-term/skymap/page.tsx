"use client";

import Link from "next/link";

import Cycle2SkyMap from "@/app/components/Cycle2SkyMap";
import { useCycle } from "@/app/lib/useCycle";

export default function Cycle2LongTermSkyMapPage() {
  const { cycle, label: cycleLabel, query: cycleQuery } = useCycle();
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-screen-2xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{cycleLabel} Sky Map</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Full-sky source distribution with region exposure shading.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/cycle2-long-term${cycleQuery}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Back to {cycleLabel} Long-Term
            </Link>
          </div>
        </div>

        <Cycle2SkyMap cycle={cycle} />
      </div>
    </main>
  );
}
