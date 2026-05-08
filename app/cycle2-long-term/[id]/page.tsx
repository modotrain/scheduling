"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DETAIL_TITLE_CACHE_KEY_PREFIX } from "../detail-title-cache";

type LongTermRow = {
  id: number;
  tdicId: string | null;
  sourceId: string | null;
  proposalId: string | null;
  proposalNo: string | null;
  epDbObjectId: string | null;
  weekId: string | null;
  pi: string | null;
  groupName: string | null;
  sourceName: string | null;
  obsType: string | null;
  ra: string | null;
  dec: string | null;
  totalExposureTime: string | null;
  totalExposureTimeAll: string | null;
  exposureTimeUnit: string | null;
  continousExposure: string | null;
  visitNumber: string | null;
  exposurePerVistMin: string | null;
  exposurePerVistMax: string | null;
  completeness: string | null;
  cadence: string | null;
  cadenceUnit: string | null;
  precision: string | null;
  precisionUnit: string | null;
  startTime: string | null;
  endTime: string | null;
  sourcePriority: string | null;
  fxt1WindowMode: string | null;
  fxt1Filter: string | null;
  fxt2WindowMode: string | null;
  fxt2Filter: string | null;
  isUpdated: string | null;
  payload: string | null;
  wxtCmos: string | null;
  wxtCmosX: string | null;
  wxtCmosY: string | null;
  fxtCmr: string | null;
  fxtX: string | null;
  fxtY: string | null;
  isForDisrupted: string | null;
  visibleDays: string | null;
  visibleDateRanges: string | null;
  visibleRangeCount: string | null;
  visibleTotalDays: string | null;
  visibleDateRangesOnlySun: string | null;
  visibleFirstEnd: string | null;
  visibleLastEnd: string | null;
  mtDays: string | null;
  leftMtDays: string | null;
  createdAt: string;
  updatedAt: string;
};

type FieldKey = keyof LongTermRow;

type Section = { title: string; fields: FieldKey[] };

const LABELS: Record<FieldKey, string> = {
  id: "ID",
  tdicId: "TDIC ID",
  sourceId: "Source ID",
  proposalId: "Proposal ID",
  proposalNo: "Proposal No",
  epDbObjectId: "EP DB Object ID",
  weekId: "Week ID",
  pi: "PI",
  groupName: "Group",
  sourceName: "Source Name",
  obsType: "Obs Type",
  ra: "RA",
  dec: "Dec",
  totalExposureTime: "Total Exposure Time",
  totalExposureTimeAll: "Total Exposure Time All",
  exposureTimeUnit: "Exposure Time Unit",
  continousExposure: "Continuous Exposure",
  visitNumber: "Visit Number",
  exposurePerVistMin: "Exposure / Visit Min",
  exposurePerVistMax: "Exposure / Visit Max",
  completeness: "Completeness",
  cadence: "Cadence",
  cadenceUnit: "Cadence Unit",
  precision: "Precision",
  precisionUnit: "Precision Unit",
  startTime: "Start Time",
  endTime: "End Time",
  sourcePriority: "Source Priority",
  fxt1WindowMode: "FXT1 Window Mode",
  fxt1Filter: "FXT1 Filter",
  fxt2WindowMode: "FXT2 Window Mode",
  fxt2Filter: "FXT2 Filter",
  isUpdated: "Is Updated",
  payload: "Payload",
  wxtCmos: "WXT CMOS",
  wxtCmosX: "WXT CMOS X",
  wxtCmosY: "WXT CMOS Y",
  fxtCmr: "FXT CMR",
  fxtX: "FXT X",
  fxtY: "FXT Y",
  isForDisrupted: "Is For Disrupted",
  visibleDays: "Visible Days",
  visibleDateRanges: "Visible Date Ranges",
  visibleRangeCount: "Visible Range Count",
  visibleTotalDays: "Visible Total Days",
  visibleDateRangesOnlySun: "Visible Date Ranges Only Sun",
  visibleFirstEnd: "Visible First End",
  visibleLastEnd: "Visible Last End",
  mtDays: "MT Days",
  leftMtDays: "Left MT Days",
  createdAt: "Created At",
  updatedAt: "Updated At",
};

const SECTIONS: Section[] = [
  {
    title: "Information",
    fields: ["id", "tdicId", "sourceId", "proposalId", "proposalNo", "epDbObjectId", "weekId"],
  },
  {
    title: "PI & Group",
    fields: ["pi", "groupName", "sourceName", "obsType"],
  },
  {
    title: "Object Information",
    fields: ["ra", "dec"],
  },
  {
    title: "Exposure",
    fields: ["totalExposureTime", "totalExposureTimeAll", "exposureTimeUnit", "continousExposure"],
  },
  {
    title: "Observation",
    fields: ["visitNumber", "exposurePerVistMin", "exposurePerVistMax"],
  },
  {
    title: "Quality & Cadence",
    fields: ["completeness", "cadence", "cadenceUnit", "precision", "precisionUnit"],
  },
  {
    title: "Range",
    fields: ["startTime", "endTime"],
  },
  {
    title: "Configuration",
    fields: ["sourcePriority", "fxt1WindowMode", "fxt1Filter", "fxt2WindowMode", "fxt2Filter"],
  },
  {
    title: "Status",
    fields: ["isUpdated", "payload", "isForDisrupted"],
  },
  {
    title: "Payload",
    fields: ["wxtCmos", "wxtCmosX", "wxtCmosY", "fxtCmr", "fxtX", "fxtY"],
  },
  {
    title: "Visible",
    fields: ["visibleDays", "visibleDateRanges", "visibleRangeCount", "visibleTotalDays", "visibleDateRangesOnlySun", "visibleFirstEnd", "visibleLastEnd", "mtDays", "leftMtDays"],
  },
  {
    title: "Timestamps",
    fields: ["createdAt", "updatedAt"],
  },
];

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

export default function Cycle2LongTermDetailPage() {
  const pathname = usePathname();
  const id = pathname?.split("/").at(-1) ?? "";

  const [row, setRow] = useState<LongTermRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [prefetchedSourceName, setPrefetchedSourceName] = useState("");
  const titleSourceName = row?.sourceName || prefetchedSourceName || `Record #${id}`;

  useLayoutEffect(() => {
    const cachedSourceName = sessionStorage.getItem(`${DETAIL_TITLE_CACHE_KEY_PREFIX}${id}`)?.trim() ?? "";
    setPrefetchedSourceName(cachedSourceName);
  }, [id]);

  const loadRow = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cycle2-long-term/${id}`, { cache: "no-store" });
      const data = (await response.json()) as { row?: LongTermRow; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load");
      }
      if (data.row) {
        setRow(data.row);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadRow();
  }, [loadRow]);

  useEffect(() => {
    if (!row?.sourceName) {
      return;
    }

    sessionStorage.setItem(`${DETAIL_TITLE_CACHE_KEY_PREFIX}${id}`, row.sourceName);
    setPrefetchedSourceName(row.sourceName);
  }, [id, row?.sourceName]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-screen-xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              Cycle 2 Long-Term — {titleSourceName}
            </h1>
            {row?.pi ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.pi}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/cycle2-long-term"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Back to list
            </Link>
          </div>
        </div>

        {message ? (
          <p className={`mt-3 text-sm ${messageTone === "error" ? "text-rose-700" : "text-emerald-700"}`}>
            {message}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-6 flex justify-center">
            <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
          </div>
        ) : !row ? (
          <p className="mt-8 text-rose-600">Record not found.</p>
        ) : (
          <section className="mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
            <div className="rounded-t-lg border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <h2 className="text-base font-semibold">Long-Term Scheduling Details</h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {SECTIONS.map((section) => (
                <div key={section.title} className="px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {section.title}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {section.fields.map((field) => {
                      const displayValue = formatValue(row[field]);
                      return (
                        <div key={field}>
                          <dt className="text-[11px] text-slate-500 dark:text-slate-400">{LABELS[field]}</dt>
                          <dd
                            className={`break-words text-xs font-medium ${
                              displayValue === "—"
                                ? "text-slate-300 dark:text-slate-600"
                                : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {displayValue}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
