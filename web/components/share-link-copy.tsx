"use client";

import { useState } from "react";

export default function ShareLinkCopy({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/review/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <code className="min-w-0 flex-1 truncate text-xs text-zinc-700 dark:text-zinc-300">
        {url || `/review/${slug}`}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
