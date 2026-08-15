-- Enforce free-plan 1-project cap at INSERT time (not just UI).
-- Run in Supabase SQL Editor after migration_projects_feedback.sql.
-- Paid owners are unlimited. Missing/unknown plan is treated as free.

create or replace function public.enforce_free_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_plan text;
  project_count integer;
begin
  -- Serialize per-owner inserts so two concurrent creates cannot both sneak in.
  perform pg_advisory_xact_lock(hashtext(new.owner_id::text));

  select coalesce(pr.plan, 'free') into owner_plan
  from public.profiles pr
  where pr.id = new.owner_id;

  if owner_plan is null then
    owner_plan := 'free';
  end if;

  -- Anything other than paid is capped (matches web/lib/plans.ts isFreePlan).
  if owner_plan is distinct from 'paid' then
    select count(*)::integer into project_count
    from public.projects
    where owner_id = new.owner_id;

    if project_count >= 1 then
      raise exception 'Free plan allows 1 project. Upgrade to add more.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_project_limit on public.projects;
create trigger enforce_free_project_limit
  before insert on public.projects
  for each row
  execute function public.enforce_free_project_limit();

revoke all on function public.enforce_free_project_limit() from public, anon, authenticated;
