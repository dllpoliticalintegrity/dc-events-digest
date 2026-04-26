-- supabase/migrations/20260426120500_promote_pending_events.sql
create extension if not exists pg_trgm;

create or replace function public.promote_pending_events(p_source text default null)
returns table (
  source        text,
  staged        int,
  approved      int,
  rejected      int,
  reasons       jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source            text;
  v_staged            int;
  v_approved          int;
  v_rejected          int;
  v_reasons           jsonb;
begin
  for v_source in
    select distinct se.source
    from staging_events se
    where se.status = 'pending'
      and (p_source is null or se.source = p_source)
  loop
    -- 1) Mark rejects with a single UPDATE that picks the first matching reason
    update staging_events se
    set status = 'rejected',
        reject_reason = case
          when (se.raw_payload->>'title') is null
               or btrim(se.raw_payload->>'title') = ''
               or (se.raw_payload->>'start_at') is null then 'missing_required'
          when (se.raw_payload->>'start_at')::timestamptz < (now() - interval '1 day') then 'past_date'
          when (se.raw_payload->>'start_at')::timestamptz > (now() + interval '2 years') then 'bad_datetime'
          when (se.raw_payload->>'title') ~* '\m(open call|submissions?|now hiring|applications open)\M' then 'editorial_mention'
          when (se.raw_payload->>'confidence') is not null
               and (se.raw_payload->>'confidence')::numeric < 0.7 then 'low_confidence'
        end
    where se.source = v_source
      and se.status = 'pending'
      and (
        (se.raw_payload->>'title') is null
        or btrim(se.raw_payload->>'title') = ''
        or (se.raw_payload->>'start_at') is null
        or (se.raw_payload->>'start_at')::timestamptz < (now() - interval '1 day')
        or (se.raw_payload->>'start_at')::timestamptz > (now() + interval '2 years')
        or (se.raw_payload->>'title') ~* '\m(open call|submissions?|now hiring|applications open)\M'
        or (
          (se.raw_payload->>'confidence') is not null
          and (se.raw_payload->>'confidence')::numeric < 0.7
        )
      );

    -- 2) Mark fuzzy duplicates (same source, same date, similar title >= 0.7)
    update staging_events se
    set status = 'duplicate',
        reject_reason = 'duplicate'
    where se.source = v_source
      and se.status = 'pending'
      and exists (
        select 1
        from events e
        where e.source = se.source
          and date(e.start_at) = date((se.raw_payload->>'start_at')::timestamptz)
          and similarity(e.title, se.raw_payload->>'title') >= 0.7
      );

    -- 3) Promote remaining pending rows to events (idempotent upsert)
    with promoted as (
      insert into events (
        title, description, start_at, end_at, is_all_day, type,
        venue_name, venue_address, neighborhood, url, source,
        source_external_id, cost_text, updated_at
      )
      select
        se.raw_payload->>'title',
        se.raw_payload->>'description',
        (se.raw_payload->>'start_at')::timestamptz,
        nullif(se.raw_payload->>'end_at','')::timestamptz,
        coalesce((se.raw_payload->>'is_all_day')::bool, false),
        se.raw_payload->>'type',
        se.raw_payload->>'venue_name',
        se.raw_payload->>'venue_address',
        se.raw_payload->>'neighborhood',
        se.raw_payload->>'url',
        se.source,
        se.external_id,
        se.raw_payload->>'cost_text',
        now()
      from staging_events se
      where se.source = v_source
        and se.status = 'pending'
      on conflict on constraint events_source_source_external_id_key do update
        set title         = excluded.title,
            description   = excluded.description,
            start_at      = excluded.start_at,
            end_at        = excluded.end_at,
            is_all_day    = excluded.is_all_day,
            type          = excluded.type,
            venue_name    = excluded.venue_name,
            venue_address = excluded.venue_address,
            neighborhood  = excluded.neighborhood,
            url           = excluded.url,
            cost_text     = excluded.cost_text,
            updated_at    = now()
      returning id, source_external_id as ev_ext_id
    )
    update staging_events se
    set status = 'approved',
        promoted_event_id = p.id
    from promoted p
    where se.source = v_source
      and se.external_id = p.ev_ext_id;

    -- 4) Wire event_tags from raw_payload->'tags'
    insert into event_tags (event_id, tag_slug)
    select se.promoted_event_id, jsonb_array_elements_text(se.raw_payload->'tags')
    from staging_events se
    where se.source = v_source
      and se.status = 'approved'
      and se.promoted_event_id is not null
      and jsonb_typeof(se.raw_payload->'tags') = 'array'
    on conflict do nothing;

    -- 5) Tally for return
    select count(*) into v_staged
      from staging_events s5 where s5.source = v_source;
    select count(*) into v_approved
      from staging_events s5 where s5.source = v_source and s5.status = 'approved';
    select count(*) into v_rejected
      from staging_events s5 where s5.source = v_source and s5.status in ('rejected','duplicate');
    select coalesce(jsonb_object_agg(t.reject_reason, t.n), '{}'::jsonb) into v_reasons
      from (
        select s5.reject_reason, count(*)::int n
        from staging_events s5
        where s5.source = v_source and s5.reject_reason is not null
        group by s5.reject_reason
      ) t;

    source := v_source;
    staged := v_staged;
    approved := v_approved;
    rejected := v_rejected;
    reasons := v_reasons;
    return next;
  end loop;
end;
$$;

revoke all on function public.promote_pending_events(text) from public, anon;
grant execute on function public.promote_pending_events(text) to service_role;
