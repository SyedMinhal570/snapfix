-- Map Safepay checkout trackers to Markly users.
-- Safepay metadata only accepts predefined keys (order_id, source) — not arbitrary
-- fields like user_id. Run in the Supabase SQL Editor.

create table if not exists public.safepay_checkouts (
  tracker text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists safepay_checkouts_user_id_idx
  on public.safepay_checkouts (user_id);

alter table public.safepay_checkouts enable row level security;
-- No anon/authenticated policies: only the service-role admin client reads/writes.
