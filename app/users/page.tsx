"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type User = {
  id: number;
  name: string;
  username: string;
  age: number;
  email: string;
  vip: boolean;
};

type UserInput = {
  name: string;
  username: string;
  age: string;
  email: string;
  password: string;
  vip: boolean;
};

type FormErrors = Partial<Record<keyof UserInput, string>>;

const initialForm: UserInput = {
  name: "",
  username: "",
  age: "",
  email: "",
  password: "",
  vip: false,
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

  function validateForm(values: UserInput): FormErrors {
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

    if (!values.password.trim()) {
      errors.password = "Password is required";
    } else if (values.password.trim().length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (!values.age.trim()) {
      errors.age = "Age is required";
    } else {
      const age = Number(values.age);
      if (Number.isNaN(age)) {
        errors.age = "Age must be numeric";
      } else if (age < 0) {
        errors.age = "Age must be zero or greater";
      }
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateForm(createForm);
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
          age: Number(createForm.age),
          email: createForm.email.trim(),
          password: createForm.password,
          vip: createForm.vip,
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
      age: String(user.age),
      email: user.email,
      password: "",
      vip: user.vip,
    });
    setEditErrors({});
    setMessage("");
  }

  async function handleUpdate(id: number) {
    const errors = validateForm({
      ...editForm,
      password: editForm.password ? editForm.password : "temporary-pass",
    });
    if (!editForm.password) {
      delete errors.password;
    }
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
          age: Number(editForm.age),
          email: editForm.email.trim(),
          password: editForm.password.trim() || undefined,
          vip: editForm.vip,
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

  async function handleVipToggle(user: User) {
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vip: !user.vip }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update vip status");
      }

      if (editingId === user.id) {
        setEditForm((previous) => ({ ...previous, vip: !user.vip }));
      }

      setStatus(user.vip ? "User removed from VIP" : "User marked as VIP", "success");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update vip status", "error");
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
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-6xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Users</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create, edit, delete, and toggle VIP status directly from the page.</p>
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

        <form onSubmit={handleCreate} className="mt-6 grid gap-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700 md:grid-cols-[1.1fr_1fr_0.7fr_1.3fr_1.1fr_auto_auto] md:items-start">
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
              type="number"
              min={0}
              placeholder="Age"
              value={createForm.age}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, age: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {renderFieldError(createErrors.age)}
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
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
            <input
              type="checkbox"
              checked={createForm.vip}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, vip: event.target.checked }))}
            />
            VIP
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                <th className="px-3 py-2">Age</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Password</th>
                <th className="px-3 py-2">VIP</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={8}>
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={8}>
                    No users yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isEditing = editingId === user.id;

                  return (
                    <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{user.id}</td>
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
                              type="number"
                              min={0}
                              value={editForm.age}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, age: event.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            />
                            {renderFieldError(editErrors.age)}
                          </div>
                        ) : (
                          user.age
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
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${user.vip ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200"}`}>
                          {user.vip ? "VIP" : "Standard"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-200">
                              <input
                                type="checkbox"
                                checked={editForm.vip}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, vip: event.target.checked }))}
                              />
                              VIP
                            </label>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleUpdate(user.id)}
                              className="rounded-md bg-emerald-600 px-3 py-1 text-white disabled:opacity-60"
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
                              className="rounded-md border border-slate-300 px-3 py-1 dark:border-slate-600 dark:text-slate-200"
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
                              className="rounded-md bg-amber-500 px-3 py-1 text-white disabled:opacity-60"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleVipToggle(user)}
                              className={`rounded-md px-3 py-1 text-white disabled:opacity-60 ${user.vip ? "bg-slate-700" : "bg-indigo-600"}`}
                            >
                              {user.vip ? "This is not VIP" : "This is VIP"}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setDeleteCandidate(user)}
                              className="rounded-md bg-rose-600 px-3 py-1 text-white disabled:opacity-60"
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
