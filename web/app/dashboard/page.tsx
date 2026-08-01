import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  FREE_MAX_FEEDBACK_PER_PROJECT,
  FREE_MAX_PROJECTS,
  isFreePlan,
} from "@/lib/plans";

type ProjectRow = {
  id: string;
  name: string;
  client_name: string | null;
  screenshot_url: string;
  share_slug: string;
  created_at: string;
  feedback: { count: number }[];
};

export default async function ProjectsDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle()
    : { data: null };

  const plan = profile?.plan ?? "free";
  const free = isFreePlan(plan);

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, client_name, screenshot_url, share_slug, created_at, feedback(count)",
    )
    .order("created_at", { ascending: false });

  const list = (projects as ProjectRow[] | null) ?? [];
  const atProjectLimit = free && list.length >= FREE_MAX_PROJECTS;

  return (
    <main>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Projects
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Share a link with clients — they review without logging in.
            {free ? (
              <span className="ml-1">
                Free plan: {list.length}/{FREE_MAX_PROJECTS} project
                {FREE_MAX_PROJECTS === 1 ? "" : "s"},{" "}
                {FREE_MAX_FEEDBACK_PER_PROJECT} feedback each.
              </span>
            ) : (
              <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Paid
              </span>
            )}
          </p>
        </div>
        {atProjectLimit ? (
          <span className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Upgrade to add more projects
          </span>
        ) : (
          <Link
            href="/dashboard/projects/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New Project
          </Link>
        )}
      </div>

      {!list.length ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No projects yet. Create one and share the review link with a client.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((project) => {
            const feedbackCount = project.feedback?.[0]?.count ?? 0;
            return (
              <li key={project.id}>
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="block overflow-hidden rounded-lg border border-zinc-200 bg-white transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <div className="aspect-video bg-zinc-100 dark:bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={project.screenshot_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {project.name}
                    </h2>
                    {project.client_name ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {project.client_name}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {feedbackCount} feedback
                      {feedbackCount === 1 ? "" : "s"} ·{" "}
                      {project.created_at.slice(0, 10)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
