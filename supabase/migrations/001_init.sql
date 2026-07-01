-- TripWise initial schema.
-- Run in Supabase SQL editor, or via `supabase db push` after `supabase link`.
-- Idempotency: this script is destructive on re-run. Drop the schema first if rerunning.

----------------------------------------------------------------------
-- Extensions
----------------------------------------------------------------------
create extension if not exists "pgcrypto";

----------------------------------------------------------------------
-- Enums
----------------------------------------------------------------------
do $$ begin
  create type public.decision_category as enum
    ('lodging', 'food', 'activity', 'transit', 'day_plan', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.decision_status as enum ('open', 'revealed', 'decided');
exception when duplicate_object then null; end $$;

----------------------------------------------------------------------
-- Tables
----------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 1 and 120),
  destination   text check (length(destination) <= 120),
  start_date    date,
  end_date      date,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  constraint trips_date_order check (
    start_date is null or end_date is null or start_date <= end_date
  )
);

create table if not exists public.trip_members (
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index if not exists trip_members_user_idx on public.trip_members(user_id);

create table if not exists public.trip_invites (
  token       uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  used_at     timestamptz,
  used_by     uuid references auth.users(id)
);
create index if not exists trip_invites_trip_idx on public.trip_invites(trip_id);

create table if not exists public.decisions (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  title              text not null check (length(title) between 1 and 200),
  category           public.decision_category not null default 'other',
  status             public.decision_status not null default 'open',
  winning_option_id  uuid,
  created_by         uuid not null references auth.users(id),
  created_at         timestamptz not null default now(),
  decided_at         timestamptz
);
create index if not exists decisions_trip_idx on public.decisions(trip_id);

create table if not exists public.options (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  label       text not null check (length(label) between 1 and 200),
  url         text,
  image_url   text,
  notes       text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists options_decision_idx on public.options(decision_id);

-- Late-bound FK so options and decisions can reference each other.
alter table public.decisions
  drop constraint if exists decisions_winning_option_fk;
alter table public.decisions
  add constraint decisions_winning_option_fk
  foreign key (winning_option_id) references public.options(id) on delete set null;

create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  option_id   uuid not null references public.options(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (option_id, user_id)
);
create index if not exists ratings_user_idx on public.ratings(user_id);

----------------------------------------------------------------------
-- Helper: is_trip_member
-- Marked stable + security definer so RLS policies can use it without
-- creating infinite recursion through the trip_members policy itself.
----------------------------------------------------------------------
create or replace function public.is_trip_member(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_user_id
  );
$$;

----------------------------------------------------------------------
-- Trigger: when a new auth.users row appears, create a profile.
----------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

----------------------------------------------------------------------
-- Trigger: when a trip is created, add creator as a member.
----------------------------------------------------------------------
create or replace function public.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_trip_created on public.trips;
create trigger on_trip_created
after insert on public.trips
for each row execute function public.handle_new_trip();

----------------------------------------------------------------------
-- Function: accept_invite — joins the calling user to a trip via token.
-- Security definer so it can write to trip_members, which has tight RLS.
----------------------------------------------------------------------
create or replace function public.accept_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_used_at timestamptz;
  v_expires_at timestamptz;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select trip_id, used_at, expires_at
    into v_trip_id, v_used_at, v_expires_at
    from public.trip_invites
   where token = p_token;

  if v_trip_id is null then
    raise exception 'invite not found';
  end if;
  if v_used_at is not null then
    raise exception 'invite already used';
  end if;
  if v_expires_at < now() then
    raise exception 'invite expired';
  end if;

  insert into public.trip_members (trip_id, user_id)
  values (v_trip_id, v_user)
  on conflict do nothing;

  update public.trip_invites
     set used_at = now(), used_by = v_user
   where token = p_token;

  return v_trip_id;
end;
$$;

----------------------------------------------------------------------
-- Reveal mechanic: when every trip member has rated every option of a
-- decision, flip status from 'open' to 'revealed'. Trigger handles it.
----------------------------------------------------------------------
create or replace function public.maybe_reveal_decision(p_decision_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_status public.decision_status;
  v_member_count int;
  v_option_count int;
  v_fully_rated_members int;
begin
  select trip_id, status into v_trip_id, v_status
    from public.decisions where id = p_decision_id;
  if v_trip_id is null or v_status <> 'open' then
    return;
  end if;

  select count(*) into v_member_count
    from public.trip_members where trip_id = v_trip_id;
  select count(*) into v_option_count
    from public.options where decision_id = p_decision_id;

  if v_member_count = 0 or v_option_count = 0 then
    return;
  end if;

  select count(*) into v_fully_rated_members
    from public.trip_members tm
   where tm.trip_id = v_trip_id
     and (
       select count(*) from public.ratings r
        join public.options o on o.id = r.option_id
       where o.decision_id = p_decision_id
         and r.user_id = tm.user_id
     ) = v_option_count;

  if v_fully_rated_members = v_member_count then
    update public.decisions
       set status = 'revealed'
     where id = p_decision_id and status = 'open';
  end if;
end;
$$;

create or replace function public.trg_ratings_after_change()
returns trigger
language plpgsql
as $$
declare
  v_decision_id uuid;
begin
  select decision_id into v_decision_id
    from public.options
   where id = coalesce(new.option_id, old.option_id);
  if v_decision_id is not null then
    perform public.maybe_reveal_decision(v_decision_id);
  end if;
  return null;
end;
$$;

drop trigger if exists ratings_after_change on public.ratings;
create trigger ratings_after_change
after insert or update or delete on public.ratings
for each row execute function public.trg_ratings_after_change();

----------------------------------------------------------------------
-- Row-Level Security
----------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.trips         enable row level security;
alter table public.trip_members  enable row level security;
alter table public.trip_invites  enable row level security;
alter table public.decisions     enable row level security;
alter table public.options       enable row level security;
alter table public.ratings       enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- trips
drop policy if exists trips_select_members on public.trips;
create policy trips_select_members on public.trips
  for select to authenticated
  using (public.is_trip_member(id, auth.uid()));

drop policy if exists trips_insert_self on public.trips;
create policy trips_insert_self on public.trips
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists trips_update_members on public.trips;
create policy trips_update_members on public.trips
  for update to authenticated
  using (public.is_trip_member(id, auth.uid()))
  with check (public.is_trip_member(id, auth.uid()));

drop policy if exists trips_delete_creator on public.trips;
create policy trips_delete_creator on public.trips
  for delete to authenticated
  using (created_by = auth.uid());

-- trip_members
drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members
  for select to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));

-- inserts go through handle_new_trip trigger and accept_invite function
-- (both security definer). Direct insert is forbidden by no INSERT policy.

drop policy if exists trip_members_delete_self on public.trip_members;
create policy trip_members_delete_self on public.trip_members
  for delete to authenticated
  using (user_id = auth.uid());

-- trip_invites
drop policy if exists trip_invites_select_members on public.trip_invites;
create policy trip_invites_select_members on public.trip_invites
  for select to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists trip_invites_insert_members on public.trip_invites;
create policy trip_invites_insert_members on public.trip_invites
  for insert to authenticated
  with check (
    public.is_trip_member(trip_id, auth.uid())
    and created_by = auth.uid()
  );

-- decisions
drop policy if exists decisions_select_members on public.decisions;
create policy decisions_select_members on public.decisions
  for select to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists decisions_insert_members on public.decisions;
create policy decisions_insert_members on public.decisions
  for insert to authenticated
  with check (
    public.is_trip_member(trip_id, auth.uid())
    and created_by = auth.uid()
  );

drop policy if exists decisions_update_members on public.decisions;
create policy decisions_update_members on public.decisions
  for update to authenticated
  using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists decisions_delete_members on public.decisions;
create policy decisions_delete_members on public.decisions
  for delete to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));

-- options (membership is checked through the parent decision's trip)
drop policy if exists options_select_members on public.options;
create policy options_select_members on public.options
  for select to authenticated
  using (
    exists (
      select 1 from public.decisions d
      where d.id = decision_id
        and public.is_trip_member(d.trip_id, auth.uid())
    )
  );

drop policy if exists options_insert_members on public.options;
create policy options_insert_members on public.options
  for insert to authenticated
  with check (
    exists (
      select 1 from public.decisions d
      where d.id = decision_id
        and public.is_trip_member(d.trip_id, auth.uid())
    )
  );

drop policy if exists options_update_members on public.options;
create policy options_update_members on public.options
  for update to authenticated
  using (
    exists (
      select 1 from public.decisions d
      where d.id = decision_id
        and public.is_trip_member(d.trip_id, auth.uid())
    )
  );

drop policy if exists options_delete_members on public.options;
create policy options_delete_members on public.options
  for delete to authenticated
  using (
    exists (
      select 1 from public.decisions d
      where d.id = decision_id
        and public.is_trip_member(d.trip_id, auth.uid())
    )
  );

-- ratings: own ratings always; others' ratings only after reveal.
-- This is the core IP encoded at the DB layer — independent rating + delayed reveal.
drop policy if exists ratings_select_own_or_revealed on public.ratings;
create policy ratings_select_own_or_revealed on public.ratings
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
        from public.options o
        join public.decisions d on d.id = o.decision_id
       where o.id = ratings.option_id
         and public.is_trip_member(d.trip_id, auth.uid())
         and d.status in ('revealed', 'decided')
    )
  );

drop policy if exists ratings_write_own on public.ratings;
create policy ratings_write_own on public.ratings
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.options o
      join public.decisions d on d.id = o.decision_id
      where o.id = ratings.option_id
        and public.is_trip_member(d.trip_id, auth.uid())
    )
  );

drop policy if exists ratings_update_own on public.ratings;
create policy ratings_update_own on public.ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ratings_delete_own on public.ratings;
create policy ratings_delete_own on public.ratings
  for delete to authenticated
  using (user_id = auth.uid());
