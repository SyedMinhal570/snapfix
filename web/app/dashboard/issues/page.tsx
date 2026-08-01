import Link from "next/link";
import IssueList, { type Issue } from "@/components/issue-list";
import { createClient } from "@/lib/supabase/server";

export default async function IssuesPage() {
  const supabase = await createClient();
  const { data: issues } = await supabase
    .from("issues")
    .select(
      "id, title, status, severity, screenshot_url, annotated_url, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <main>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Issues
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Internal bug tracker (existing flow)
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          New Issue
        </Link>
      </div>

      <IssueList initialIssues={(issues as Issue[]) ?? []} />
    </main>
  );
}
