-- Itinerary items — day-by-day plan for a trip.
-- Run in Supabase SQL Editor once. Idempotent on first apply.

create table if not exists public.itinerary_items (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  day_index     integer not null check (day_index >= 0 and day_index <= 60),
  slot          text not null check (slot in ('morning','afternoon','evening','any')),
  position      integer not null default 0,
  title         text not null check (length(title) between 1 and 200),
  place_id      text,
  option_id     uuid references public.options(id) on delete set null,
  address       text,
  coords_lat    double precision,
  coords_lng    double precision,
  starts_at     timestamptz,
  ends_at       timestamptz,
  notes         text,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now()
);

create index if not exists itinerary_items_trip_day_idx
  on public.itinerary_items(trip_id, day_index, slot, position);

alter table public.itinerary_items enable row level security;

drop policy if exists itinerary_select_members on public.itinerary_items;
create policy itinerary_select_members on public.itinerary_items
  for select to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists itinerary_insert_members on public.itinerary_items;
create policy itinerary_insert_members on public.itinerary_items
  for insert to authenticated
  with check (
    public.is_trip_member(trip_id, auth.uid())
    and created_by = auth.uid()
  );

drop policy if exists itinerary_update_members on public.itinerary_items;
create policy itinerary_update_members on public.itinerary_items
  for update to authenticated
  using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists itinerary_delete_members on public.itinerary_items;
create policy itinerary_delete_members on public.itinerary_items
  for delete to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));
