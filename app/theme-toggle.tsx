"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = window.localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (!window.localStorage.getItem("theme")) {
      window.localStorage.setItem("theme", theme);
    }
  }, [theme]);

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    const next: Theme = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem("theme", next);
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      aria-pressed={isDark}
      className="inline-flex h-9 w-[78px] items-center rounded-full border border-slate-300 bg-white px-1.5 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      <span className="relative flex w-full items-center justify-between">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
          isDark ? "text-slate-500 dark:text-slate-400" : "text-amber-500"
        }`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23L5.46 5.46" />
          </svg>
        </span>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
          isDark ? "text-sky-200" : "text-slate-400"
        }`}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M20.7 14.3A8.5 8.5 0 0 1 9.7 3.3a.75.75 0 0 0-.95-.95A9.75 9.75 0 1 0 21.65 15.25a.75.75 0 0 0-.95-.95Z" />
          </svg>
        </span>
        <span
          className={`absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#0b4f8a] shadow-sm transition-transform dark:bg-sky-300 ${
            isDark ? "translate-x-[42px]" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
