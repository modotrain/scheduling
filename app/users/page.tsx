"use client";

import { SubmitEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  role: 'viewer' | 'operator' | 'admin';
  allowShortTermPlanning: boolean;
};

type UserInput = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: 'viewer' | 'operator' | 'admin';
};

type FormErrors = Partial<Record<keyof UserInput, string>>;

const initialForm: UserInput = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "viewer",
};

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [createForm, setCreateForm] = useState<UserInput>(initialForm);
  const [editForm, setEditForm] = useState<UserInput>(initialForm);
  const [createErrors, setCreateErrors] = useState<FormErrors>({});
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  function validateForm(values: UserInput, requirePassword = true): FormErrors {
    const errors: FormErrors = {};

    if (!values.name.trim()) {
      errors.name = "Name is required";
    }

    if (!values.email.trim()) {
      errors.email = "Email is required";
    }

    if (!values.username.trim()) {
      errors.username = "Username is required";
    }

    if (requirePassword) {
      if (!values.password.trim()) {
        errors.password = "Password is required";
      } else if (values.password.trim().length < 8) {
        errors.password = "Password must be at least 8 characters";
      }
    } else if (values.password.trim() && values.password.trim().length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    return errors;
  }

  function setStatus(nextMessage: string, tone: "success" | "error") {
    setMessage(nextMessage);
    setMessageTone(tone);
  }

  function hasErrors(errors: FormErrors) {
    return Object.keys(errors).length > 0;
  }

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = (await response.json()) as { users?: User[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load users");
      }

      setUsers(data.users ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateForm(createForm, true);
    setCreateErrors(errors);

    if (hasErrors(errors)) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          username: createForm.username.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          role: createForm.role,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create user");
      }

      setCreateForm(initialForm);
      setCreateErrors({});
      setStatus("User created", "success");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create user", "error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
    });
    setEditErrors({});
    setMessage("");
  }

  async function handleUpdate(id: number) {
    const errors = validateForm(editForm, false);
    setEditErrors(errors);

    if (hasErrors(errors)) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          username: editForm.username.trim(),
          email: editForm.email.trim(),
          password: editForm.password.trim() || undefined,
          role: editForm.role,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update user");
      }

      setEditingId(null);
      setEditForm(initialForm);
      setEditErrors({});
      setStatus("User updated", "success");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update user", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(user: User, newRole: 'viewer' | 'operator' | 'admin') {
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update role");
      }

      if (editingId === user.id) {
        setEditForm((previous) => ({ ...previous, role: newRole }));
      }

      setStatus(`Role updated to ${newRole}`, "success");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update role", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleShortTermPlanning(user: User) {
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowShortTermPlanning: !user.allowShortTermPlanning }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update permission");
      }

      setStatus(`Short-term planning access ${!user.allowShortTermPlanning ? "granted" : "revoked"} for ${user.name}`, "success");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update permission", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${deleteCandidate.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete user");
      }

      if (editingId === deleteCandidate.id) {
        setEditingId(null);
        setEditForm(initialForm);
        setEditErrors({});
      }

      setDeleteCandidate(null);
      setStatus("User deleted", "success");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete user", "error");
    } finally {
      setSaving(false);
    }
  }

  function renderFieldError(messageText?: string) {
    if (!messageText) {
      return null;
    }

    return <p className="mt-1 text-xs text-rose-600">{messageText}</p>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-6xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Users</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Manage user accounts and admin access.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Home
            </Link>
          </div>
        </div>

        <form onSubmit={handleCreate} className="mt-6 grid gap-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700 md:grid-cols-[1.1fr_1fr_1.3fr_1.1fr_auto_auto] md:items-start">
          <div>
            <input
              required
              placeholder="Name"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {renderFieldError(createErrors.name)}
          </div>
          <div>
            <input
              required
              placeholder="Username"
              value={createForm.username}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {renderFieldError(createErrors.username)}
          </div>
          <div>
            <input
              required
              type="email"
              placeholder="Email"
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {renderFieldError(createErrors.email)}
          </div>
          <div>
            <input
              required
              type="password"
              placeholder="Password"
              value={createForm.password}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {renderFieldError(createErrors.password)}
          </div>
          <select
            value={createForm.role}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value as 'viewer' | 'operator' | 'admin' }))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="viewer">Viewer</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add User
          </button>
        </form>

        {message ? (
          <p className={`mt-3 text-sm ${messageTone === "error" ? "text-rose-700" : "text-emerald-700"}`}>
            {message}
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Password</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Short-Term Plan</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4" colSpan={8}>
                    <div className="flex justify-center">
                      <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500 dark:text-slate-400" colSpan={8}>
                    No users yet.
                  </td>
                </tr>
              ) : (
                users.map((user, index) => {
                  const isEditing = editingId === user.id;

                  return (
                    <tr key={user.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/70 hover:bg-slate-100/70 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/35 dark:hover:bg-slate-800/70">
                      <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400">{index + 1}</td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div>
                            <input
                              value={editForm.name}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            />
                            {renderFieldError(editErrors.name)}
                          </div>
                        ) : (
                          user.name
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div>
                            <input
                              value={editForm.username}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            />
                            {renderFieldError(editErrors.username)}
                          </div>
                        ) : (
                          user.username
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div>
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            />
                            {renderFieldError(editErrors.email)}
                          </div>
                        ) : (
                          user.email
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div>
                            <input
                              type="password"
                              placeholder="Leave blank to keep"
                              value={editForm.password}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            />
                            {renderFieldError(editErrors.password)}
                          </div>
                        ) : (
                          <span className="text-slate-400">••••••••</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${user.role === 'admin' ? "bg-primary/10 text-primary dark:bg-sky-300/20 dark:text-sky-200" : user.role === 'operator' ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" : "bg-slate-200/60 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300"}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleToggleShortTermPlanning(user)}
                          title={user.allowShortTermPlanning ? "Click to revoke short-term planning access" : "Click to grant short-term planning access"}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${user.allowShortTermPlanning ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                        >
                          {user.allowShortTermPlanning ? "✓ Allowed" : "✗ Denied"}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={editForm.role}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value as 'viewer' | 'operator' | 'admin' }))}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="operator">Operator</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleUpdate(user.id)}
                              className="rounded-md bg-primary px-3 py-1 text-white hover:bg-brand-dark disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditForm(initialForm);
                                setEditErrors({});
                              }}
                              className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => startEdit(user)}
                              className="rounded-md bg-primary px-3 py-1 text-white hover:bg-brand-dark disabled:opacity-60"
                            >
                              Edit
                            </button>
                            <select
                              disabled={saving}
                              value={user.role}
                              onChange={(event) => void handleRoleChange(user, event.target.value as 'viewer' | 'operator' | 'admin')}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="operator">Operator</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setDeleteCandidate(user)}
                              className="rounded-md bg-rose-600 px-3 py-1 text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteCandidate ? (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <h2 className="text-lg font-semibold">Delete user?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This will remove {deleteCandidate.name} from the table. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteCandidate(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmDelete}
                className="rounded-md bg-rose-600 px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
