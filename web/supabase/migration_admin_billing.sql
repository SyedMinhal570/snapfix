-- Admin + profiles.email for Markly manual billing
-- Run in Supabase SQL Editor. Set admin_email to the SAME value as ADMIN_EMAIL in .env.local
-- Other .env.local keys used by the web app: NEXT_PUBLIC_SUPABASE_URL,
-- NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SENTRY_DSN, GROQ_API_KEY

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

insert into public.app_settings (key, value)
values ('admin_email', 'SET_ADMIN_EMAIL_HERE')
on conflict (key) do nothing;

alter table public.profiles
  add column if not exists email text;

-- Keep email in sync for new signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, plan, email)
  values (new.id, 'free', new.email)
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

-- Backfill emails for existing profiles
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) =
    lower(coalesce(
      (select value from public.app_settings where key = 'admin_email' limit 1),
      ''
    ));
$$;

-- Allow admin to read all profiles (owners still read own)
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_app_admin());

drop policy if exists "Admin can update any profile" on public.profiles;
create policy "Admin can update any profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_app_admin())
  with check (auth.uid() = id or public.is_app_admin());
