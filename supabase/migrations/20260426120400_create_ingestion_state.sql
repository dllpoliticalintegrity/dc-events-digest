-- supabase/migrations/20260426120400_create_ingestion_state.sql
create table if not exists public.ingestion_state (
  source       text primary key,
  last_run_at  timestamptz,
  last_cursor  text,
  last_status  text check (last_status in ('ok','failed')),
  last_error   text
);

alter table public.ingestion_state enable row level security;
-- NO anon policy.
