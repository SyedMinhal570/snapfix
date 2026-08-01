import Link from "next/link";
import { notFound } from "next/navigation";
import FeedbackFeed, {
  type FeedbackItem,
} from "@/components/feedback-feed";
import ShareLinkCopy from "@/components/share-link-copy";
import { createClient } from "@/lib/supabase/server";
import { FREE_MAX_FEEDBACK_PER_PROJECT, isFreePlan } from "@/lib/plans";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, client_name, client_email, screenshot_url, share_slug, created_at, owner_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", project.owner_id)
    .maybeSingle();

  const { data: feedback } = await supabase
    .from("feedback")
    .select("id, project_id, annotated_image_url, comment_text, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const plan = profile?.plan ?? "free";
  const count = feedback?.length ?? 0;

  return (
    <main>
      <div className="mb-2">
        <Link
          href="/dashboard"
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Projects
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {[project.client_name, project.client_email]
              .filter(Boolean)
              .join(" · ") || "No client details"}
            {isFreePlan(plan) ? (
              <span className="ml-2">
                · {count}/{FREE_MAX_FEEDBACK_PER_PROJECT} feedback (free)
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Original screenshot
          </h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.screenshot_url}
              alt=""
              className="w-full object-contain"
            />
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Client review link
          </h2>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Send this to your client. No login required.
          </p>
          <ShareLinkCopy slug={project.share_slug} />
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Client feedback
      </h2>
      <FeedbackFeed
        projectId={project.id}
        initialFeedback={(feedback as FeedbackItem[]) ?? []}
      />
    </main>
  );
}
