"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Hex-grid canvas background ─────────────────────────────────────────────
function HexBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let t = 0;

    const R = 30;
    const HH = R * Math.sqrt(3);
    const COL_W = R * 1.5;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function drawHex(cx: number, cy: number, r: number) {
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (i === 0) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
      }
      ctx!.closePath();
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;

      const bg = ctx!.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#010d1a");
      bg.addColorStop(1, "#041628");
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);

      const cols = Math.ceil(w / COL_W) + 3;
      const rows = Math.ceil(h / HH) + 3;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (let col = -1; col < cols; col++) {
        for (let row = -1; row < rows; row++) {
          const cx = col * COL_W;
          const cy = row * HH + (col % 2 !== 0 ? HH / 2 : 0);

          const dx = cx - mx;
          const dy = cy - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity = Math.max(0, 1 - dist / 220);

          const wave = 0.5 + 0.5 * Math.sin(t * 0.6 + col * 0.9 + row * 1.3);
          const fillAlpha = 0.06 + wave * 0.05 + proximity * 0.55;

          const rC = Math.round(0 + proximity * 101);
          const gC = Math.round(93 + proximity * 77);
          const bC = Math.round(151 + proximity * 70);

          drawHex(cx, cy, R - 1.5);
          ctx!.fillStyle = `rgba(${rC}, ${gC}, ${bC}, ${fillAlpha})`;
          ctx!.fill();

          drawHex(cx, cy, R - 1.5);
          ctx!.strokeStyle = `rgba(101, 170, 221, ${0.07 + proximity * 0.45 + wave * 0.04})`;
          ctx!.lineWidth = 0.6;
          ctx!.stroke();
        }
      }

      t += 0.018;
      animFrame = requestAnimationFrame(draw);
    }

    draw();

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <HexBackground />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center">
          <h1
            className="text-4xl font-normal leading-tight tracking-wide text-white drop-shadow-lg"
            style={{ fontFamily: "var(--font-krona-one)" }}
          >
            Einstein Probe
          </h1>
          <p
            className="mt-2 text-lg font-normal tracking-widest text-[#65aadd] drop-shadow"
            style={{ fontFamily: "var(--font-krona-one)" }}
          >
            Scheduling System
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur-lg">
          <p className="mb-5 text-sm text-slate-300/80">
            Sign in to access Users, ToO Requests, and GP Cycle 2.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#65aadd] focus:ring-1 focus:ring-[#65aadd]"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#65aadd] focus:ring-1 focus:ring-[#65aadd]"
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <p className="text-sm text-rose-400">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full rounded-lg bg-[#005d97] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#65aadd] disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}