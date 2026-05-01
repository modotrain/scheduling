import type { Metadata } from "next";
import { Geist, Geist_Mono, Krona_One } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import ThemeToggle from "./theme-toggle";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const kronaOne = Krona_One({
  variable: "--font-krona-one",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EP Scheduling System",
  description: "Control center for Einstein Probe scheduling operations, including ToO requests and GP cycle planning.",
};

const themeInitScript = `(() => {
  try {
    const saved = window.localStorage.getItem("theme");
    const theme = saved === "dark" ? "dark" : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    if (!saved) {
      window.localStorage.setItem("theme", theme);
    }
  } catch {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${kronaOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <div className="fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2">
          {session ? (
            <div className="flex max-w-[min(60vw,20rem)] items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              <span className="truncate">{session.username}</span>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Logout
                </button>
              </form>
            </div>
          ) : null}
          <ThemeToggle />
        </div>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
