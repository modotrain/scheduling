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
            alt="Einstein Probe VI Logo"
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
            Choose a workspace to continue. ToO requests and GP cycle planning are always available.
            Users administration is restricted to VIP accounts.
          </p>

          <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">

            {/* Column 1 — GP Planning */}
            <div className="flex flex-col gap-3 lg:w-72 lg:shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Planning
              </p>
              <div className="grid gap-4">
                <Link
                  href="/gp-cycle2"
                  className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Planning Workspace
                  </div>
                  <h2 className="text-lg font-semibold">GP Cycle 2</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Track cycle proposals, completion ratios, and detailed observation timelines.
                  </p>
                </Link>

                <Link
                  href="/tootogp-schedule"
                  className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Planning Queue
                  </div>
                  <h2 className="text-lg font-semibold">GP Planning</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Review all manually added ToO-to-GP planning windows before they become scheduled observations.
                  </p>
                </Link>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden w-px self-stretch bg-slate-200 dark:bg-slate-700/60 lg:block" />

            {/* Column 2 — ToO */}
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Target of Opportunity
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/too-req"
                  className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    ToO Workspace
                  </div>
                  <h2 className="text-lg font-semibold">ToO Requests</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Review, edit and triage incoming target-of-opportunity requests.
                  </p>
                </Link>

                <Link
                  href="/too-management"
                  className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-3 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Review Workspace
                  </div>
                  <h2 className="text-lg font-semibold">ToO Management</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Manage approved ToO records with detail view and editable request/review fields.
                  </p>
                </Link>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden w-px self-stretch bg-slate-200 dark:bg-slate-700/60 lg:block" />

            {/* Column 3 — Administration */}
            <div className="flex flex-col gap-3 lg:w-60 lg:shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Administration
              </p>
              {isVip ? (
                <Link
                  href="/users"
                  className="group rounded-xl border border-slate-200 bg-white/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-3 inline-flex rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    VIP Only
                  </div>
                  <h2 className="text-lg font-semibold">Users</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Manage accounts, credentials and VIP permissions.
                  </p>
                </Link>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white/65 p-5 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="mb-3 inline-flex rounded-lg bg-slate-200/80 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    VIP Only
                  </div>
                  <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-300">Users</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Your account does not have access to users administration.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
