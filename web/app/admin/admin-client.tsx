"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  id: string;
  email: string | null;
  plan: string;
  created_at: string;
};

export default function AdminClient({
  initialProfiles,
}: {
  initialProfiles: ProfileRow[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<ProfileRow | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...profiles].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    [profiles],
  );

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setLookup(null);
    setActionError(null);

    const email = query.trim().toLowerCase();
    if (!email) {
      setLookupError("Enter an email to search.");
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, plan, created_at")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      setLookupError(error.message);
      return;
    }

    if (!data) {
      setLookupError("No user found with that email.");
      return;
    }

    setLookup(data as ProfileRow);
  }

  function togglePlan(profile: ProfileRow) {
    const nextPlan = profile.plan === "paid" ? "free" : "paid";
    setActionError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ plan: nextPlan })
        .eq("id", profile.id);

      if (error) {
        setActionError(error.message);
        return;
      }

      const updated = { ...profile, plan: nextPlan };
      setLookup((prev) => (prev?.id === profile.id ? updated : prev));
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? updated : p)),
      );
    });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <input
          type="email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="user@example.com"
          className="min-w-[220px] flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Look up
        </button>
      </form>

      {lookupError && (
        <p className="text-sm text-red-600" role="alert">
          {lookupError}
        </p>
      )}

      {lookup && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Lookup result</p>
          <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
            {lookup.email ?? "(no email)"}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Current plan:{" "}
            <span className="font-semibold capitalize">{lookup.plan}</span>
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => togglePlan(lookup)}
            className="mt-3 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            {pending
              ? "Updating…"
              : `Switch to ${lookup.plan === "paid" ? "free" : "paid"}`}
          </button>
        </div>
      )}

      {actionError && (
        <p className="text-sm text-red-600" role="alert">
          {actionError}
        </p>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          All users
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2">{p.email ?? "—"}</td>
                  <td className="px-3 py-2 capitalize">{p.plan}</td>
                  <td className="px-3 py-2 text-zinc-500">
                    {p.created_at.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => togglePlan(p)}
                      className="text-xs font-medium text-teal-700 underline dark:text-teal-300"
                    >
                      Set {p.plan === "paid" ? "free" : "paid"}
                    </button>
                  </td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-zinc-500"
                  >
                    No profiles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
