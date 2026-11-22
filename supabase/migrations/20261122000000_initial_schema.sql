create extension if not exists pgcrypto;

do $$ begin
  create type public.plan_tier as enum ('free', 'pro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.authorship_type as enum ('solo', 'team_external_idea', 'enterprise', 'mentorship');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_status as enum ('active', 'paused', 'completed');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  plan_tier public.plan_tier not null default 'free',
  subscription_status text,
  payment_provider text check (
    payment_provider is null or payment_provider in ('stripe', 'lemonsqueezy', 'mercadopago')
  ),
  hourly_rate_default numeric(12, 2) check (hourly_rate_default is null or hourly_rate_default >= 0),
  monthly_available_hours numeric(8, 2) not null default 160 check (monthly_available_hours >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#FF9A00',
  hourly_rate_override numeric(12, 2) check (hourly_rate_override is null or hourly_rate_override >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index if not exists categories_user_name_unique
  on public.categories (user_id, lower(name));

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists task_templates_user_name_unique
  on public.task_templates (user_id, lower(name));

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null,
  title text not null,
  client_or_context text,
  authorship_type public.authorship_type not null default 'solo',
  status public.project_status not null default 'active',
  start_date date not null default current_date,
  end_date date,
  budget_quoted numeric(12, 2) check (budget_quoted is null or budget_quoted >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete restrict,
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  estimated_hours numeric(10, 2) not null default 0 check (estimated_hours >= 0),
  logged_hours numeric(10, 2) not null default 0 check (logged_hours >= 0),
  is_completed boolean not null default false,
  auto_estimated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id, user_id),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete cascade
);

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null,
  task_id uuid,
  log_date date not null default current_date,
  duration_hours numeric(10, 2) not null check (duration_hours > 0),
  notes text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete cascade,
  foreign key (task_id, project_id, user_id)
    references public.project_tasks (id, project_id, user_id) on delete set null (task_id)
);

create index if not exists projects_user_status_idx on public.projects (user_id, status);
create index if not exists project_tasks_project_idx on public.project_tasks (project_id, user_id);
create index if not exists time_logs_user_date_idx on public.time_logs (user_id, log_date desc);
create index if not exists time_logs_task_idx on public.time_logs (task_id) where task_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger project_tasks_set_updated_at
before update on public.project_tasks
for each row execute function public.set_updated_at();

create or replace function public.apply_task_auto_estimate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_completed and new.estimated_hours = 0 then
    new.estimated_hours := new.logged_hours;
    new.auto_estimated := true;
  end if;
  return new;
end;
$$;

create trigger project_tasks_auto_estimate
before insert or update of is_completed, estimated_hours, logged_hours
on public.project_tasks
for each row execute function public.apply_task_auto_estimate();

create or replace function public.recalculate_task_logged_hours(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_hours numeric(10, 2);
begin
  select coalesce(sum(tl.duration_hours), 0)::numeric(10, 2)
    into total_hours
    from public.time_logs as tl
   where tl.task_id = p_task_id;

  update public.project_tasks as pt
     set logged_hours = total_hours,
         estimated_hours = case
           when (pt.estimated_hours = 0 or pt.auto_estimated) and total_hours > 0
             then total_hours
           else pt.estimated_hours
         end,
         auto_estimated = pt.auto_estimated or (pt.estimated_hours = 0 and total_hours > 0)
   where pt.id = p_task_id;
end;
$$;

revoke all on function public.recalculate_task_logged_hours(uuid) from public, anon, authenticated;

create or replace function public.sync_task_logged_hours_from_time_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.task_id is not null then
    perform public.recalculate_task_logged_hours(old.task_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.task_id is not null then
    perform public.recalculate_task_logged_hours(new.task_id);
  end if;

  return null;
end;
$$;

revoke all on function public.sync_task_logged_hours_from_time_log() from public, anon, authenticated;

create trigger time_logs_sync_task_hours
after insert or update or delete on public.time_logs
for each row execute function public.sync_task_logged_hours_from_time_log();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.categories (user_id, name, color, is_default)
  values
    (new.id, 'Web / Apps', '#FF9A00', true),
    (new.id, 'UI / UX', '#8B5CF6', true),
    (new.id, 'Ciencia de Datos', '#06B6D4', true),
    (new.id, 'Videojuegos', '#EC4899', true),
    (new.id, 'Agénticos / Multiagénticos', '#10B981', true),
    (new.id, 'Mentorías', '#F59E0B', true),
    (new.id, 'Robótica', '#6366F1', true),
    (new.id, 'Otros', '#A1A1A1', true);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.task_templates enable row level security;
alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.time_logs enable row level security;

create policy "Users can read their profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke insert, update on public.profiles from anon, authenticated;
grant update (email, full_name, avatar_url, hourly_rate_default, monthly_available_hours, currency)
  on public.profiles to authenticated;

create policy "Users can manage their categories"
  on public.categories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their task templates"
  on public.task_templates for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their projects"
  on public.projects for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their project tasks"
  on public.project_tasks for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "Users can manage their time logs"
  on public.time_logs for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );
