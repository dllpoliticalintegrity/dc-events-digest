-- supabase/migrations/20260426120100_create_events.sql
create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  start_at            timestamptz not null,
  end_at              timestamptz,
  is_all_day          boolean not null default false,
  type                text not null check (type in ('music','food','arts','outdoors','civic','community')),
  venue_name          text,
  venue_address       text,
  neighborhood        text,
  url                 text,
  source              text not null,
  source_external_id  text not null,
  cost_text           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (source, source_external_id)
);

create index if not exists events_start_at_idx on public.events (start_at);
create index if not exists events_type_idx     on public.events (type);

alter table public.events enable row level security;

drop policy if exists "anon read events" on public.events;
create policy "anon read events" on public.events
  for select using (true);

-- service_role bypasses RLS automatically; no policy needed for writes
