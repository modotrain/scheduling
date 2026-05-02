"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type UserMenuProps = {
  username: string;
};

export default function UserMenu({ username }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setShowPasswordModal(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openChangePassword() {
    setOpen(false);
    setShowPasswordModal(true);
    setFeedback("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const oldPwd = currentPassword.trim();
    const nextPwd = newPassword.trim();
    const confirmPwd = confirmPassword.trim();

    if (!oldPwd || !nextPwd || !confirmPwd) {
      setFeedbackTone("error");
      setFeedback("All password fields are required");
      return;
    }

    if (nextPwd.length < 8) {
      setFeedbackTone("error");
      setFeedback("New password must be at least 8 characters");
      return;
    }

    if (nextPwd !== confirmPwd) {
      setFeedbackTone("error");
      setFeedback("New password and confirm password must match");
      return;
    }

    if (oldPwd === nextPwd) {
      setFeedbackTone("error");
      setFeedback("New password must be different from current password");
      return;
    }

    setSubmitting(true);
    setFeedback("");

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: oldPwd, newPassword: nextPwd }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to change password");
      }

      setFeedback("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);
      setToast({
        tone: "success",
        message: data.message ?? "Password changed successfully",
      });
    } catch (error) {
      setFeedbackTone("error");
      setFeedback(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {toast ? (
        <div className="fixed right-4 top-20 z-[80] max-w-sm rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className={toast.tone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            {toast.message}
          </p>
        </div>
      ) : null}

      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex max-w-[min(60vw,20rem)] items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className="truncate">{username}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">▾</span>
        </button>

        {open ? (
          <div className="absolute right-0 mt-2 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900" role="menu">
            <button
              type="button"
              onClick={openChangePassword}
              className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              role="menuitem"
            >
              Change password
            </button>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="w-full rounded px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/20"
                role="menuitem"
              >
                Logout
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {showPasswordModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Change password</h2>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  autoComplete="new-password"
                />
              </div>

              {feedback ? (
                <p className={`text-sm ${feedbackTone === "error" ? "text-rose-600" : "text-emerald-600"}`}>{feedback}</p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:brightness-105 disabled:opacity-60"
                >
                  {submitting ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
