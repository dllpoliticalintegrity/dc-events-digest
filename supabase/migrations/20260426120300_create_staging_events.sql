-- supabase/migrations/20260426120300_create_staging_events.sql
create table if not exists public.staging_events (
  id                 uuid primary key default gen_random_uuid(),
  source             text not null,
  external_id        text not null,
  raw_payload        jsonb not null,
  extracted_at       timestamptz not null default now(),
  status             text not null default 'pending'
                       check (status in ('pending','approved','rejected','duplicate')),
  reject_reason      text,
  promoted_event_id  uuid references public.events(id),
  unique (source, external_id)
);

create index if not exists staging_events_status_idx on public.staging_events (status);
create index if not exists staging_events_source_idx on public.staging_events (source);

alter table public.staging_events enable row level security;
-- NO anon policy. service_role bypasses RLS, so writes still work from ingestion.
