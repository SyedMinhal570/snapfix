"use client";

import { useEffect, useState } from "react";
import FeedbackSummary from "@/components/feedback-summary";
import ToastStack, { type ToastItem } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";

export type FeedbackItem = {
  id: string;
  project_id: string;
  annotated_image_url: string;
  comment_text: string;
  created_at: string;
};

export default function FeedbackFeed({
  projectId,
  initialFeedback,
}: {
  projectId: string;
  initialFeedback: FeedbackItem[];
}) {
  const [items, setItems] = useState<FeedbackItem[]>(initialFeedback);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function pushToast(title: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [
      ...prev,
      { id, label: "New client feedback:", title },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase
      .channel(`feedback-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feedback",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as FeedbackItem;
          setItems((prev) => {
            if (prev.some((i) => i.id === row.id)) return prev;
            return [row, ...prev];
          });
          pushToast(
            row.comment_text?.trim()
              ? row.comment_text.slice(0, 80)
              : "New client feedback",
          );
        },
      );

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      channel.subscribe();
    }

    void subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return (
    <>
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <FeedbackSummary
        projectId={projectId}
        hasFeedback={items.length > 0}
      />

      {!items.length ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No feedback yet. Share the review link with your client.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="grid gap-0 sm:grid-cols-2">
                <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 sm:aspect-auto sm:min-h-[180px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.annotated_image_url}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-col p-4">
                  <time
                    dateTime={item.created_at}
                    className="text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    {new Date(item.created_at).toLocaleString()}
                  </time>
                  <p className="mt-2 flex-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                    {item.comment_text.trim() || (
                      <span className="italic text-zinc-400">No comment</span>
                    )}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
