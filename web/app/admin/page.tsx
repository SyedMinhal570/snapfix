import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminEmail) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold">Admin not configured</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Set <code className="text-zinc-800 dark:text-zinc-200">ADMIN_EMAIL</code>{" "}
          in <code className="text-zinc-800 dark:text-zinc-200">.env.local</code>{" "}
          and the matching value in Supabase{" "}
          <code className="text-zinc-800 dark:text-zinc-200">app_settings</code>.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || user.email.toLowerCase() !== adminEmail) {
    redirect("/dashboard");
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, plan, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Admin
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manually activate paid plans after JazzCash / Easypaisa payment.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
        >
          Dashboard
        </Link>
      </div>

      <AdminClient initialProfiles={profiles ?? []} />
    </main>
  );
}
