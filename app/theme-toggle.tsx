"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    const initial = resolveInitialTheme();
    document.documentElement.classList.toggle("dark", initial === "dark");
    if (!window.localStorage.getItem("theme")) {
      window.localStorage.setItem("theme", initial);
    }
  }, []);

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    const next: Theme = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem("theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      Theme
    </button>
  );
}
