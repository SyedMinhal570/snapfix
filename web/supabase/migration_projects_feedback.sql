-- SnapFix client-feedback pivot — run in Supabase SQL Editor
-- Safe to run on an existing project that already has `issues` + screenshots.

-- ─── Profiles (freelancer plan) ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a free profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, plan)
  values (new.id, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for existing users
insert into public.profiles (id, plan)
select id, 'free' from auth.users
on conflict (id) do nothing;

-- ─── Projects ───────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  client_name text,
  client_email text,
  screenshot_url text not null,
  share_slug text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists projects_share_slug_idx on public.projects (share_slug);

alter table public.projects enable row level security;

create policy "Owners can select own projects"
  on public.projects for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can insert own projects"
  on public.projects for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update own projects"
  on public.projects for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete own projects"
  on public.projects for delete
  to authenticated
  using (auth.uid() = owner_id);

-- No direct anon SELECT on projects (prevents listing). Use get_review_project RPC.

-- ─── Feedback (anonymous client submissions) ──────────────────────────────
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  annotated_image_url text not null,
  comment_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists feedback_project_id_idx on public.feedback (project_id);

alter table public.feedback enable row level security;

create policy "Owners can read feedback on their projects"
  on public.feedback for select
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = feedback.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- Inserts go through submit_feedback RPC (security definer) so we can enforce
-- free-plan caps and avoid opening broad anon INSERT on the table.

-- ─── Public review RPC (read one project by slug) ─────────────────────────
create or replace function public.get_review_project(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  proj public.projects%rowtype;
  owner_plan text;
  fb_count integer;
  can_submit boolean;
begin
  select * into proj
  from public.projects
  where share_slug = p_slug
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(p.plan, 'free') into owner_plan
  from public.profiles p
  where p.id = proj.owner_id;

  if owner_plan is null then
    owner_plan := 'free';
  end if;

  select count(*)::integer into fb_count
  from public.feedback
  where project_id = proj.id;

  can_submit := (owner_plan = 'paid') or (fb_count < 10);

  return json_build_object(
    'id', proj.id,
    'name', proj.name,
    'client_name', proj.client_name,
    'screenshot_url', proj.screenshot_url,
    'share_slug', proj.share_slug,
    'created_at', proj.created_at,
    'feedback_count', fb_count,
    'can_submit', can_submit,
    'plan', owner_plan
  );
end;
$$;

grant execute on function public.get_review_project(text) to anon, authenticated;

-- ─── Submit feedback RPC (anon + authenticated) ───────────────────────────
create or replace function public.submit_feedback(
  p_project_id uuid,
  p_annotated_image_url text,
  p_comment_text text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_plan text;
  fb_count integer;
  new_row public.feedback%rowtype;
begin
  if not exists (select 1 from public.projects where id = p_project_id) then
    return json_build_object('ok', false, 'error', 'Project not found');
  end if;

  select coalesce(pr.plan, 'free') into owner_plan
  from public.projects p
  left join public.profiles pr on pr.id = p.owner_id
  where p.id = p_project_id;

  if owner_plan is null then
    owner_plan := 'free';
  end if;

  select count(*)::integer into fb_count
  from public.feedback
  where project_id = p_project_id;

  if owner_plan = 'free' and fb_count >= 10 then
    return json_build_object(
      'ok', false,
      'error', 'upgrade_required',
      'message', 'This project has reached the free plan feedback limit. Ask the freelancer to upgrade for more submissions.'
    );
  end if;

  insert into public.feedback (project_id, annotated_image_url, comment_text)
  values (p_project_id, p_annotated_image_url, coalesce(p_comment_text, ''))
  returning * into new_row;

  return json_build_object(
    'ok', true,
    'feedback', row_to_json(new_row)
  );
end;
$$;

grant execute on function public.submit_feedback(uuid, text, text) to anon, authenticated;

-- ─── Storage: allow anonymous uploads under feedback/ ─────────────────────
create policy "Anyone can upload feedback annotations"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = 'feedback'
  );

-- Freelancers already have authenticated upload; keep public read on bucket.

-- ─── Realtime for feedback ────────────────────────────────────────────────
alter publication supabase_realtime add table public.feedback;
