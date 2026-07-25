"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Issue = {
  id: string;
  title: string;
  status: string;
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
  open: "bg-amber-50 text-amber-700 ring-amber-600/20",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-600/20",
  fixed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

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

  if (!issues.length) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500">
        No issues yet. Create your first one.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {issues.map((issue) => (
        <li
          key={issue.id}
          className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
        >
          <div className="aspect-video bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={issue.annotated_url || issue.screenshot_url}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-900 line-clamp-2">
                {issue.title}
              </h2>
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(issue.id, e.target.value)}
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
            <time
              dateTime={issue.created_at}
              className="text-xs text-zinc-500"
            >
              {formatDate(issue.created_at)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
