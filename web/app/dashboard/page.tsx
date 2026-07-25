import Link from "next/link";
import IssueList, { type Issue } from "@/components/issue-list";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, status, screenshot_url, annotated_url, created_at")
    .order("created_at", { ascending: false });

  return (
    <main>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Issues
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            All reported bugs and feedback
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New Issue
        </Link>
      </div>

      <IssueList initialIssues={(issues as Issue[]) ?? []} />
    </main>
  );
}
