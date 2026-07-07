-- Day-scope decisions so the plan can be structured as a chunk of
-- multiple-choice questions per day (morning / afternoon / evening).
-- A NULL day_index means the decision is trip-wide (hotel, flight
-- class) and behaves like before — backwards-compatible.
--
-- Also add `slot` (morning/afternoon/evening/any) so day-scoped
-- decisions can render inside the plan's existing slot ordering.

alter table public.decisions
  add column if not exists day_index integer
    check (day_index is null or (day_index >= 0 and day_index <= 60));

alter table public.decisions
  add column if not exists slot text
    check (slot is null or slot in ('morning','afternoon','evening','any'));

-- Efficient lookup: "give me every day-scoped decision on this trip"
-- gets used for every render of the plan page.
create index if not exists decisions_trip_day_idx
  on public.decisions(trip_id, day_index)
  where day_index is not null;
