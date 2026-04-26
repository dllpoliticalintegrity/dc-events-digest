-- supabase/migrations/20260426120200_create_event_tags.sql
create table if not exists public.event_tags (
  event_id uuid not null references public.events(id) on delete cascade,
  tag_slug text not null references public.tags(slug),
  primary key (event_id, tag_slug)
);

create index if not exists event_tags_tag_slug_idx on public.event_tags (tag_slug);

alter table public.event_tags enable row level security;

drop policy if exists "anon read event_tags" on public.event_tags;
create policy "anon read event_tags" on public.event_tags
  for select using (true);
