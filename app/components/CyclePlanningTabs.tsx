"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { CYCLES, ACTIVE_CYCLE, getCycleLabel, cycleHref } from "@/app/lib/cycles";

const STORAGE_KEY = "home:selected-cycle";

interface PlanningCard {
  badge: string;
  /** Title is rendered as `${cycleLabel} ${titleSuffix}`. */
  titleSuffix: string;
  description: string;
  basePath: string;
}

const PLANNING_CARDS: PlanningCard[] = [
  {
    badge: "FSTO",
    titleSuffix: "Sources & Status",
    description: "Track cycle proposals, completion ratios, and detailed observation timelines.",
    basePath: "/gp",
  },
  {
    badge: "Weekly Orgnized Plan",
    titleSuffix: "Long-Term Schedule",
    description: "Browse weekly-based long-term scheduling plans and inspect every scheduling detail.",
    basePath: "/long-term",
  },
  {
    badge: "Calibration Workspace",
    titleSuffix: "Calibration Sources",
    description: "Browse GP-CAL calibration observations and filter by FXT or WXT instrument.",
    basePath: "/gp-cal",
  },
  {
    badge: "Gap Filling Pool",
    titleSuffix: "Gap Filling Sources",
    description: "Browse gap-filling sources, completion ratios, and open details for full source metadata.",
    basePath: "/gf",
  },
];

/**
 * Tabbed "Cycle Planning" section. The four sub-entries switch per cycle via a
 * `?cycle=N` query param. The active cycle is selected by default; other
 * registered cycles remain available in secondary tabs for reference.
 *
 * The selected cycle is persisted in localStorage so it survives navigation.
 */
export default function CyclePlanningTabs() {
  const [selected, setSelected] = useState<number>(ACTIVE_CYCLE);
  const selectedLabel = getCycleLabel(selected);
  const multipleCycles = CYCLES.length > 1;
  const isArchive = selected !== ACTIVE_CYCLE;

  // Restore persisted selection after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const n = Number(stored);
        if (Number.isInteger(n) && CYCLES.some((c) => c.cycle === n)) {
          setSelected(n);
        }
      }
    } catch {
      // Ignore storage errors in private/restricted contexts.
    }
  }, []);

  function handleSelect(cycle: number) {
    setSelected(cycle);
    try {
      localStorage.setItem(STORAGE_KEY, String(cycle));
    } catch {
      // Ignore.
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Cycle Planning
        </p>
        {multipleCycles ? (
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/70 p-1 dark:border-slate-700 dark:bg-slate-900/60">
            {CYCLES.map((c) => {
              const isSelected = c.cycle === selected;
              const isActive = c.cycle === ACTIVE_CYCLE;
              return (
                <button
                  key={c.cycle}
                  type="button"
                  onClick={() => handleSelect(c.cycle)}
                  className={
                    isSelected
                      ? "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm"
                      : "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }
                >
                  {c.label}
                  {isActive ? (
                    <span
                      className={
                        isSelected
                          ? "rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] uppercase tracking-wide"
                          : "rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      }
                    >
                      Current
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Archive-mode notice — only shown when browsing a non-current cycle */}
      {isArchive ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Browsing {selectedLabel} — not the current active cycle ({getCycleLabel(ACTIVE_CYCLE)}).
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        {PLANNING_CARDS.map((card) => (
          <Link
            key={card.basePath}
            href={cycleHref(card.basePath, selected)}
            className={`group rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
              isArchive
                ? "border-slate-200/60 bg-slate-50/70 hover:border-slate-400 dark:border-slate-700/60 dark:bg-slate-800/40"
                : "border-slate-200 bg-white/90 hover:border-primary dark:border-slate-700 dark:bg-slate-900"
            }`}
          >
            <div className={`mb-3 inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${
              isArchive
                ? "bg-slate-200/70 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400"
                : "bg-primary/10 text-primary"
            }`}>
              {card.badge}
            </div>
            <h2 className={`text-lg font-semibold ${isArchive ? "text-slate-600 dark:text-slate-400" : ""}`}>
              {selectedLabel} {card.titleSuffix}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{card.description}</p>
          </Link>
        ))}

        <Link
          href="/short-term-planning"
          className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:col-span-2 xl:col-span-2"
        >
          <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            Short-Term Scheduler
          </div>
          <h2 className="text-lg font-semibold">Short-Term Planning</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Step-by-step weekly source selection, merged CSV generation, scheduling result integration, and
            unscheduled source management.
          </p>
        </Link>
      </div>
    </section>
  );
}
