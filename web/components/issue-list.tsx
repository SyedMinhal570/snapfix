"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  severityLabels,
  severityRank,
  severityStyles,
  type Severity,
} from "@/lib/severity";
import { createClient } from "@/lib/supabase/client";
import ToastStack, { type ToastItem } from "@/components/toast";

export type Issue = {
  id: string;
  title: string;
  status: string;
  severity: Severity;
  screenshot_url: string;
  annotated_url: string | null;
  created_at: string;
};

const STATUSES = ["open", "in_progress", "fixed"] as const;

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
};

const statusStyles: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/20",
  in_progress:
    "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-400/20",
  fixed:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/20",
};

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const SORTS = {
  newest: "Newest first",
  oldest: "Oldest first",
  severity: "Severity (highest)",
} as const;

type SortKey = keyof typeof SORTS;

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:focus:border-zinc-500";

/** Fixed YYYY-MM-DD from the ISO string — identical on server and client. */
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export default function IssueList({
  initialIssues,
}: {
  initialIssues: Issue[];
}) {
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  function dismissToast(id: string) {
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function pushToast(title: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, title }]);
    const timer = setTimeout(() => dismissToast(id), 4000);
    toastTimers.current.set(id, timer);
  }

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => clearTimeout(timer));
      toastTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase
      .channel("issues-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issues" },
        (payload) => {
          console.log("[issues realtime] event received:", payload.eventType, payload);

          if (payload.eventType === "INSERT") {
            const issue = payload.new as Issue;
            setIssues((prev) => {
              if (prev.some((i) => i.id === issue.id)) return prev;
              return [issue, ...prev];
            });
            // Toast on live INSERT only — initial load never hits this handler.
            pushToast(issue.title || "Untitled issue");
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Issue;
            setIssues((prev) =>
              prev.map((issue) =>
                issue.id === updated.id
                  ? { ...issue, status: updated.status }
                  : issue,
              ),
            );
          }
        },
      );

    async function subscribe() {
      // Realtime enforces RLS using the JWT on the socket. With cookie-based
      // SSR auth the token can lag behind channel setup — set it explicitly.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      } else {
        console.warn(
          "[issues realtime] no session token — RLS may drop events",
        );
      }

      channel.subscribe((status, err) => {
        console.log("[issues realtime] subscription status:", status, err ?? "");
      });
    }

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        void supabase.realtime.setAuth(session.access_token);
      }
    });

    void subscribe();

    return () => {
      cancelled = true;
      authSub.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, []);

  async function handleStatusChange(id: string, status: string) {
    setIssues((prev) =>
      prev.map((issue) => (issue.id === id ? { ...issue, status } : issue)),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("issues")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error(error.message);
    }
  }

  const visibleIssues = useMemo(() => {
    const filtered = issues.filter(
      (issue) =>
        (statusFilter === "all" || issue.status === statusFilter) &&
        (severityFilter === "all" || issue.severity === severityFilter),
    );

    return filtered.sort((a, b) => {
      if (sort === "oldest") {
        return a.created_at.localeCompare(b.created_at);
      }
      if (sort === "severity") {
        const diff =
          (severityRank[b.severity] ?? 1) - (severityRank[a.severity] ?? 1);
        if (diff !== 0) return diff;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [issues, statusFilter, severityFilter, sort]);

  if (!issues.length) {
    return (
      <>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No issues yet. Create your first one.
        </p>
      </>
    );
  }

  return (
    <>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Severity
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All</option>
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severityLabels[severity]}
              </option>
            ))}
          </select>
        </label>

        <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={selectClass}
          >
            {Object.entries(SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!visibleIssues.length ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No issues match your filters.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleIssues.map((issue) => (
            <li
              key={issue.id}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="aspect-video bg-zinc-100 dark:bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={issue.annotated_url || issue.screenshot_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-sm font-medium text-zinc-900 line-clamp-2 dark:text-zinc-100">
                    {issue.title}
                  </h2>
                  <select
                    value={issue.status}
                    onChange={(e) =>
                      handleStatusChange(issue.id, e.target.value)
                    }
                    aria-label={`Status for ${issue.title}`}
                    className={`shrink-0 rounded-full border-0 px-2 py-0.5 text-xs font-medium ring-1 ring-inset outline-none ${
                      statusStyles[issue.status] ?? statusStyles.open
                    }`}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      severityStyles[issue.severity] ?? severityStyles.medium
                    }`}
                  >
                    {severityLabels[issue.severity] ?? issue.severity}
                  </span>
                </div>
                <time
                  dateTime={issue.created_at}
                  className="text-xs text-zinc-500 dark:text-zinc-400"
                >
                  {formatDate(issue.created_at)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
