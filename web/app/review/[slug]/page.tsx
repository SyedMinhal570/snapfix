"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AnnotationCanvas, {
  type AnnotationCanvasHandle,
} from "@/components/annotation-canvas";
import { createClient } from "@/lib/supabase/client";

type ReviewProject = {
  id: string;
  name: string;
  client_name: string | null;
  screenshot_url: string;
  share_slug: string;
  feedback_count: number;
  can_submit: boolean;
  plan: string;
};

export default function PublicReviewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const canvasRef = useRef<AnnotationCanvasHandle>(null);

  const [project, setProject] = useState<ReviewProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data, error } = await supabase.rpc("get_review_project", {
        p_slug: slug,
      });

      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setLoadError("This review link is invalid or has expired.");
        setLoading(false);
        return;
      }

      setProject(data as ReviewProject);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!project) return;

    setSubmitError(null);
    setUpgradeMessage(null);

    if (!project.can_submit) {
      setUpgradeMessage(
        "This project has reached the free plan feedback limit. Ask the freelancer to upgrade for more submissions.",
      );
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const annotatedBlob = await canvasRef.current?.exportPng();
    if (!annotatedBlob) {
      setSubmitting(false);
      setSubmitError("Could not export your annotations. Please try again.");
      return;
    }

    const path = `feedback/${project.id}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(path, annotatedBlob, { contentType: "image/png" });

    if (uploadError) {
      setSubmitting(false);
      setSubmitError(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("screenshots").getPublicUrl(path);

    const { data, error } = await supabase.rpc("submit_feedback", {
      p_project_id: project.id,
      p_annotated_image_url: publicUrl,
      p_comment_text: comment.trim(),
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    const result = data as {
      ok: boolean;
      error?: string;
      message?: string;
    } | null;

    if (!result?.ok) {
      if (result?.error === "upgrade_required") {
        setUpgradeMessage(
          result.message ??
            "This project has reached the free plan feedback limit.",
        );
        setProject((p) => (p ? { ...p, can_submit: false } : p));
        return;
      }
      setSubmitError(result?.message ?? "Could not submit feedback.");
      return;
    }

    setDone(true);
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-full max-w-3xl flex-1 items-center justify-center px-4">
        <p className="text-sm text-zinc-500">Loading review…</p>
      </main>
    );
  }

  if (loadError || !project) {
    return (
      <main className="mx-auto flex min-h-full max-w-3xl flex-1 items-center justify-center px-4">
        <p className="text-sm text-red-600" role="alert">
          {loadError ?? "Not found"}
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Thanks!
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Your feedback for <strong>{project.name}</strong> was submitted.
          You can close this tab.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        SnapFix review
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {project.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Mark up the screenshot and leave a comment. No account needed.
      </p>

      {!project.can_submit ? (
        <p
          className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          role="status"
        >
          This project has reached the free plan feedback limit. Ask the
          freelancer to upgrade to accept more submissions.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <AnnotationCanvas
            ref={canvasRef}
            imageUrl={project.screenshot_url}
          />

          <div>
            <label
              htmlFor="comment"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Comment
            </label>
            <textarea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe what should change…"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
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

          {submitError && (
            <p className="text-sm text-red-600" role="alert">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? "Submitting…" : "Submit feedback"}
          </button>
        </form>
      )}
    </main>
  );
}
