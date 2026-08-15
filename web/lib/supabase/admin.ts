import { createClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client (service role). Server-only — never import from
 * client components. Used for lookups that RLS would block for anon callers
 * (e.g. resolving a project owner's email after public feedback submit).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
