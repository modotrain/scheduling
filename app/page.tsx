"use client";

import { FormEvent, useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  age: number;
  email: string;
};

type UserInput = {
  name: string;
  age: string;
  email: string;
};

const initialForm: UserInput = {
  name: "",
  age: "",
  email: "",
};

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [createForm, setCreateForm] = useState<UserInput>(initialForm);
  const [editForm, setEditForm] = useState<UserInput>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = (await response.json()) as { users?: User[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load users");
      }

      setUsers(data.users ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          age: Number(createForm.age),
          email: createForm.email,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create user");
      }

      setCreateForm(initialForm);
      setMessage("User created");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      age: String(user.age),
      email: user.email,
    });
    setMessage("");
  }

  async function handleUpdate(id: number) {
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          age: Number(editForm.age),
          email: editForm.email,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update user");
      }

      setEditingId(null);
      setEditForm(initialForm);
      setMessage("User updated");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete user");
      }

      setMessage("User deleted");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-slate-600">Create, edit, and delete rows in your Neon table.</p>

        <form onSubmit={handleCreate} className="mt-6 grid gap-3 md:grid-cols-4">
          <input
            required
            placeholder="Name"
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            required
            type="number"
            min={0}
            placeholder="Age"
            value={createForm.age}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, age: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={createForm.email}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add User
          </button>
        </form>

        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Age</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={5}>
                    No users yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isEditing = editingId === user.id;

                  return (
                    <tr key={user.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">{user.id}</td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            value={editForm.name}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                          />
                        ) : (
                          user.name
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editForm.age}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, age: event.target.value }))}
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                          />
                        ) : (
                          user.age
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                          />
                        ) : (
                          user.email
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex gap-2">
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
                              }}
                              className="rounded-md border border-slate-300 px-3 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
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
                              onClick={() => handleDelete(user.id)}
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
    </main>
  );
}
