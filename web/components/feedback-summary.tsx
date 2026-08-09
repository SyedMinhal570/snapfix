"use client";

import { useState } from "react";

export default function FeedbackSummary({
  projectId,
  hasFeedback,
}: {
  projectId: string;
  hasFeedback: boolean;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!hasFeedback) return null;

  async function handleSummarize() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/summarize-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = (await res.json()) as {
        summary?: string;
        error?: string;
      };

      if (!res.ok) {
        setError(
          data.error ?? "Couldn't generate a summary, try again",
        );
        setSummary(null);
        return;
      }

      setSummary(data.summary ?? null);
    } catch {
      setError("Couldn't generate a summary, try again");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 space-y-3">
      <button
        type="button"
        onClick={handleSummarize}
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? "Summarizing…" : "Summarize feedback"}
      </button>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {summary && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            AI summary
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
}
