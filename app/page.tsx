import Link from "next/link";
import { cookies } from "next/headers";
import Image from "next/image";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isVip = Boolean(session?.vip);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] px-4 py-10 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:px-8">
      <section className="mx-auto mt-24 max-w-6xl md:mt-36">
        <div className="fixed left-0 top-0 z-40">
          <Image
            src="/ep-vi-logo-3-25.svg"
            alt="Einstein Probe VI Logo"
            width={540}
            height={156}
            priority
            sizes="(min-width: 768px) 540px, 420px"
            className="h-[121px] w-[420px] dark:hidden md:h-[156px] md:w-[540px]"
          />
          <Image
            src="/ep-vi-logo-3-26.svg"
            alt="Einstein Probe Logo"
            width={540}
            height={156}
            priority
            sizes="(min-width: 768px) 540px, 420px"
            className="hidden h-[121px] w-[420px] dark:block md:h-[156px] md:w-[540px]"
          />
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-[0_20px_50px_rgba(0,41,69,0.14)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/70 md:p-8">
          <p className="text-xs uppercase tracking-[0.26em] text-primary">Einstein Probe Operations</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-4xl">
            Scheduling Control Center
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
            Choose a workspace to continue.
          </p>

          <div className="mt-8 space-y-6">
            <div className="grid gap-8 xl:grid-cols-2">
              <section className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Cycle-2 Planning
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                  <Link
                    href="/gp-cycle2"
                    className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Planning Workspace
                    </div>
                    <h2 className="text-lg font-semibold">Cycle-2 Sources & Status</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Track cycle proposals, completion ratios, and detailed observation timelines.
                    </p>
                  </Link>

                  <Link
                    href="/cycle2-long-term"
                    className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Weekly Plan Workspace
                    </div>
                    <h2 className="text-lg font-semibold">Cycle-2 Long-Term Schedule</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Browse weekly-based long-term scheduling plans and inspect every scheduling detail.
                    </p>
                  </Link>

                  <Link
                    href="/gp-cal"
                    className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Calibration Workspace
                    </div>
                    <h2 className="text-lg font-semibold">Cycle-2 Calibration Sources</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Browse GP-CAL calibration observations and filter by FXT or WXT instrument.
                    </p>
                  </Link>
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Target of Opportunity
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Link
                    href="/too-management"
                    className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Reviewed ToO Proposals 
                    </div>
                    <h2 className="text-lg font-semibold">ToO Management</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Manage approved ToO records with detail view and editable request/review fields.
                    </p>
                  </Link>

                  <Link
                    href="/tootogp-schedule"
                    className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Planning Queue
                    </div>
                    <h2 className="text-lg font-semibold">Schedule ToO in GP</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Review all manually added ToO-to-GP planning windows before they become scheduled observations.
                    </p>
                  </Link>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end border-t border-slate-200/80 pt-4 dark:border-slate-700/70">
              {isVip ? (
                <Link
                  href="/users"
                  className="inline-flex items-center rounded-md border border-slate-300/70 bg-white/70 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 dark:border-slate-600/80 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
                >
                  Admin Panel
                </Link>
              ) : (
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Administration: restricted
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
