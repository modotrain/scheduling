"use client";

import { useState } from "react";
import Link from "next/link";

import { CYCLES, ACTIVE_CYCLE, getCycleLabel, cycleHref } from "@/app/lib/cycles";

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
    basePath: "/gp-cycle2",
  },
  {
    badge: "Weekly Orgnized Plan",
    titleSuffix: "Long-Term Schedule",
    description: "Browse weekly-based long-term scheduling plans and inspect every scheduling detail.",
    basePath: "/cycle2-long-term",
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
    basePath: "/cycle2-gf",
  },
];

/**
 * Tabbed "Cycle Planning" section. The four sub-entries switch per cycle via a
 * `?cycle=N` query param. The active cycle is selected by default; other
 * registered cycles remain available in secondary tabs for reference.
 */
export default function CyclePlanningTabs() {
  const [selected, setSelected] = useState<number>(ACTIVE_CYCLE);
  const selectedLabel = getCycleLabel(selected);
  const multipleCycles = CYCLES.length > 1;

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
                  onClick={() => setSelected(c.cycle)}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        {PLANNING_CARDS.map((card) => (
          <Link
            key={card.basePath}
            href={cycleHref(card.basePath, selected)}
            className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {card.badge}
            </div>
            <h2 className="text-lg font-semibold">
              {selectedLabel} {card.titleSuffix}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{card.description}</p>
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
