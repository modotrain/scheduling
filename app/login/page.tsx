"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Soft tech canvas background ────────────────────────────────────────────
function TechBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let t = 0;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const isActive = mouseRef.current.active;
      const isDark = document.documentElement.classList.contains("dark");

      // Main base wash
      const bg = ctx!.createLinearGradient(0, 0, w, h);
      if (isDark) {
        bg.addColorStop(0, "#07131f");
        bg.addColorStop(0.5, "#0a1c2b");
        bg.addColorStop(1, "#0d2435");
      } else {
        bg.addColorStop(0, "#edf6ff");
        bg.addColorStop(0.5, "#e8f2fc");
        bg.addColorStop(1, "#e2eef9");
      }
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);

      // Gentle diagonals for a technical texture
      const spacing = 32;
      for (let x = -h; x < w + h; x += spacing) {
        const drift = Math.sin(t * 0.55 + x * 0.008) * 6.5;
        ctx!.beginPath();
        ctx!.moveTo(x + drift, 0);
        ctx!.lineTo(x + h + drift, h);
        ctx!.strokeStyle = isDark ? "rgba(101, 170, 221, 0.065)" : "rgba(101, 170, 221, 0.06)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // Dot matrix that reacts to cursor proximity
      const dotStep = 52;
      for (let y = dotStep / 2; y < h; y += dotStep) {
        for (let x = dotStep / 2; x < w; x += dotStep) {
          const dx = x - mx;
          const dy = y - my;
          const dist = Math.hypot(dx, dy);
          const near = isActive ? Math.max(0, 1 - dist / 210) : 0;
          const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t + x * 0.01 + y * 0.01));
          const r = 1 + near * 2.2;
          ctx!.beginPath();
          ctx!.arc(x, y, r, 0, Math.PI * 2);
          ctx!.fillStyle = isDark
            ? `rgba(101, 170, 221, ${0.08 + pulse * 0.09 + near * 0.24})`
            : `rgba(0, 93, 151, ${0.08 + pulse * 0.1 + near * 0.28})`;
          ctx!.fill();
        }
      }

      // Cursor halo (subtle, not flashy)
      if (isActive) {
        const halo = ctx!.createRadialGradient(mx, my, 0, mx, my, 210);
        halo.addColorStop(0, isDark ? "rgba(101, 170, 221, 0.24)" : "rgba(101, 170, 221, 0.28)");
        halo.addColorStop(0.35, isDark ? "rgba(101, 170, 221, 0.1)" : "rgba(101, 170, 221, 0.13)");
        halo.addColorStop(1, "rgba(101, 170, 221, 0)");
        ctx!.fillStyle = halo;
        ctx!.beginPath();
        ctx!.arc(mx, my, 210, 0, Math.PI * 2);
        ctx!.fill();
      }

      t += 0.016;
      animFrame = requestAnimationFrame(draw);
    }

    draw();

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999, active: false };
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) {
        mouseRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          active: true,
        };
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

// ── Login page ──────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to login");
      }

      const next = searchParams.get("next");
      router.replace(next || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to login");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#e9f4ff] p-4 dark:bg-[#081522]">
      <TechBackground />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.72),transparent_35%),radial-gradient(circle_at_80%_12%,rgba(101,170,221,0.22),transparent_30%)] dark:bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.05),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(101,170,221,0.14),transparent_28%)]" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center">
          <h1
            className="text-4xl font-normal leading-tight tracking-wide text-[#0f3f65] dark:text-[#dcedfb]"
            style={{ fontFamily: "var(--font-krona-one)" }}
          >
            Einstein Probe
          </h1>
          <p
            className="mt-2 text-lg font-normal tracking-widest text-[#2f77ab] dark:text-[#8fc2e8]"
            style={{ fontFamily: "var(--font-krona-one)" }}
          >
            Scheduling System
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-white/75 bg-white/72 p-6 shadow-[0_22px_60px_rgba(0,93,151,0.16)] backdrop-blur-xl dark:border-[#21415a] dark:bg-[#0d1f2f]/76 dark:shadow-[0_22px_60px_rgba(0,0,0,0.34)]">
          <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
            Sign in to access Users, ToO Requests, and GP Cycle 2.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-[#c5def2] bg-white/90 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#65aadd] focus:ring-2 focus:ring-[#65aadd]/30 dark:border-[#295173] dark:bg-[#10283b]/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#8fc2e8] dark:focus:ring-[#8fc2e8]/20"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#c5def2] bg-white/90 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#65aadd] focus:ring-2 focus:ring-[#65aadd]/30 dark:border-[#295173] dark:bg-[#10283b]/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#8fc2e8] dark:focus:ring-[#8fc2e8]/20"
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full rounded-lg bg-[#0e67a5] px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_24px_rgba(14,103,165,0.22)] transition duration-200 hover:brightness-105 hover:shadow-[0_16px_30px_rgba(14,103,165,0.28)] dark:bg-[#2b77ab] dark:shadow-[0_12px_24px_rgba(43,119,171,0.18)] dark:hover:brightness-110 dark:hover:shadow-[0_16px_30px_rgba(43,119,171,0.24)] disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}