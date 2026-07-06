-- Create a `create_trip` RPC so trip creation runs through a
-- security-definer function that derives auth.uid() server-side.
--
-- Fixes: "new row violates row-level security policy for table 'trips'"
-- Root cause options this bypasses in one shot:
--   1. JWT not reaching Postgres for the raw REST INSERT (auth.uid() null)
--   2. Client-side user.id ≠ server-side auth.uid() (shouldn't happen but
--      the previous flow assumed it)
--   3. RLS policy evaluation order weirdness with the on_trip_created
--      trigger's cross-table write
--
-- Also grants execute to `authenticated` explicitly.

create or replace function public.create_trip(
  p_name        text,
  p_destination text default null,
  p_start_date  date default null,
  p_end_date    date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated'
      using errcode = '42501', hint = 'session missing on server';
  end if;

  if p_name is null or length(trim(p_name)) < 1 or length(p_name) > 120 then
    raise exception 'trip name must be 1-120 characters'
      using errcode = '22023';
  end if;

  if p_destination is not null and length(p_destination) > 120 then
    raise exception 'destination must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if p_start_date is not null
     and p_end_date is not null
     and p_start_date > p_end_date then
    raise exception 'end date cannot be before start date'
      using errcode = '22023';
  end if;

  insert into public.trips (name, destination, start_date, end_date, created_by)
  values (p_name, p_destination, p_start_date, p_end_date, v_user)
  returning id into v_trip_id;

  return v_trip_id;
end;
$$;

revoke all on function public.create_trip(text, text, date, date) from public;
grant execute on function public.create_trip(text, text, date, date) to authenticated;
