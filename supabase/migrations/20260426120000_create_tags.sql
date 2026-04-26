-- supabase/migrations/20260426120000_create_tags.sql
create table if not exists public.tags (
  slug  text primary key,
  label text not null
);

alter table public.tags enable row level security;

drop policy if exists "anon read tags" on public.tags;
create policy "anon read tags" on public.tags
  for select using (true);

insert into public.tags (slug, label) values
  ('free',        'Free'),
  ('ticketed',    'Ticketed'),
  ('outdoor',     'Outdoor'),
  ('21+',         '21+'),
  ('family',      'Family'),
  ('accessible',  'Accessible'),
  ('weekend',     'Weekend'),
  ('happy-hour',  'Happy Hour')
on conflict (slug) do update set label = excluded.label;
