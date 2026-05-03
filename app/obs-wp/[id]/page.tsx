"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type ObsWpRow = Record<string, string | number | null> & { id: number };

const SECTIONS: Array<{ title: string; fields: string[] }> = [
  {
    title: "Identifiers",
    fields: ["id", "wpId", "wpFilename", "wpProducer", "wpType", "wpUrgency", "obsId", "obsIdNumber", "obtId", "obsType", "mainType", "subPriority"],
  },
  {
    title: "Source",
    fields: ["epDbObjectId", "sourceName", "sourceId", "proposalId", "rightAscension", "declination", "payloadRightAscension", "payloadDeclination", "userName"],
  },
  {
    title: "Timing",
    fields: ["startDate", "endDate", "pointingDurationInOrbits", "pointingDurationInSeconds", "requestedObsDurationInSeconds", "obsGspIdStart", "obsGspIdEnd"],
  },
  {
    title: "Configuration",
    fields: ["cmr", "x", "y", "processSwitchA", "observationModeA", "filterA", "processSwitchB", "observationModeB", "filterB", "configParameterSwitch", "configForceSwitch", "operationCode3", "tcProgrammingMode"],
  },
  {
    title: "Analysis",
    fields: ["minnsigmaDim", "snDim", "snWindows", "qc", "q1", "q2", "q3", "angZJ2000Rgrf", "angXJ2000Rgrf", "angYJ2000Rgrf"],
  },
  {
    title: "Relations",
    fields: ["relatedProposalId1", "relatedProposalId2", "relatedProposalId3"],
  },
];

function formatLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

export default function ObsWpDetailPage() {
  const pathname = usePathname();
  const router = useRouter();
  const id = pathname?.split("/").at(-1) ?? "";

  const [row, setRow] = useState<ObsWpRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadRow = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/obs-wp/${id}`, { cache: "no-store" });
      const data = (await response.json()) as { row?: ObsWpRow; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load");
      }
      setRow(data.row ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadRow();
  }, [loadRow]);

  const populatedSections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        fields: section.fields.filter((field) => row && field in row),
      })).filter((section) => section.fields.length > 0),
    [row],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-screen-xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Obs WP Detail — {row?.obsId ?? `Record #${id}`}</h1>
            {row?.sourceName ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{String(row.sourceName)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ← Back
          </button>
        </div>

        {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}

        <section className="mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <h2 className="text-base font-semibold">Observation Work Package</h2>
          </div>

          {loading ? (
            <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : !row ? (
            <p className="px-4 py-4 text-sm text-rose-600">Record not found.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {populatedSections.map((section) => (
                <div key={section.title} className="px-5 py-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {section.title}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {section.fields.map((field) => {
                      const value = row[field];
                      const display = value === null || value === undefined || value === "" ? "—" : String(value);
                      return (
                        <div key={field}>
                          <dt className="text-xs text-slate-500 dark:text-slate-400">{formatLabel(field)}</dt>
                          <dd className={`mt-0.5 break-words text-sm font-medium ${display === "—" ? "text-slate-300 dark:text-slate-600" : "text-slate-900 dark:text-slate-100"}`}>
                            {display}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}