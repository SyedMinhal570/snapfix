-- SnapFix schema — run this in the Supabase SQL Editor

-- Issues table
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  screenshot_url text not null,
  annotated_url text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'fixed')),
  page_url text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.issues enable row level security;

create policy "Authenticated users can select all issues"
  on public.issues
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert their own issues"
  on public.issues
  for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Authenticated users can update any issue"
  on public.issues
  for update
  to authenticated
  using (true)
  with check (true);

-- Public storage bucket for screenshots
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload screenshots"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'screenshots');

create policy "Anyone can view screenshots"
  on storage.objects
  for select
  to public
  using (bucket_id = 'screenshots');

-- Enable Realtime for the issues table
alter publication supabase_realtime add table public.issues;

-- Severity column (run this if the table already exists)
alter table public.issues
  add column if not exists severity text not null default 'medium'
  check (severity in ('low', 'medium', 'high', 'critical'));
