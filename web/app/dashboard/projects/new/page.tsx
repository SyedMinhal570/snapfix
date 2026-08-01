"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FREE_MAX_PROJECTS,
  isFreePlan,
} from "@/lib/plans";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUpgradeMessage(null);

    if (!file) {
      setError("Please upload a screenshot for the client to review.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      setError("You must be signed in.");
      return;
    }

    // Ensure profile exists (covers older accounts before the trigger)
    await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    const plan = profile?.plan ?? "free";

    if (isFreePlan(plan)) {
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);

      if ((count ?? 0) >= FREE_MAX_PROJECTS) {
        setLoading(false);
        setUpgradeMessage(
          "Free plan includes 1 project. Upgrade to Paid to create more.",
        );
        return;
      }
    }

    const id = crypto.randomUUID();
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/projects/${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(path, file);

    if (uploadError) {
      setLoading(false);
      setError(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("screenshots").getPublicUrl(path);

    const shareSlug = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        name,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
        screenshot_url: publicUrl,
        share_slug: shareSlug,
      })
      .select("id")
      .single();

    setLoading(false);

    if (insertError || !project) {
      setError(insertError?.message ?? "Could not create project.");
      return;
    }

    router.push(`/dashboard/projects/${project.id}`);
    router.refresh();
  }

  return (
    <main>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        New project
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Upload a screenshot and get a shareable review link for your client.
      </p>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5">
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Project name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Homepage redesign"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="client_name"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Client name{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="client_name"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="client_email"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Client email{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="client_email"
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="screenshot"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Screenshot for review
          </label>
          <input
            id="screenshot"
            type="file"
            accept="image/*"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />
        </div>

        {upgradeMessage && (
          <p
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            role="status"
          >
            {upgradeMessage}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {loading ? "Creating…" : "Create project"}
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
