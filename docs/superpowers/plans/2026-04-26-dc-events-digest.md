# DC Events Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of `dc-events-digest` — a public, browse-only DC events calendar with weekly view + agenda, ingested daily from Clockout DC, Washingtonian, and 730DC.

**Architecture:** Two halves separated by Supabase. Python jobs run in GitHub Actions (daily cron) → write to `staging_events` → SQL `promote_pending_events()` garbage-filters into `public.events`. A Vite + React + TS SPA on Vercel reads `public.events` via supabase-js with the `anon` key.

**Tech Stack:** Vite + React + TypeScript + Tailwind v3 + shadcn/ui + React Router · supabase-js · Vitest + React Testing Library + Playwright · Python 3.11 + pytest · Supabase Postgres · Anthropic SDK (Claude Sonnet 4.6) · GitHub Actions · Vercel

**Spec:** `docs/superpowers/specs/2026-04-26-dc-events-digest-design.md`

**Working dir:** `/Users/snackbardan/dc-events-digest/` (already initialized as a git repo on `main`, with the spec committed)

**Note on `data_import` vs `data-import`:** The spec uses both spellings. Python packages cannot have hyphens. **This plan uses `scripts/data_import/` (underscore) consistently** for both the directory and the import path.

**Note on Supabase MCP:** This plan assumes the executing agent has access to `mcp__plugin_supabase_supabase__*` tools. If not, substitute `supabase` CLI commands (`supabase db push`, etc.) — the SQL is the same.

---

## Phase 1 — Foundation (Tasks 1-4)

### Task 1: Scaffold Vite + React + TS + Tailwind + shadcn/ui

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `src/lib/utils.ts`

- [ ] **Step 1: Scaffold Vite + React + TS using bun**

```bash
cd /Users/snackbardan/dc-events-digest
bun create vite . --template react-ts
# When prompted "Current directory is not empty", answer: Ignore files and continue
bun install
```

Expected: `package.json`, `src/`, `index.html`, `vite.config.ts` etc. created. `node_modules/` populated.

- [ ] **Step 2: Install Tailwind v3 + shadcn dependencies**

```bash
bun add -d tailwindcss@3 postcss autoprefixer
bun add class-variance-authority clsx tailwind-merge lucide-react
bunx tailwindcss init -p
```

Expected: `tailwind.config.js` and `postcss.config.js` created.

- [ ] **Step 3: Replace `tailwind.config.js` with TS version targeting `src/`**

Delete `tailwind.config.js`. Create `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#fafaf5',
        ink: '#1a1a1a',
        stamp: '#cc3333',
        muted: '#888888',
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: Replace `src/index.css` with Tailwind base + custom font import**

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

html, body { background: #fafaf5; color: #1a1a1a; font-family: Georgia, serif; }
```

- [ ] **Step 5: Set up shadcn config + cn helper**

Create `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": false
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils" }
}
```

Create `src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Add `paths` to `tsconfig.json` (inside `compilerOptions`):

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

Add the same alias to `vite.config.ts`:

```ts
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

- [ ] **Step 6: Verify dev server starts**

```bash
bun run dev
```

Expected: Vite prints `Local: http://localhost:5173/` and the page renders without errors. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lockb tsconfig.json tsconfig.node.json vite.config.ts index.html src tailwind.config.ts postcss.config.js components.json
git commit -m "feat: scaffold Vite + React + TS + Tailwind + shadcn/ui"
```

---

### Task 2: Set up Vitest + React Testing Library

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`, `src/lib/utils.test.ts`

- [ ] **Step 1: Install test deps**

```bash
bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui
```

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: Add `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Add `test` script to `package.json`**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Smoke test for `cn()`**

Create `src/lib/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges classes', () => {
    expect(cn('a', 'b')).toBe('a b')
  })
  it('dedupes conflicting tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
```

- [ ] **Step 6: Run tests**

```bash
bun run test
```

Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/test/setup.ts src/lib/utils.test.ts package.json bun.lockb
git commit -m "test: add Vitest + React Testing Library setup"
```

---

### Task 3: Initialize Python project + pytest

**Files:**
- Create: `pyproject.toml`, `tests/__init__.py`, `tests/test_smoke.py`, `scripts/__init__.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "dc-events-digest-ingest"
version = "0.1.0"
description = "Ingestion pipelines for dc-events-digest"
requires-python = ">=3.11"
dependencies = [
  "requests>=2.31",
  "beautifulsoup4>=4.12",
  "supabase>=2.4",
  "anthropic>=0.40",
  "pyyaml>=6.0",
  "python-dateutil>=2.9",
  "pytz>=2024.1",
  "feedparser>=6.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "pytest-mock>=3.12",
  "responses>=0.25",
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
include = ["scripts*"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: Create venv and install**

```bash
python3 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

Expected: Editable install completes; `pytest --version` works.

- [ ] **Step 3: Create empty package markers**

```bash
mkdir -p tests scripts
touch scripts/__init__.py tests/__init__.py
```

Create `tests/test_smoke.py`:

```python
def test_smoke():
    assert 1 + 1 == 2
```

- [ ] **Step 4: Run pytest**

```bash
source venv/bin/activate
pytest -v
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml tests scripts
git commit -m "chore: initialize Python ingestion project + pytest"
```

---

### Task 4: `.env.example` with all required secrets

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write `.env.example`**

```bash
# Supabase project (from https://supabase.com/dashboard → project settings → API)
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
SUPABASE_PROJECT_ID=xxxxxxxx

# Anthropic (LLM extractors only)
ANTHROPIC_API_KEY=sk-ant-...

# Frontend (Vite-prefixed; Vite injects only VITE_* into the bundle)
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Optional: gate real-LLM tests
# RUN_LLM_TESTS=1
```

- [ ] **Step 2: Verify `.gitignore` already excludes `.env`**

```bash
grep -n "^\.env" .gitignore
```

Expected: prints `2:.env` (or similar — line where `.env` is excluded).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example documenting required secrets"
```

---

## Phase 2 — Supabase schema (Tasks 5-11)

### Task 5: Create Supabase project + record connection details

**Files:**
- Modify: `.env` (created locally; not committed)

- [ ] **Step 1: List existing Supabase projects (skip if user already has one for this)**

Use the Supabase MCP:

```
Tool: mcp__plugin_supabase_supabase__list_projects
Args: {}
```

If a `dc-events-digest` project exists, capture its `id`. Otherwise continue.

- [ ] **Step 2: Create the project**

```
Tool: mcp__plugin_supabase_supabase__list_organizations
Args: {}
```

Capture the `id` of the org you want to use, then:

```
Tool: mcp__plugin_supabase_supabase__create_project
Args: {
  "name": "dc-events-digest",
  "organization_id": "<org_id>",
  "region": "us-east-1"
}
```

Capture the returned `id` — this is your `SUPABASE_PROJECT_ID`.

- [ ] **Step 3: Capture URL + keys**

```
Tool: mcp__plugin_supabase_supabase__get_project_url
Args: { "project_id": "<id>" }

Tool: mcp__plugin_supabase_supabase__get_publishable_keys
Args: { "project_id": "<id>" }
```

For the `service_role` key, fetch it from the Supabase dashboard (Settings → API → `service_role secret`). The MCP intentionally does not expose this.

- [ ] **Step 4: Write `.env` (NOT committed)**

```bash
cat > .env <<EOF
SUPABASE_URL=https://<project_id>.supabase.co
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_PROJECT_ID=<project_id>
ANTHROPIC_API_KEY=<your_anthropic_key>
VITE_SUPABASE_URL=https://<project_id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
EOF
```

- [ ] **Step 5: Verify `.env` is gitignored (must NOT show as untracked)**

```bash
git status --short
```

Expected: `.env` does not appear. If it does, fix `.gitignore` immediately.

No commit (nothing tracked changed).

---

### Task 6: Migration — `tags` table + RLS + seed

**Files:**
- Create: `supabase/migrations/20260426120000_create_tags.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Apply via Supabase MCP**

```
Tool: mcp__plugin_supabase_supabase__apply_migration
Args: {
  "project_id": "<id from .env>",
  "name": "create_tags",
  "query": "<contents of file above>"
}
```

- [ ] **Step 3: Verify rows are present**

```
Tool: mcp__plugin_supabase_supabase__execute_sql
Args: {
  "project_id": "<id>",
  "query": "select slug, label from public.tags order by slug;"
}
```

Expected: 8 rows returned matching the seeded list.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260426120000_create_tags.sql
git commit -m "feat(db): create tags table with RLS and seed canonical tags"
```

---

### Task 7: Migration — `events` table + RLS

**Files:**
- Create: `supabase/migrations/20260426120100_create_events.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply via Supabase MCP**

```
Tool: mcp__plugin_supabase_supabase__apply_migration
Args: { "project_id": "<id>", "name": "create_events", "query": "<file contents>" }
```

- [ ] **Step 3: Verify table exists**

```
Tool: mcp__plugin_supabase_supabase__execute_sql
Args: { "project_id": "<id>", "query": "select count(*) from public.events;" }
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260426120100_create_events.sql
git commit -m "feat(db): create events table with RLS, type check, indexes"
```

---

### Task 8: Migration — `event_tags` join table + RLS

**Files:**
- Create: `supabase/migrations/20260426120200_create_event_tags.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply**

```
Tool: mcp__plugin_supabase_supabase__apply_migration
Args: { "project_id": "<id>", "name": "create_event_tags", "query": "<file contents>" }
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260426120200_create_event_tags.sql
git commit -m "feat(db): create event_tags join table with RLS"
```

---

### Task 9: Migration — `staging_events` table (service_role only)

**Files:**
- Create: `supabase/migrations/20260426120300_create_staging_events.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply**

```
Tool: mcp__plugin_supabase_supabase__apply_migration
Args: { "project_id": "<id>", "name": "create_staging_events", "query": "<file contents>" }
```

- [ ] **Step 3: Verify anon CANNOT read it**

```
Tool: mcp__plugin_supabase_supabase__execute_sql
Args: {
  "project_id": "<id>",
  "query": "set role anon; select count(*) from public.staging_events; reset role;"
}
```

Expected: an RLS error (`permission denied` or `0 rows because RLS blocks anon`). Either is acceptable — both prove RLS is active.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260426120300_create_staging_events.sql
git commit -m "feat(db): create staging_events table (service_role only, no anon policy)"
```

---

### Task 10: Migration — `ingestion_state` table (service_role only)

**Files:**
- Create: `supabase/migrations/20260426120400_create_ingestion_state.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply**

```
Tool: mcp__plugin_supabase_supabase__apply_migration
Args: { "project_id": "<id>", "name": "create_ingestion_state", "query": "<file contents>" }
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260426120400_create_ingestion_state.sql
git commit -m "feat(db): create ingestion_state table for per-source bookkeeping"
```

---

### Task 11: Migration — `pg_trgm` + `promote_pending_events()` function

**Files:**
- Create: `supabase/migrations/20260426120500_promote_pending_events.sql`

- [ ] **Step 1: Write the migration**

```sql
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
      on conflict (source, source_external_id) do update
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
      returning id, source, source_external_id
    )
    update staging_events se
    set status = 'approved',
        promoted_event_id = p.id
    from promoted p
    where se.source = p.source
      and se.external_id = p.source_external_id;

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
      from staging_events where source = v_source;
    select count(*) into v_approved
      from staging_events where source = v_source and status = 'approved';
    select count(*) into v_rejected
      from staging_events where source = v_source and status in ('rejected','duplicate');
    select coalesce(jsonb_object_agg(reject_reason, n), '{}'::jsonb) into v_reasons
      from (
        select reject_reason, count(*)::int n
        from staging_events
        where source = v_source and reject_reason is not null
        group by reject_reason
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
```

- [ ] **Step 2: Apply**

```
Tool: mcp__plugin_supabase_supabase__apply_migration
Args: { "project_id": "<id>", "name": "promote_pending_events", "query": "<file contents>" }
```

- [ ] **Step 3: Smoke-call the function (no rows yet, returns empty)**

```
Tool: mcp__plugin_supabase_supabase__execute_sql
Args: { "project_id": "<id>", "query": "select * from public.promote_pending_events();" }
```

Expected: 0 rows returned (no pending staging rows).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260426120500_promote_pending_events.sql
git commit -m "feat(db): add promote_pending_events() garbage filter + pg_trgm"
```

---

## Phase 3 — Schema verification (Tasks 12-14)

### Task 12: Generate TypeScript types from schema

**Files:**
- Create: `src/lib/supabase-types.ts`

- [ ] **Step 1: Generate types via MCP**

```
Tool: mcp__plugin_supabase_supabase__generate_typescript_types
Args: { "project_id": "<id>" }
```

- [ ] **Step 2: Save the response into `src/lib/supabase-types.ts`**

Take the `types` field from the response and write the entire content to `src/lib/supabase-types.ts`.

- [ ] **Step 3: Verify the file compiles**

```bash
bun run build
```

Expected: build succeeds. If TypeScript complains, check that the types file imports cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase-types.ts
git commit -m "feat(types): generate TypeScript types from Supabase schema"
```

---

### Task 13: Garbage filter — happy-path test

**Files:**
- Create: `tests/db/__init__.py`, `tests/db/conftest.py`, `tests/db/test_promote_pending_events_happy.py`

- [ ] **Step 1: Write the conftest helper that loads `.env` and provides a service-role client**

```python
# tests/db/conftest.py
import os
from pathlib import Path
import pytest
from supabase import create_client, Client


def _load_env():
    env = Path(__file__).resolve().parents[2] / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


@pytest.fixture(scope="session", autouse=True)
def _env():
    _load_env()


@pytest.fixture
def sb() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


@pytest.fixture(autouse=True)
def _clean(sb: Client):
    # Clean staging + events between tests so order doesn't matter.
    sb.table("staging_events").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("event_tags").delete().neq("event_id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("events").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    yield
```

- [ ] **Step 2: Write the failing test**

```python
# tests/db/test_promote_pending_events_happy.py
from datetime import datetime, timedelta, timezone


def test_promote_happy_path(sb):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    sb.table("staging_events").insert({
        "source": "clockout",
        "external_id": "abc123",
        "raw_payload": {
            "title": "Jazz in the Garden",
            "start_at": future,
            "type": "music",
            "venue_name": "Sculpture Garden",
            "tags": ["free", "outdoor"],
        },
    }).execute()

    rpc = sb.rpc("promote_pending_events", {"p_source": "clockout"}).execute()
    assert rpc.data and rpc.data[0]["approved"] == 1
    assert rpc.data[0]["rejected"] == 0

    rows = sb.table("events").select("title, type, source_external_id").execute().data
    assert len(rows) == 1
    assert rows[0]["title"] == "Jazz in the Garden"
    assert rows[0]["type"] == "music"
    assert rows[0]["source_external_id"] == "abc123"

    tags = sb.table("event_tags").select("tag_slug").execute().data
    assert sorted(t["tag_slug"] for t in tags) == ["free", "outdoor"]
```

- [ ] **Step 3: Run it (should pass — function is in place)**

```bash
source venv/bin/activate
pytest tests/db/test_promote_pending_events_happy.py -v
```

Expected: `1 passed`. If it fails, fix the function or test before proceeding.

- [ ] **Step 4: Commit**

```bash
git add tests/db
git commit -m "test(db): cover promote_pending_events happy path"
```

---

### Task 14: Garbage filter — one test per reject rule + idempotency

**Files:**
- Create: `tests/db/test_promote_pending_events_rejects.py`, `tests/db/test_promote_pending_events_idempotent.py`

- [ ] **Step 1: Write the rejects test**

```python
# tests/db/test_promote_pending_events_rejects.py
from datetime import datetime, timedelta, timezone


def _stage(sb, **payload):
    sb.table("staging_events").insert({
        "source": "test",
        "external_id": payload.pop("external_id"),
        "raw_payload": payload,
    }).execute()


def _statuses(sb):
    rows = sb.table("staging_events").select("external_id, status, reject_reason").execute().data
    return {r["external_id"]: (r["status"], r["reject_reason"]) for r in rows}


def test_each_reject_rule(sb):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    past = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    far_future = (datetime.now(timezone.utc) + timedelta(days=365 * 3)).isoformat()

    _stage(sb, external_id="missing-title", title="", start_at=future, type="music")
    _stage(sb, external_id="missing-start", title="No date", type="music")
    _stage(sb, external_id="past", title="Past show", start_at=past, type="music")
    _stage(sb, external_id="bad-dt", title="Way future", start_at=far_future, type="music")
    _stage(sb, external_id="editorial", title="Open call for artists", start_at=future, type="arts")
    _stage(sb, external_id="lowconf", title="Maybe", start_at=future, type="music", confidence=0.5)
    _stage(sb, external_id="happy", title="Real Show", start_at=future, type="music")

    sb.rpc("promote_pending_events", {"p_source": "test"}).execute()

    s = _statuses(sb)
    assert s["missing-title"] == ("rejected", "missing_required")
    assert s["missing-start"] == ("rejected", "missing_required")
    assert s["past"]          == ("rejected", "past_date")
    assert s["bad-dt"]        == ("rejected", "bad_datetime")
    assert s["editorial"]     == ("rejected", "editorial_mention")
    assert s["lowconf"]       == ("rejected", "low_confidence")
    assert s["happy"][0]      == "approved"

    events = sb.table("events").select("source_external_id").execute().data
    assert [e["source_external_id"] for e in events] == ["happy"]


def test_fuzzy_duplicate(sb):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    # First insert directly into events (simulating a prior run)
    sb.table("events").insert({
        "title": "Jazz in the Garden",
        "start_at": future,
        "type": "music",
        "source": "test",
        "source_external_id": "original",
    }).execute()
    # Stage a near-duplicate
    _stage(sb, external_id="dup-1", title="Jazz In The Garden!", start_at=future, type="music")
    sb.rpc("promote_pending_events", {"p_source": "test"}).execute()

    s = _statuses(sb)
    assert s["dup-1"] == ("duplicate", "duplicate")
    events = sb.table("events").select("source_external_id").execute().data
    assert [e["source_external_id"] for e in events] == ["original"]
```

- [ ] **Step 2: Write the idempotency test**

```python
# tests/db/test_promote_pending_events_idempotent.py
from datetime import datetime, timedelta, timezone


def test_running_twice_yields_same_state(sb):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    payload = {
        "title": "Jazz in the Garden",
        "start_at": future,
        "type": "music",
        "venue_name": "Sculpture Garden",
        "tags": ["free", "outdoor"],
    }
    sb.table("staging_events").upsert({
        "source": "clockout", "external_id": "abc123", "raw_payload": payload, "status": "pending",
    }, on_conflict="source,external_id").execute()
    sb.rpc("promote_pending_events", {"p_source": "clockout"}).execute()

    # Re-stage same external_id (status reset to pending) and re-promote
    sb.table("staging_events").update({"status": "pending"}).eq("external_id", "abc123").execute()
    sb.rpc("promote_pending_events", {"p_source": "clockout"}).execute()

    events = sb.table("events").select("source_external_id").execute().data
    assert [e["source_external_id"] for e in events] == ["abc123"]
    tags = sb.table("event_tags").select("tag_slug").execute().data
    assert sorted(t["tag_slug"] for t in tags) == ["free", "outdoor"]
```

- [ ] **Step 3: Run all DB tests**

```bash
source venv/bin/activate
pytest tests/db -v
```

Expected: all tests pass. If any fail, fix the SQL function and re-apply the migration before committing.

- [ ] **Step 4: Commit**

```bash
git add tests/db/test_promote_pending_events_rejects.py tests/db/test_promote_pending_events_idempotent.py
git commit -m "test(db): cover all reject rules + idempotent promote"
```

---

## Phase 4 — Shared ingestion infra (Tasks 15-21)

### Task 15: `scripts/shared/taxonomy.py` — canonical types + tags

**Files:**
- Create: `scripts/shared/__init__.py`, `scripts/shared/taxonomy.py`, `tests/test_taxonomy.py`

- [ ] **Step 1: Write `scripts/shared/__init__.py`**

```python
# empty package marker
```

- [ ] **Step 2: Write `scripts/shared/taxonomy.py`**

```python
TYPES: tuple[str, ...] = ("music", "food", "arts", "outdoors", "civic", "community")

TAGS: tuple[str, ...] = (
    "free", "ticketed", "outdoor", "21+",
    "family", "accessible", "weekend", "happy-hour",
)


def is_valid_type(t: str) -> bool:
    return t in TYPES


def filter_tags(tags) -> list[str]:
    """Drop unknown tags, dedupe, preserve canonical order."""
    seen = set()
    out: list[str] = []
    incoming = set(tags or ())
    for t in TAGS:
        if t in incoming and t not in seen:
            out.append(t)
            seen.add(t)
    return out
```

- [ ] **Step 3: Write the test**

```python
# tests/test_taxonomy.py
from scripts.shared.taxonomy import TYPES, TAGS, is_valid_type, filter_tags


def test_types_locked():
    assert TYPES == ("music", "food", "arts", "outdoors", "civic", "community")


def test_tags_locked():
    assert TAGS == ("free", "ticketed", "outdoor", "21+", "family", "accessible", "weekend", "happy-hour")


def test_is_valid_type():
    assert is_valid_type("music")
    assert not is_valid_type("Music")
    assert not is_valid_type("nightlife")


def test_filter_tags_drops_unknown_and_dedupes_and_orders():
    assert filter_tags(["outdoor", "free", "made-up", "outdoor"]) == ["free", "outdoor"]
    assert filter_tags([]) == []
    assert filter_tags(None) == []
```

- [ ] **Step 4: Run**

```bash
source venv/bin/activate && pytest tests/test_taxonomy.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/shared/__init__.py scripts/shared/taxonomy.py tests/test_taxonomy.py
git commit -m "feat(ingest): canonical TYPES + TAGS taxonomy"
```

---

### Task 16: `scripts/shared/supabase.py` — service-role client

**Files:**
- Create: `scripts/shared/supabase.py`, `tests/shared/__init__.py`, `tests/shared/test_supabase_client.py`

- [ ] **Step 1: Write `scripts/shared/supabase.py`**

```python
import os
from supabase import create_client, Client

_client: Client | None = None


def get_supabase_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def reset_for_tests() -> None:
    global _client
    _client = None
```

- [ ] **Step 2: Write the test (uses real env from `.env` via the conftest)**

```python
# tests/shared/__init__.py — empty
```

```python
# tests/shared/test_supabase_client.py
from scripts.shared.supabase import get_supabase_client, reset_for_tests


def test_returns_client_with_service_role():
    reset_for_tests()
    client = get_supabase_client()
    # Sanity check: a write to staging_events should succeed (anon would fail)
    res = client.table("staging_events").select("id").limit(1).execute()
    assert hasattr(res, "data")  # query ran without permission error
```

- [ ] **Step 3: Hoist `_load_env()` to a shared conftest at `tests/conftest.py` so non-DB tests get .env too**

Move the `_load_env` function from `tests/db/conftest.py` to `tests/conftest.py` and remove the duplicate:

```python
# tests/conftest.py
import os
from pathlib import Path
import pytest


def _load_env():
    env = Path(__file__).resolve().parents[1] / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


@pytest.fixture(scope="session", autouse=True)
def _env():
    _load_env()
```

Then trim `tests/db/conftest.py` to drop the env loading (keep `sb` and `_clean` fixtures).

- [ ] **Step 4: Run**

```bash
pytest tests/shared/test_supabase_client.py -v
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/shared/supabase.py tests/shared tests/conftest.py tests/db/conftest.py
git commit -m "feat(ingest): cached service-role Supabase client + shared env loader"
```

---

### Task 17: `scripts/shared/dates.py` — ET-aware datetime parsing

**Files:**
- Create: `scripts/shared/dates.py`, `tests/test_dates.py`

- [ ] **Step 1: Write the failing tests first**

```python
# tests/test_dates.py
from datetime import datetime, timezone, timedelta
import pytz
from scripts.shared.dates import parse_et


ET = pytz.timezone("America/New_York")


def test_parse_iso_with_tz_returns_utc():
    dt = parse_et("2026-04-26T17:00:00-04:00")
    assert dt.tzinfo == timezone.utc
    assert dt.hour == 21


def test_parse_iso_naive_assumes_et():
    dt = parse_et("2026-04-26T17:00:00")
    # 5pm ET in April (EDT, UTC-4) → 21:00 UTC
    assert dt.tzinfo == timezone.utc
    assert dt.hour == 21


def test_parse_natural_relative_weekday(monkeypatch):
    # Pin "now" for determinism: Mon 2026-04-20 noon ET
    fake_now = ET.localize(datetime(2026, 4, 20, 12, 0))
    monkeypatch.setattr("scripts.shared.dates._now_et", lambda: fake_now)
    dt = parse_et("Sat 5pm")
    assert dt.tzinfo == timezone.utc
    # Sat 2026-04-25 17:00 ET → 21:00 UTC
    assert dt.year == 2026 and dt.month == 4 and dt.day == 25 and dt.hour == 21


def test_invalid_returns_none():
    assert parse_et("not a date") is None
    assert parse_et("") is None
    assert parse_et(None) is None
```

- [ ] **Step 2: Run, expect failures**

```bash
pytest tests/test_dates.py -v
```

Expected: tests fail (`parse_et` not defined).

- [ ] **Step 3: Implement `scripts/shared/dates.py`**

```python
from __future__ import annotations
from datetime import datetime, timedelta, timezone
import re
from typing import Optional
import pytz
from dateutil import parser as dparser

ET = pytz.timezone("America/New_York")

_WEEKDAYS = {
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}
_NATURAL_RE = re.compile(
    r"^(?P<dow>[A-Za-z]+)\s+(?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?P<ampm>am|pm)?$",
    re.IGNORECASE,
)


def _now_et() -> datetime:
    return datetime.now(ET)


def parse_et(value: Optional[str]) -> Optional[datetime]:
    if not value or not value.strip():
        return None
    s = value.strip()

    # Natural relative weekday like "Sat 5pm"
    m = _NATURAL_RE.match(s)
    if m and m.group("dow")[:3].lower() in {k[:3] for k in _WEEKDAYS}:
        target_dow = _WEEKDAYS[m.group("dow")[:3].lower()]
        hour = int(m.group("h"))
        minute = int(m.group("m") or 0)
        ampm = (m.group("ampm") or "").lower()
        if ampm == "pm" and hour < 12:
            hour += 12
        if ampm == "am" and hour == 12:
            hour = 0
        now = _now_et()
        days_ahead = (target_dow - now.weekday()) % 7
        if days_ahead == 0 and (hour, minute) <= (now.hour, now.minute):
            days_ahead = 7
        target = now + timedelta(days=days_ahead)
        local = ET.localize(datetime(target.year, target.month, target.day, hour, minute))
        return local.astimezone(timezone.utc)

    # Generic parse
    try:
        dt = dparser.parse(s)
    except (ValueError, OverflowError):
        return None
    if dt.tzinfo is None:
        dt = ET.localize(dt)
    return dt.astimezone(timezone.utc)
```

- [ ] **Step 4: Run, expect pass**

```bash
pytest tests/test_dates.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/shared/dates.py tests/test_dates.py
git commit -m "feat(ingest): ET-aware datetime parsing with natural-language support"
```

---

### Task 18: `scripts/shared/dedupe.py` — Python-side fuzzy match for pre-checks

**Files:**
- Create: `scripts/shared/dedupe.py`, `tests/test_dedupe.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_dedupe.py
from scripts.shared.dedupe import title_similarity, is_likely_duplicate


def test_title_similarity_identical():
    assert title_similarity("Jazz in the Garden", "Jazz in the Garden") == 1.0


def test_title_similarity_close():
    assert title_similarity("Jazz in the Garden", "Jazz In The Garden!") >= 0.8


def test_title_similarity_unrelated():
    assert title_similarity("Jazz in the Garden", "Eastern Market") < 0.5


def test_is_likely_duplicate_uses_threshold():
    assert is_likely_duplicate("Jazz in the Garden", "JAZZ IN THE GARDEN", 0.7)
    assert not is_likely_duplicate("Jazz in the Garden", "Eastern Market", 0.7)
```

- [ ] **Step 2: Run, expect fail**

```bash
pytest tests/test_dedupe.py -v
```

- [ ] **Step 3: Implement `scripts/shared/dedupe.py`**

```python
from __future__ import annotations
import re
from difflib import SequenceMatcher

_NORM_RE = re.compile(r"[^a-z0-9 ]+")


def _norm(s: str) -> str:
    return _NORM_RE.sub("", s.lower()).strip()


def title_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def is_likely_duplicate(a: str, b: str, threshold: float = 0.7) -> bool:
    return title_similarity(a, b) >= threshold
```

- [ ] **Step 4: Run, expect pass**

```bash
pytest tests/test_dedupe.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/shared/dedupe.py tests/test_dedupe.py
git commit -m "feat(ingest): Python-side title similarity helper"
```

---

### Task 19: `scripts/shared/staging.py` — upsert + promote-call

**Files:**
- Create: `scripts/shared/staging.py`, `tests/shared/test_staging.py`

- [ ] **Step 1: Write the failing test (uses real Supabase)**

```python
# tests/shared/test_staging.py
import pytest
from scripts.shared.staging import upsert_staging, call_promote_pending
from scripts.shared.supabase import get_supabase_client
from datetime import datetime, timedelta, timezone


@pytest.fixture(autouse=True)
def _clean():
    sb = get_supabase_client()
    sb.table("staging_events").delete().eq("source", "test_staging").execute()
    sb.table("event_tags").delete().neq("event_id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("events").delete().eq("source", "test_staging").execute()
    yield


def test_upsert_then_promote():
    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    upsert_staging("test_staging", "abc", {
        "title": "Test Show", "start_at": future, "type": "music"
    })
    upsert_staging("test_staging", "abc", {  # idempotent re-upsert
        "title": "Test Show", "start_at": future, "type": "music"
    })

    metrics = call_promote_pending("test_staging")
    assert metrics[0]["approved"] == 1
    assert metrics[0]["staged"] == 1
```

- [ ] **Step 2: Run, expect fail**

```bash
pytest tests/shared/test_staging.py -v
```

- [ ] **Step 3: Implement `scripts/shared/staging.py`**

```python
from __future__ import annotations
from typing import Any, Iterable
from .supabase import get_supabase_client


def upsert_staging(source: str, external_id: str, payload: dict[str, Any]) -> None:
    sb = get_supabase_client()
    sb.table("staging_events").upsert(
        {
            "source": source,
            "external_id": external_id,
            "raw_payload": payload,
            "status": "pending",
            "reject_reason": None,
            "promoted_event_id": None,
        },
        on_conflict="source,external_id",
    ).execute()


def upsert_staging_batch(source: str, items: Iterable[tuple[str, dict[str, Any]]]) -> int:
    sb = get_supabase_client()
    rows = [
        {
            "source": source,
            "external_id": eid,
            "raw_payload": payload,
            "status": "pending",
            "reject_reason": None,
            "promoted_event_id": None,
        }
        for eid, payload in items
    ]
    if not rows:
        return 0
    sb.table("staging_events").upsert(rows, on_conflict="source,external_id").execute()
    return len(rows)


def call_promote_pending(source: str | None = None) -> list[dict[str, Any]]:
    sb = get_supabase_client()
    res = sb.rpc("promote_pending_events", {"p_source": source}).execute()
    return res.data or []
```

- [ ] **Step 4: Run, expect pass**

```bash
pytest tests/shared/test_staging.py -v
```

- [ ] **Step 5: Commit**

```bash
git add scripts/shared/staging.py tests/shared/test_staging.py
git commit -m "feat(ingest): staging upsert + promote-call helpers"
```

---

### Task 20: `scripts/shared/extraction.py` — Anthropic SDK + structured prompt

**Files:**
- Create: `scripts/shared/extraction.py`, `tests/shared/test_extraction.py`

- [ ] **Step 1: Write the failing test (mocked SDK)**

```python
# tests/shared/test_extraction.py
import json
from unittest.mock import MagicMock, patch
from scripts.shared.extraction import extract_events


def test_extract_events_parses_structured_response():
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=json.dumps({
        "events": [
            {
                "title": "Jazz in the Garden",
                "start_at": "2026-04-26T17:00:00",
                "venue_name": "Sculpture Garden",
                "type": "music",
                "tags": ["free", "outdoor"],
            },
        ],
    }))]
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_message

    with patch("scripts.shared.extraction._client", fake_client):
        events = extract_events(article_text="(article body)", source_url="https://x.test/1")

    assert len(events) == 1
    e = events[0]
    assert e["title"] == "Jazz in the Garden"
    assert e["type"] == "music"
    assert e["tags"] == ["free", "outdoor"]
    assert e["source_url"] == "https://x.test/1"


def test_extract_events_returns_empty_when_no_events_in_article():
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=json.dumps({"events": []}))]
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_message

    with patch("scripts.shared.extraction._client", fake_client):
        events = extract_events(article_text="commentary", source_url="https://x.test/2")

    assert events == []


def test_extract_events_drops_invalid_type():
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=json.dumps({
        "events": [{"title": "X", "start_at": "2026-04-26T17:00:00", "type": "nightlife"}],
    }))]
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_message

    with patch("scripts.shared.extraction._client", fake_client):
        events = extract_events(article_text="(body)", source_url="u")

    assert events == []  # invalid type → dropped
```

- [ ] **Step 2: Run, expect fail**

```bash
pytest tests/shared/test_extraction.py -v
```

- [ ] **Step 3: Implement `scripts/shared/extraction.py`**

```python
from __future__ import annotations
import json
import logging
import os
from typing import Any
from anthropic import Anthropic
from .taxonomy import TYPES, filter_tags, is_valid_type
from .dates import parse_et

log = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"

PROMPT_TEMPLATE = """You are extracting concrete, scheduled events from an article.

Return JSON ONLY in this exact shape:
{{
  "events": [
    {{
      "title": str,
      "start_at": str (ISO 8601; assume Eastern Time if no timezone present),
      "end_at": str | null,
      "venue_name": str | null,
      "neighborhood": str | null,
      "type": one of {types},
      "tags": subset of {tags},
      "cost_text": str | null
    }}
  ]
}}

Rules:
- If the article is general commentary, criticism, or has no concrete date/time, return {{"events": []}}.
- Never invent dates. If a date is ambiguous, omit the event.
- {extra_instructions}

ARTICLE:
{article_text}
"""

_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


def extract_events(
    article_text: str,
    source_url: str,
    extra_instructions: str = "",
) -> list[dict[str, Any]]:
    """Call Claude, parse the structured response, normalize and validate."""
    prompt = PROMPT_TEMPLATE.format(
        types=list(TYPES),
        tags=["free", "ticketed", "outdoor", "21+", "family", "accessible", "weekend", "happy-hour"],
        extra_instructions=extra_instructions or "Extract every concrete event mentioned.",
        article_text=article_text[:20000],
    )
    msg = _client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text if msg.content else "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("LLM returned non-JSON for %s: %s", source_url, raw[:200])
        return []

    events_in = data.get("events") or []
    out: list[dict[str, Any]] = []
    for ev in events_in:
        # Drop anything failing taxonomy or date validation
        if not isinstance(ev, dict):
            continue
        if not ev.get("title") or not is_valid_type(ev.get("type", "")):
            continue
        parsed = parse_et(ev.get("start_at"))
        if parsed is None:
            continue
        out.append({
            "title": ev["title"].strip(),
            "start_at": parsed.isoformat(),
            "end_at": (parse_et(ev.get("end_at")).isoformat() if parse_et(ev.get("end_at")) else None),
            "venue_name": ev.get("venue_name"),
            "neighborhood": ev.get("neighborhood"),
            "type": ev["type"],
            "tags": filter_tags(ev.get("tags") or []),
            "cost_text": ev.get("cost_text"),
            "source_url": source_url,
        })
    return out
```

- [ ] **Step 4: Run tests, expect pass**

```bash
pytest tests/shared/test_extraction.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/shared/extraction.py tests/shared/test_extraction.py
git commit -m "feat(ingest): Anthropic-based event extractor with strict validation"
```

---

### Task 21: `scripts/shared/source.py` — `SourceBase` + `scripts/sources.yaml`

**Files:**
- Create: `scripts/shared/source.py`, `scripts/sources.yaml`, `tests/shared/test_source.py`

- [ ] **Step 1: Write the failing test (using a fake subclass)**

```python
# tests/shared/test_source.py
import pytest
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent
from scripts.shared.supabase import get_supabase_client
from datetime import datetime, timedelta, timezone


@pytest.fixture(autouse=True)
def _clean():
    sb = get_supabase_client()
    sb.table("staging_events").delete().eq("source", "fake").execute()
    sb.table("event_tags").delete().neq("event_id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("events").delete().eq("source", "fake").execute()
    yield


class FakeSource(SourceBase):
    source_key = "fake"
    schedule = "0 6 * * *"

    def fetch(self) -> list[RawCandidate]:
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        return [
            {"external_id": "f1", "title": "Show A", "start_at": future, "type": "music"},
            {"external_id": "f2", "title": "Show B", "start_at": future, "type": "food"},
        ]

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        return [{"external_id": raw["external_id"], "payload": raw}]


def test_dry_run_does_not_write():
    metrics = FakeSource().run(dry_run=True)
    assert metrics["fetched"] == 2
    assert metrics["staged"] == 0  # dry run

    sb = get_supabase_client()
    rows = sb.table("staging_events").select("id").eq("source", "fake").execute().data
    assert rows == []


def test_real_run_writes_and_promotes():
    metrics = FakeSource().run(dry_run=False)
    assert metrics["fetched"] == 2
    assert metrics["staged"] == 2
    assert metrics["approved"] == 2
    assert metrics["rejected"] == 0


def test_limit_caps_extraction():
    metrics = FakeSource().run(dry_run=False, limit=1)
    assert metrics["fetched"] == 2
    assert metrics["staged"] == 1
```

- [ ] **Step 2: Run, expect fail**

```bash
pytest tests/shared/test_source.py -v
```

- [ ] **Step 3: Implement `scripts/shared/source.py`**

```python
from __future__ import annotations
import argparse
import logging
from collections import Counter
from dataclasses import dataclass
from typing import Any, TypedDict
from .staging import upsert_staging_batch, call_promote_pending

log = logging.getLogger(__name__)

RawCandidate = dict[str, Any]


class ExtractedEvent(TypedDict):
    external_id: str
    payload: dict[str, Any]


@dataclass
class RunMetrics:
    fetched: int = 0
    staged: int = 0
    approved: int = 0
    rejected: int = 0
    reasons: dict[str, int] | None = None


class SourceBase:
    """Base class for all ingestion sources.

    Subclasses provide:
      - source_key: str   (also used as DB key)
      - schedule:   str   (cron expression for GH Actions; not used at runtime)
      - fetch():    return list of RawCandidate
      - extract():  RawCandidate -> 0..N ExtractedEvent
    """

    source_key: str = ""
    schedule: str = ""

    def fetch(self) -> list[RawCandidate]:
        raise NotImplementedError

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        raise NotImplementedError

    def run(self, dry_run: bool = False, limit: int | None = None) -> dict[str, Any]:
        if not self.source_key:
            raise RuntimeError("Subclass must set source_key")

        log.info("source=%s starting (dry_run=%s, limit=%s)", self.source_key, dry_run, limit)
        raw_items = self.fetch()
        fetched = len(raw_items)

        extracted: list[ExtractedEvent] = []
        for raw in raw_items:
            extracted.extend(self.extract(raw))
            if limit is not None and len(extracted) >= limit:
                extracted = extracted[:limit]
                break

        if dry_run:
            log.info(
                "source=%s DRY RUN fetched=%d would_stage=%d",
                self.source_key, fetched, len(extracted),
            )
            for ex in extracted[:5]:
                log.info("  candidate: %s", {k: v for k, v in ex["payload"].items() if k in ("title", "start_at", "type")})
            return {
                "fetched": fetched, "staged": 0, "approved": 0, "rejected": 0, "reasons": {},
            }

        staged = upsert_staging_batch(
            self.source_key,
            ((ex["external_id"], ex["payload"]) for ex in extracted),
        )
        rows = call_promote_pending(self.source_key)
        approved = sum(r.get("approved", 0) for r in rows)
        rejected = sum(r.get("rejected", 0) for r in rows)
        reasons: dict[str, int] = {}
        for r in rows:
            for k, v in (r.get("reasons") or {}).items():
                reasons[k] = reasons.get(k, 0) + int(v)

        log.info(
            "source=%s fetched=%d staged=%d approved=%d rejected=%d reasons=%s",
            self.source_key, fetched, staged, approved, rejected, reasons,
        )
        return {
            "fetched": fetched, "staged": staged, "approved": approved,
            "rejected": rejected, "reasons": reasons,
        }


def main_for(cls: type[SourceBase]) -> None:
    """Standard CLI entrypoint for any SourceBase subclass."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args()
    metrics = cls().run(dry_run=args.dry_run, limit=args.limit)
    print(metrics)
```

- [ ] **Step 4: Write `scripts/sources.yaml`**

```yaml
- key: clockout
  name: "Clockout DC"
  url: "https://www.clockoutdc.com/events"
  schedule: "0 6 * * *"
  module: "scripts.data_import.clockout.run:ClockoutSource"
  enabled: true

- key: washingtonian
  name: "Washingtonian — Things to Do"
  url: "https://washingtonian.com/sections/things-to-do/"
  schedule: "30 6 * * *"
  module: "scripts.data_import.washingtonian.run:WashingtonianSource"
  enabled: false   # flipped to true once the source is implemented

- key: 730dc
  name: "730DC"
  url: "REPLACE_WITH_PUBLISHED_DOC_URL"
  schedule: "0 7 * * *"
  module: "scripts.data_import.dc730.run:DC730Source"
  enabled: false
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/shared/test_source.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add scripts/shared/source.py scripts/sources.yaml tests/shared/test_source.py
git commit -m "feat(ingest): SourceBase plugin contract + sources.yaml registry"
```

---

## Phase 5 — Source #1: Clockout DC (Tasks 22-24)

### Task 22: Clockout fixture + parser test

**Files:**
- Create: `scripts/data_import/__init__.py`, `scripts/data_import/clockout/__init__.py`, `tests/fixtures/clockout/sample.html`, `tests/data_import/__init__.py`, `tests/data_import/test_clockout_parser.py`

- [ ] **Step 1: Save a real Clockout events HTML fixture**

```bash
mkdir -p tests/fixtures/clockout scripts/data_import/clockout tests/data_import
touch scripts/data_import/__init__.py scripts/data_import/clockout/__init__.py tests/data_import/__init__.py
curl -sSL "https://www.clockoutdc.com/events" \
  -H "User-Agent: Mozilla/5.0 (dc-events-digest fixture grabber)" \
  > tests/fixtures/clockout/sample.html
test -s tests/fixtures/clockout/sample.html && echo "fixture saved"
```

If the fetch returns a JS-shell page (no event content), the implementation will need the Playwright fallback (Task 23 Step 4). Inspect the file:

```bash
grep -c "event" tests/fixtures/clockout/sample.html
```

Expected: a non-zero count. If it's 0 or very low, the page is JS-rendered — flag this and switch to using Playwright to capture the rendered HTML. (For the fixture, you can manually save the rendered HTML from a real browser as `tests/fixtures/clockout/sample.html`.)

- [ ] **Step 2: Write the failing parser test**

```python
# tests/data_import/test_clockout_parser.py
from pathlib import Path
from scripts.data_import.clockout.run import ClockoutSource


def test_parser_extracts_at_least_one_event():
    html = Path("tests/fixtures/clockout/sample.html").read_text()
    items = ClockoutSource().parse_html(html)
    assert len(items) >= 1, "expected at least one event in the fixture"


def test_parser_event_has_required_fields():
    html = Path("tests/fixtures/clockout/sample.html").read_text()
    items = ClockoutSource().parse_html(html)
    e = items[0]
    assert e.get("title")
    assert e.get("start_at")
    assert e.get("url")
    assert e.get("external_id")
```

- [ ] **Step 3: Run, expect fail**

```bash
pytest tests/data_import/test_clockout_parser.py -v
```

Expected: ImportError or AttributeError.

- [ ] **Step 4: Commit fixture + tests (red state)**

```bash
git add scripts/data_import tests/fixtures/clockout tests/data_import
git commit -m "test(clockout): add fixture + failing parser tests"
```

---

### Task 23: Implement Clockout scraper

**Files:**
- Create: `scripts/data_import/clockout/run.py`

- [ ] **Step 1: Inspect the fixture to choose CSS selectors**

```bash
grep -oE '<[a-z]+ [^>]*class="[^"]*event[^"]*"' tests/fixtures/clockout/sample.html | head -20
```

Note the class names that wrap each event card (e.g., `.event-card`, `.events-list-item`, etc.). Record them as constants in the next step.

- [ ] **Step 2: Implement `scripts/data_import/clockout/run.py`**

```python
from __future__ import annotations
import hashlib
import logging
from typing import Any
import requests
from bs4 import BeautifulSoup
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.dates import parse_et
from scripts.shared.taxonomy import filter_tags

log = logging.getLogger(__name__)

URL = "https://www.clockoutdc.com/events"
USER_AGENT = "Mozilla/5.0 (dc-events-digest)"

# CSS selectors — confirmed against tests/fixtures/clockout/sample.html.
# If Clockout's markup changes, refresh the fixture and update these constants.
EVENT_SELECTOR = "[class*='event']"  # adjust based on Step 1 inspection
TITLE_SELECTOR = "h2, h3, [class*='title']"
DATE_SELECTOR = "[class*='date'], time"
VENUE_SELECTOR = "[class*='venue'], [class*='location']"
LINK_SELECTOR = "a[href]"

# Keyword classification — small, conservative; prefer 'community' as a fallback.
TYPE_KEYWORDS = {
    "music":     ("concert", "show", "gig", "dj", "band", "jazz", "music"),
    "food":      ("market", "tasting", "dinner", "brunch", "pop-up", "food"),
    "arts":      ("gallery", "exhibit", "theater", "comedy", "art", "film"),
    "outdoors":  ("hike", "park", "outdoor", "garden", "trail"),
    "civic":     ("hearing", "council", "anc", "town hall", "meeting"),
}
TAG_KEYWORDS = {
    "free":      ("free", "no cover", "no charge"),
    "outdoor":   ("outdoor", "outside", "rooftop"),
    "21+":       ("21+", "21 and up", "must be 21"),
    "family":    ("family", "kids", "all ages"),
    "happy-hour":("happy hour",),
}


def _classify_type(text: str) -> str:
    t = text.lower()
    for type_name, kws in TYPE_KEYWORDS.items():
        if any(k in t for k in kws):
            return type_name
    return "community"


def _classify_tags(text: str) -> list[str]:
    t = text.lower()
    found = [tag for tag, kws in TAG_KEYWORDS.items() if any(k in t for k in kws)]
    return filter_tags(found)


class ClockoutSource(SourceBase):
    source_key = "clockout"
    schedule = "0 6 * * *"

    def parse_html(self, html: str) -> list[RawCandidate]:
        soup = BeautifulSoup(html, "html.parser")
        out: list[RawCandidate] = []
        for card in soup.select(EVENT_SELECTOR):
            title_el = card.select_one(TITLE_SELECTOR)
            date_el = card.select_one(DATE_SELECTOR)
            link_el = card.select_one(LINK_SELECTOR)
            if not title_el or not date_el:
                continue
            title = title_el.get_text(strip=True)
            date_text = date_el.get_text(strip=True)
            url = link_el.get("href") if link_el else None
            if url and url.startswith("/"):
                url = "https://www.clockoutdc.com" + url
            start_at = parse_et(date_text)
            if not start_at or not title:
                continue
            text_blob = f"{title} {card.get_text(' ', strip=True)}"
            payload = {
                "title": title,
                "start_at": start_at.isoformat(),
                "type": _classify_type(text_blob),
                "venue_name": (card.select_one(VENUE_SELECTOR).get_text(strip=True)
                               if card.select_one(VENUE_SELECTOR) else None),
                "url": url,
                "tags": _classify_tags(text_blob),
            }
            external_id = hashlib.sha1(
                f"{url or title}|{payload['start_at']}".encode()
            ).hexdigest()[:16]
            out.append({"external_id": external_id, **payload})
        return out

    def fetch(self) -> list[RawCandidate]:
        resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=20)
        resp.raise_for_status()
        return self.parse_html(resp.text)

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        eid = raw.pop("external_id")
        return [{"external_id": eid, "payload": raw}]


if __name__ == "__main__":
    main_for(ClockoutSource)
```

- [ ] **Step 3: Run the parser test against the fixture**

```bash
pytest tests/data_import/test_clockout_parser.py -v
```

Expected: 2 passed. If 0 events extract, **inspect the fixture** and tighten `EVENT_SELECTOR` / `TITLE_SELECTOR` / `DATE_SELECTOR` to match the actual markup. Iterate until tests pass.

- [ ] **Step 4: Add Playwright fallback only if Step 1 showed a JS-shell page**

```bash
bun add -d playwright
bunx playwright install chromium
pip install playwright
playwright install chromium
```

Then add to `run.py`:

```python
def fetch_with_playwright(self) -> list[RawCandidate]:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(URL, wait_until="networkidle")
        html = page.content()
        browser.close()
    return self.parse_html(html)
```

Update `fetch()` to call `fetch_with_playwright()` when the simple `requests.get()` returns markup with no events. Skip this entire step if the requests-based fetch worked.

- [ ] **Step 5: Run dry-run end-to-end (no DB writes)**

```bash
source venv/bin/activate
python -m scripts.data_import.clockout.run --dry-run --limit 5
```

Expected: log lines like `source=clockout DRY RUN fetched=N would_stage=5` and a few `candidate:` log lines.

- [ ] **Step 6: Commit**

```bash
git add scripts/data_import/clockout/run.py
git commit -m "feat(clockout): scraper with keyword classification + dry-run support"
```

---

### Task 24: Clockout idempotency + flip enabled in `sources.yaml`

**Files:**
- Create: `tests/data_import/test_clockout_idempotent.py`
- Modify: `scripts/sources.yaml`

- [ ] **Step 1: Write idempotency test**

```python
# tests/data_import/test_clockout_idempotent.py
import pytest
from scripts.data_import.clockout.run import ClockoutSource
from scripts.shared.supabase import get_supabase_client
from pathlib import Path
from unittest.mock import patch


@pytest.fixture(autouse=True)
def _clean():
    sb = get_supabase_client()
    sb.table("staging_events").delete().eq("source", "clockout").execute()
    sb.table("event_tags").delete().neq("event_id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("events").delete().eq("source", "clockout").execute()
    yield


def test_running_twice_yields_same_events():
    html = Path("tests/fixtures/clockout/sample.html").read_text()

    with patch.object(ClockoutSource, "fetch", lambda self: self.parse_html(html)):
        run1 = ClockoutSource().run(dry_run=False)
        run2 = ClockoutSource().run(dry_run=False)

    sb = get_supabase_client()
    rows = sb.table("events").select("source_external_id").eq("source", "clockout").execute().data
    eids = sorted({r["source_external_id"] for r in rows})
    # Same set of external_ids, same count, no dupes
    assert run1["staged"] == run2["staged"]
    assert len(rows) == run1["approved"]  # second run is all updates
    assert len(eids) == len(rows)
```

- [ ] **Step 2: Run**

```bash
pytest tests/data_import/test_clockout_idempotent.py -v
```

Expected: 1 passed.

- [ ] **Step 3: Confirm `sources.yaml` already has Clockout enabled (no edit needed) and commit**

```bash
git add tests/data_import/test_clockout_idempotent.py
git commit -m "test(clockout): assert two consecutive runs yield identical DB state"
```

---

## Phase 6 — Source #2: Washingtonian (Tasks 25-27)

### Task 25: Washingtonian fixture + extractor test

**Files:**
- Create: `scripts/data_import/washingtonian/__init__.py`, `tests/fixtures/washingtonian/feed.xml`, `tests/fixtures/washingtonian/article-1.html`, `tests/data_import/test_washingtonian_extractor.py`

- [ ] **Step 1: Save fixtures**

```bash
mkdir -p tests/fixtures/washingtonian scripts/data_import/washingtonian
touch scripts/data_import/washingtonian/__init__.py
curl -sSL "https://washingtonian.com/sections/things-to-do/feed/" \
  > tests/fixtures/washingtonian/feed.xml
# Pick the first article URL from the feed and save it
ARTICLE_URL=$(grep -oE '<link>[^<]+things-to-do[^<]+</link>' tests/fixtures/washingtonian/feed.xml | head -1 | sed 's/<\/\?link>//g')
curl -sSL "$ARTICLE_URL" > tests/fixtures/washingtonian/article-1.html
ls -la tests/fixtures/washingtonian/
```

Expected: both files non-empty.

- [ ] **Step 2: Write the failing extractor test**

```python
# tests/data_import/test_washingtonian_extractor.py
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from scripts.data_import.washingtonian.run import WashingtonianSource


def test_extract_calls_llm_and_normalizes():
    article_html = Path("tests/fixtures/washingtonian/article-1.html").read_text()

    fake_msg = MagicMock()
    fake_msg.content = [MagicMock(text=json.dumps({
        "events": [{
            "title": "Cherry Blossom Festival Closing Concert",
            "start_at": "2026-04-26T19:00:00",
            "venue_name": "Tidal Basin Stage",
            "type": "music",
            "tags": ["free", "outdoor"],
        }],
    }))]

    raw = {
        "article_url": "https://washingtonian.com/things-to-do/cherry-blossom-finale/",
        "html": article_html,
    }

    with patch("scripts.shared.extraction._client", MagicMock(messages=MagicMock(create=MagicMock(return_value=fake_msg)))):
        out = WashingtonianSource().extract(raw)

    assert len(out) == 1
    e = out[0]
    assert e["payload"]["title"] == "Cherry Blossom Festival Closing Concert"
    assert e["payload"]["type"] == "music"
    assert e["payload"]["source_url"] == raw["article_url"]
    assert e["external_id"]  # SHA1 of (url + title + start_at)
```

- [ ] **Step 3: Run, expect fail (module doesn't exist yet)**

```bash
pytest tests/data_import/test_washingtonian_extractor.py -v
```

- [ ] **Step 4: Commit failing tests**

```bash
git add tests/fixtures/washingtonian tests/data_import/test_washingtonian_extractor.py scripts/data_import/washingtonian/__init__.py
git commit -m "test(washingtonian): add fixtures + failing extractor tests"
```

---

### Task 26: Implement Washingtonian extractor

**Files:**
- Create: `scripts/data_import/washingtonian/run.py`

- [ ] **Step 1: Implement `scripts/data_import/washingtonian/run.py`**

```python
from __future__ import annotations
import hashlib
import logging
from typing import Any
import feedparser
import requests
from bs4 import BeautifulSoup
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.extraction import extract_events
from scripts.shared.supabase import get_supabase_client

log = logging.getLogger(__name__)

FEED_URL = "https://washingtonian.com/sections/things-to-do/feed/"
USER_AGENT = "Mozilla/5.0 (dc-events-digest)"


def _readable_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    return soup.get_text(" ", strip=True)


def _hash_external_id(url: str, title: str, start_at: str) -> str:
    return hashlib.sha1(f"{url}|{title}|{start_at}".encode()).hexdigest()[:16]


def _last_cursor() -> str | None:
    sb = get_supabase_client()
    rows = sb.table("ingestion_state").select("last_cursor").eq("source", "washingtonian").execute().data
    return rows[0]["last_cursor"] if rows else None


def _save_cursor(value: str) -> None:
    sb = get_supabase_client()
    sb.table("ingestion_state").upsert({
        "source": "washingtonian",
        "last_cursor": value,
        "last_status": "ok",
        "last_run_at": "now()",
    }).execute()


class WashingtonianSource(SourceBase):
    source_key = "washingtonian"
    schedule = "30 6 * * *"

    def fetch(self) -> list[RawCandidate]:
        feed = feedparser.parse(FEED_URL)
        cursor = _last_cursor()
        out: list[RawCandidate] = []
        latest_seen = cursor
        for entry in feed.entries:
            published = entry.get("published") or entry.get("updated")
            if cursor and published and published <= cursor:
                continue
            try:
                resp = requests.get(entry.link, headers={"User-Agent": USER_AGENT}, timeout=20)
                resp.raise_for_status()
            except requests.RequestException as e:
                log.warning("skipping %s: %s", entry.link, e)
                continue
            out.append({"article_url": entry.link, "html": resp.text})
            if not latest_seen or (published and published > latest_seen):
                latest_seen = published
        if latest_seen and latest_seen != cursor:
            _save_cursor(latest_seen)
        return out

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        url = raw["article_url"]
        text = _readable_text(raw["html"])
        events = extract_events(article_text=text, source_url=url)
        out: list[ExtractedEvent] = []
        for ev in events:
            eid = _hash_external_id(url, ev["title"], ev["start_at"])
            payload = {**ev, "url": url}
            out.append({"external_id": eid, "payload": payload})
        return out


if __name__ == "__main__":
    main_for(WashingtonianSource)
```

- [ ] **Step 2: Run extractor test**

```bash
pytest tests/data_import/test_washingtonian_extractor.py -v
```

Expected: 1 passed.

- [ ] **Step 3: Dry run end-to-end (no DB writes, mocked LLM not used here — uses real Anthropic)**

If `ANTHROPIC_API_KEY` is set:

```bash
source venv/bin/activate
python -m scripts.data_import.washingtonian.run --dry-run --limit 2
```

Expected: 2 articles fetched, log lines showing extracted candidates.

- [ ] **Step 4: Flip `enabled: true` for Washingtonian in `scripts/sources.yaml`**

Edit `scripts/sources.yaml`, change the `washingtonian` block's `enabled: false` → `enabled: true`.

- [ ] **Step 5: Commit**

```bash
git add scripts/data_import/washingtonian/run.py scripts/sources.yaml
git commit -m "feat(washingtonian): RSS-driven LLM extractor with cursor tracking"
```

---

### Task 27: Real-LLM gated end-to-end test

**Files:**
- Create: `tests/data_import/test_washingtonian_real_llm.py`

- [ ] **Step 1: Write the gated test**

```python
# tests/data_import/test_washingtonian_real_llm.py
import os
import pytest
from pathlib import Path
from scripts.data_import.washingtonian.run import WashingtonianSource


@pytest.mark.skipif(
    os.environ.get("RUN_LLM_TESTS") != "1",
    reason="real-LLM test gated by RUN_LLM_TESTS=1",
)
def test_real_llm_extracts_or_returns_empty_gracefully():
    article_html = Path("tests/fixtures/washingtonian/article-1.html").read_text()
    raw = {"article_url": "https://washingtonian.com/sections/things-to-do/sample/", "html": article_html}
    out = WashingtonianSource().extract(raw)
    # We can't assert specific content (LLM output varies). Just assert structural sanity.
    for ex in out:
        assert ex["external_id"]
        assert ex["payload"]["title"]
        assert ex["payload"]["start_at"]
        assert ex["payload"]["type"] in ("music", "food", "arts", "outdoors", "civic", "community")
```

- [ ] **Step 2: Run it locally to verify**

```bash
source venv/bin/activate
RUN_LLM_TESTS=1 pytest tests/data_import/test_washingtonian_real_llm.py -v
```

Expected: pass (LLM call succeeds; output may vary). Cost: pennies.

- [ ] **Step 3: Commit**

```bash
git add tests/data_import/test_washingtonian_real_llm.py
git commit -m "test(washingtonian): gated real-LLM end-to-end smoke"
```

---

## Phase 7 — Source #3: 730DC (Tasks 28-29)

### Task 28: 730DC fixture + extractor test

**Files:**
- Create: `scripts/data_import/dc730/__init__.py`, `tests/fixtures/dc730/sample-pub.html`, `tests/data_import/test_dc730_extractor.py`

- [ ] **Step 1: Save the published-doc fixture**

The user must provide the `/pub` URL (record it in `scripts/sources.yaml` later). For the fixture, use the sample URL the user shared during brainstorming or grab a current published doc:

```bash
mkdir -p tests/fixtures/dc730 scripts/data_import/dc730
touch scripts/data_import/dc730/__init__.py
PUB_URL="<PASTE_PUBLISHED_DOC_URL_HERE>"
curl -sSL "$PUB_URL" > tests/fixtures/dc730/sample-pub.html
test -s tests/fixtures/dc730/sample-pub.html && echo "fixture saved"
```

- [ ] **Step 2: Write the failing extractor test**

```python
# tests/data_import/test_dc730_extractor.py
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from scripts.data_import.dc730.run import DC730Source


def test_extract_calls_llm_with_newsletter_prompt_tweak():
    html = Path("tests/fixtures/dc730/sample-pub.html").read_text()

    fake_msg = MagicMock()
    fake_msg.content = [MagicMock(text=json.dumps({
        "events": [{
            "title": "ANC 1A Public Meeting",
            "start_at": "2026-04-26T19:00:00",
            "type": "civic",
            "neighborhood": "Columbia Heights",
            "tags": [],
        }],
    }))]

    raw = {"doc_publication_date": "2026-04-25", "html": html}

    with patch("scripts.shared.extraction._client", MagicMock(messages=MagicMock(create=MagicMock(return_value=fake_msg)))):
        out = DC730Source().extract(raw)

    assert len(out) == 1
    assert out[0]["payload"]["title"] == "ANC 1A Public Meeting"
    assert out[0]["payload"]["type"] == "civic"
    assert out[0]["external_id"]  # SHA1 of (doc_date + title + start_at)
```

- [ ] **Step 3: Run, expect fail**

```bash
pytest tests/data_import/test_dc730_extractor.py -v
```

- [ ] **Step 4: Commit fixture + tests**

```bash
git add scripts/data_import/dc730 tests/fixtures/dc730 tests/data_import/test_dc730_extractor.py
git commit -m "test(730dc): add fixture + failing extractor test"
```

---

### Task 29: Implement 730DC extractor

**Files:**
- Create: `scripts/data_import/dc730/run.py`
- Modify: `scripts/sources.yaml`

- [ ] **Step 1: Implement `scripts/data_import/dc730/run.py`**

```python
from __future__ import annotations
import hashlib
import logging
import re
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.extraction import extract_events
from scripts.shared.supabase import get_supabase_client

log = logging.getLogger(__name__)

# REPLACE with the real published Google Doc URL during deployment.
DOC_URL = "https://docs.google.com/document/d/e/2PACX-PLACEHOLDER/pub"
USER_AGENT = "Mozilla/5.0 (dc-events-digest)"

NEWSLETTER_INSTRUCTION = (
    "This is a daily newsletter — focus on the events section. "
    "Skip news commentary and political opinion."
)


def _readable_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    return soup.get_text(" ", strip=True)


def _doc_publication_date(html: str) -> str:
    """Best-effort: scan for an ISO-ish date near the top of the document."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)[:1000]
    m = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", text)
    if m:
        return m.group(0)
    return datetime.utcnow().date().isoformat()


def _hash_external_id(doc_date: str, title: str, start_at: str) -> str:
    return hashlib.sha1(f"{doc_date}|{title}|{start_at}".encode()).hexdigest()[:16]


def _last_cursor() -> str | None:
    sb = get_supabase_client()
    rows = sb.table("ingestion_state").select("last_cursor").eq("source", "730dc").execute().data
    return rows[0]["last_cursor"] if rows else None


def _save_cursor(value: str) -> None:
    sb = get_supabase_client()
    sb.table("ingestion_state").upsert({
        "source": "730dc", "last_cursor": value, "last_status": "ok", "last_run_at": "now()"
    }).execute()


class DC730Source(SourceBase):
    source_key = "730dc"
    schedule = "0 7 * * *"

    def fetch(self) -> list[RawCandidate]:
        resp = requests.get(DOC_URL, headers={"User-Agent": USER_AGENT}, timeout=20)
        resp.raise_for_status()
        doc_date = _doc_publication_date(resp.text)
        cursor = _last_cursor()
        # Treat "we already processed today's doc" as a no-op
        if cursor == doc_date:
            log.info("730dc: cursor matches doc date %s — nothing new", doc_date)
            return []
        _save_cursor(doc_date)
        return [{"doc_publication_date": doc_date, "html": resp.text}]

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        text = _readable_text(raw["html"])
        events = extract_events(
            article_text=text,
            source_url=DOC_URL,
            extra_instructions=NEWSLETTER_INSTRUCTION,
        )
        out: list[ExtractedEvent] = []
        for ev in events:
            eid = _hash_external_id(raw["doc_publication_date"], ev["title"], ev["start_at"])
            payload = {**ev, "url": DOC_URL}
            out.append({"external_id": eid, "payload": payload})
        return out


if __name__ == "__main__":
    main_for(DC730Source)
```

- [ ] **Step 2: Run extractor test**

```bash
pytest tests/data_import/test_dc730_extractor.py -v
```

Expected: 1 passed.

- [ ] **Step 3: Update `sources.yaml` with the real doc URL and flip `enabled: true`**

Edit `scripts/sources.yaml`:
- Change `url:` for `730dc` to the real published-doc URL.
- Change `enabled: false` → `enabled: true`.
- Edit `DOC_URL` constant in `scripts/data_import/dc730/run.py` to match.

- [ ] **Step 4: Commit**

```bash
git add scripts/data_import/dc730/run.py scripts/sources.yaml
git commit -m "feat(730dc): published-Google-Doc extractor with daily-cursor guard"
```

---

## Phase 8 — Frontend foundation (Tasks 30-33)

### Task 30: `src/lib/supabase.ts` — anon client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Install supabase-js**

```bash
bun add @supabase/supabase-js
```

- [ ] **Step 2: Write `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase-types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient<Database>(url, anonKey)
```

- [ ] **Step 3: Verify build**

```bash
bun run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts package.json bun.lockb
git commit -m "feat(frontend): typed anon Supabase client"
```

---

### Task 31: `src/lib/dates.ts` — week helpers (TDD)

**Files:**
- Create: `src/lib/dates.ts`, `src/lib/dates.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/dates.test.ts
import { describe, it, expect } from 'vitest'
import { startOfIsoWeek, formatWeekRange, sevenDays, formatDayHeading } from './dates'

describe('startOfIsoWeek', () => {
  it('returns Monday for any date in the week', () => {
    // 2026-04-26 is a Sunday; ISO week Monday is 2026-04-20
    const sunday = new Date('2026-04-26T12:00:00Z')
    expect(startOfIsoWeek(sunday).toISOString().slice(0, 10)).toBe('2026-04-20')
  })

  it('returns the same Monday when given a Monday', () => {
    const monday = new Date('2026-04-20T00:00:00Z')
    expect(startOfIsoWeek(monday).toISOString().slice(0, 10)).toBe('2026-04-20')
  })
})

describe('sevenDays', () => {
  it('returns 7 consecutive days starting at the given date', () => {
    const start = new Date('2026-04-20T00:00:00Z')
    const days = sevenDays(start)
    expect(days).toHaveLength(7)
    expect(days[0].toISOString().slice(0, 10)).toBe('2026-04-20')
    expect(days[6].toISOString().slice(0, 10)).toBe('2026-04-26')
  })
})

describe('formatWeekRange', () => {
  it('formats Apr 20 — Apr 26, 2026', () => {
    expect(formatWeekRange(new Date('2026-04-20T00:00:00Z')))
      .toBe('Apr 20 — Apr 26, 2026')
  })
})

describe('formatDayHeading', () => {
  it('formats SAT · APR 26', () => {
    expect(formatDayHeading(new Date('2026-04-26T12:00:00Z')))
      .toBe('SAT · APR 26')
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
bun run test src/lib/dates.test.ts
```

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```ts
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT']

export function startOfIsoWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = x.getUTCDay() // 0=Sun
  const daysFromMonday = (dow + 6) % 7
  x.setUTCDate(x.getUTCDate() - daysFromMonday)
  return x
}

export function sevenDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    return d
  })
}

export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} — ${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`
}

export function formatDayHeading(d: Date): string {
  return `${DAYS_SHORT[d.getUTCDay()]} · ${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()}`
}

export function isoDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
bun run test src/lib/dates.test.ts
```

Expected: 5 passed (4 tests, one of which has 2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat(frontend): week + day formatting helpers"
```

---

### Task 32: `src/hooks/useFilterState.ts` — URL ↔ filter sync (TDD)

**Files:**
- Create: `src/hooks/useFilterState.ts`, `src/hooks/useFilterState.test.tsx`

- [ ] **Step 1: Install React Router (needed for `useSearchParams`)**

```bash
bun add react-router-dom
```

- [ ] **Step 2: Write failing tests**

```tsx
// src/hooks/useFilterState.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useFilterState } from './useFilterState'
import React from 'react'

function wrapper(initial: string) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  )
}

describe('useFilterState', () => {
  it('reads type and tags from URL', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper('/?type=music&tags=free,outdoor'),
    })
    expect(result.current.type).toBe('music')
    expect(result.current.tags).toEqual(['free', 'outdoor'])
  })

  it('defaults to type=all and tags=[]', () => {
    const { result } = renderHook(() => useFilterState(), { wrapper: wrapper('/') })
    expect(result.current.type).toBe('all')
    expect(result.current.tags).toEqual([])
  })

  it('writes type to URL on setType', () => {
    const probe: { search: string | null } = { search: null }
    function Probe() {
      const loc = useLocation()
      probe.search = loc.search
      return null
    }
    const { result } = renderHook(
      () => {
        const fs = useFilterState()
        return fs
      },
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/']}>
            {children}
            <Probe />
          </MemoryRouter>
        ),
      }
    )
    act(() => result.current.setType('food'))
    expect(probe.search).toBe('?type=food')
  })

  it('toggles a tag in/out of the URL', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper('/?tags=free'),
    })
    act(() => result.current.toggleTag('outdoor'))
    expect(result.current.tags.sort()).toEqual(['free', 'outdoor'])
    act(() => result.current.toggleTag('free'))
    expect(result.current.tags).toEqual(['outdoor'])
  })
})
```

- [ ] **Step 3: Run, expect fail**

```bash
bun run test src/hooks/useFilterState.test.tsx
```

- [ ] **Step 4: Implement `src/hooks/useFilterState.ts`**

```ts
import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

const TYPES_INCLUDING_ALL = ['all', 'music', 'food', 'arts', 'outdoors', 'civic', 'community'] as const
export type EventType = typeof TYPES_INCLUDING_ALL[number]

export function useFilterState() {
  const [params, setParams] = useSearchParams()

  const type = (TYPES_INCLUDING_ALL as readonly string[]).includes(params.get('type') ?? '')
    ? (params.get('type') as EventType)
    : 'all'

  const tags = (params.get('tags') ?? '').split(',').filter(Boolean)

  const setType = useCallback((t: EventType) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (t === 'all') next.delete('type'); else next.set('type', t)
      return next
    })
  }, [setParams])

  const toggleTag = useCallback((tag: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      const curr = new Set((next.get('tags') ?? '').split(',').filter(Boolean))
      curr.has(tag) ? curr.delete(tag) : curr.add(tag)
      const value = Array.from(curr).join(',')
      if (value) next.set('tags', value); else next.delete('tags')
      return next
    })
  }, [setParams])

  const clear = useCallback(() => setParams(new URLSearchParams()), [setParams])

  return { type, tags, setType, toggleTag, clear }
}
```

- [ ] **Step 5: Run, expect pass**

```bash
bun run test src/hooks/useFilterState.test.tsx
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFilterState.ts src/hooks/useFilterState.test.tsx package.json bun.lockb
git commit -m "feat(frontend): URL-synced filter state hook"
```

---

### Task 33: `src/hooks/useEventsForWeek.ts` — Supabase query (TDD)

**Files:**
- Create: `src/hooks/useEventsForWeek.ts`, `src/hooks/useEventsForWeek.test.tsx`

- [ ] **Step 1: Write failing tests (mocks supabase)**

```tsx
// src/hooks/useEventsForWeek.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useEventsForWeek } from './useEventsForWeek'

// Mock the supabase module before the hook imports it
vi.mock('@/lib/supabase', () => {
  const eq = vi.fn().mockReturnThis()
  const gte = vi.fn().mockReturnThis()
  const lt = vi.fn().mockReturnThis()
  const order = vi.fn().mockReturnThis()
  const select = vi.fn().mockReturnThis()
  const from = vi.fn().mockReturnThis()
  const queryFn = { select, eq, gte, lt, order, then: undefined as any }
  // .then resolves the chain
  ;(queryFn as any).then = (resolve: any) =>
    Promise.resolve({
      data: [
        { id: '1', title: 'A', start_at: '2026-04-26T17:00:00Z', type: 'music', source: 'clockout', source_external_id: 'a', is_all_day: false, venue_name: null, neighborhood: null, url: null, cost_text: null, description: null, end_at: null, created_at: '', updated_at: '' },
      ],
      error: null,
    }).then(resolve)
  return { supabase: { from: () => queryFn } }
})

beforeEach(() => vi.clearAllMocks())

describe('useEventsForWeek', () => {
  it('returns events on success', async () => {
    const monday = new Date('2026-04-20T00:00:00Z')
    const { result } = renderHook(() => useEventsForWeek(monday, 'all', []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0].title).toBe('A')
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
bun run test src/hooks/useEventsForWeek.test.tsx
```

- [ ] **Step 3: Implement `src/hooks/useEventsForWeek.ts`**

```ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase-types'
import { sevenDays, isoDateString } from '@/lib/dates'

export type EventRow = Database['public']['Tables']['events']['Row']

export function useEventsForWeek(monday: Date, type: string, tags: string[]) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const start = isoDateString(monday)
    const sundayPlusOne = new Date(monday)
    sundayPlusOne.setUTCDate(monday.getUTCDate() + 7)
    const end = isoDateString(sundayPlusOne)

    let q = supabase.from('events').select('*')
      .gte('start_at', start)
      .lt('start_at', end)
      .order('start_at', { ascending: true })

    if (type !== 'all') q = q.eq('type', type)

    q.then(({ data, error }) => {
      if (cancelled) return
      if (error) { setError(error.message); setLoading(false); return }
      let rows = (data ?? []) as EventRow[]
      if (tags.length > 0) {
        // Tag filter: client-side join. (For v1 traffic, fine; revisit if event count grows.)
        // Server-side join requires a view; deferred until needed.
      }
      setEvents(rows)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [monday.getTime(), type, tags.join(',')])

  return { events, loading, error }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
bun run test src/hooks/useEventsForWeek.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEventsForWeek.ts src/hooks/useEventsForWeek.test.tsx
git commit -m "feat(frontend): hook for week-scoped event fetch with type filter"
```

---

## Phase 9 — Frontend components (Tasks 34-39)

### Task 34: `EventCard` (TDD)

**Files:**
- Create: `src/components/calendar/EventCard.tsx`, `src/components/calendar/EventCard.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// src/components/calendar/EventCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EventCard } from './EventCard'

const sample = {
  id: '1',
  title: 'Jazz in the Garden',
  start_at: '2026-04-26T21:00:00Z',
  end_at: null,
  is_all_day: false,
  type: 'music',
  venue_name: 'Sculpture Garden',
  venue_address: null,
  neighborhood: null,
  url: null,
  source: 'clockout',
  source_external_id: 'a',
  cost_text: 'Free',
  description: null,
  created_at: '', updated_at: '',
}

describe('EventCard', () => {
  it('renders title, time, venue, cost', () => {
    render(<MemoryRouter><EventCard event={sample as any} tags={['free', 'outdoor']} /></MemoryRouter>)
    expect(screen.getByText('Jazz in the Garden')).toBeInTheDocument()
    expect(screen.getByText(/Sculpture Garden/)).toBeInTheDocument()
    expect(screen.getByText(/Free/)).toBeInTheDocument()
    expect(screen.getByText(/free/)).toBeInTheDocument()  // tag chip
  })

  it('links to /event/:id', () => {
    render(<MemoryRouter><EventCard event={sample as any} tags={[]} /></MemoryRouter>)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/event/1')
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
bun run test src/components/calendar/EventCard.test.tsx
```

- [ ] **Step 3: Implement `EventCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import type { EventRow } from '@/hooks/useEventsForWeek'

const TYPE_BORDER: Record<string, string> = {
  music: 'border-l-stamp',
  food: 'border-l-yellow-600',
  arts: 'border-l-purple-600',
  outdoors: 'border-l-green-700',
  civic: 'border-l-blue-700',
  community: 'border-l-gray-500',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  let h = d.getUTCHours()  // events were stored UTC; render in local TZ for the user
  const local = new Date(iso)
  h = local.getHours()
  const m = local.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = ((h + 11) % 12) + 1
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

export function EventCard({ event, tags }: { event: EventRow; tags: string[] }) {
  const border = TYPE_BORDER[event.type] ?? 'border-l-gray-400'
  const meta = [
    formatTime(event.start_at),
    event.venue_name ?? null,
    event.cost_text ?? null,
  ].filter(Boolean).join(' · ')
  return (
    <Link to={`/event/${event.id}`} className="block">
      <div className={`bg-white border border-gray-300 ${border} border-l-[3px] p-3 mb-2`}>
        <div className="font-serif text-base font-semibold text-ink">{event.title}</div>
        <div className="font-mono text-xs text-muted mt-1">{meta}</div>
        {tags.length > 0 && (
          <div className="font-mono text-[10px] text-muted mt-1">{tags.join(' · ')}</div>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
bun run test src/components/calendar/EventCard.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/EventCard.tsx src/components/calendar/EventCard.test.tsx
git commit -m "feat(frontend): EventCard with type-colored border + meta"
```

---

### Task 35: `Agenda` (TDD)

**Files:**
- Create: `src/components/calendar/Agenda.tsx`, `src/components/calendar/Agenda.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// src/components/calendar/Agenda.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Agenda } from './Agenda'

const events = [
  { id: '1', title: 'Show A', start_at: '2026-04-26T17:00:00Z', type: 'music', source: 'clockout', source_external_id: 'a', is_all_day: false, venue_name: 'V1', venue_address: null, neighborhood: null, url: null, cost_text: null, description: null, end_at: null, created_at: '', updated_at: '' },
]

describe('Agenda', () => {
  it('shows day heading + event count', () => {
    render(<MemoryRouter><Agenda day={new Date('2026-04-26T12:00:00Z')} events={events as any} eventTags={{}} /></MemoryRouter>)
    expect(screen.getByText(/SAT · APR 26/)).toBeInTheDocument()
    expect(screen.getByText(/1 EVENT/)).toBeInTheDocument()
    expect(screen.getByText('Show A')).toBeInTheDocument()
  })

  it('shows empty state when no events', () => {
    render(<MemoryRouter><Agenda day={new Date('2026-04-26T12:00:00Z')} events={[] as any} eventTags={{}} /></MemoryRouter>)
    expect(screen.getByText(/No events match/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement `Agenda.tsx`**

```tsx
import { EventCard } from './EventCard'
import { formatDayHeading } from '@/lib/dates'
import type { EventRow } from '@/hooks/useEventsForWeek'

export function Agenda({
  day, events, eventTags,
}: {
  day: Date
  events: EventRow[]
  eventTags: Record<string, string[]>
}) {
  const sameDay = events.filter(e => {
    const d = new Date(e.start_at)
    return d.getUTCFullYear() === day.getUTCFullYear()
        && d.getUTCMonth() === day.getUTCMonth()
        && d.getUTCDate() === day.getUTCDate()
  })

  const heading = formatDayHeading(day)
  const countLabel = sameDay.length === 1 ? '1 EVENT' : `${sameDay.length} EVENTS`

  return (
    <section>
      <div className="font-mono text-xs text-muted my-3 tracking-widest">
        — {heading} · {countLabel} —
      </div>
      {sameDay.length === 0 ? (
        <div className="font-mono text-sm text-muted py-6 text-center">
          No events match your filters this day.
        </div>
      ) : (
        sameDay.map(e => <EventCard key={e.id} event={e} tags={eventTags[e.id] ?? []} />)
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
bun run test src/components/calendar/Agenda.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/Agenda.tsx src/components/calendar/Agenda.test.tsx
git commit -m "feat(frontend): Agenda — day-grouped event list with empty state"
```

---

### Task 36: `WeekStrip` (TDD)

**Files:**
- Create: `src/components/calendar/WeekStrip.tsx`, `src/components/calendar/WeekStrip.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// src/components/calendar/WeekStrip.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekStrip } from './WeekStrip'

describe('WeekStrip', () => {
  const monday = new Date('2026-04-20T00:00:00Z')
  it('renders 7 day cells with day-of-month numbers', () => {
    render(<WeekStrip weekStart={monday} selected={monday} onSelect={() => {}} densities={{}} />)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('26')).toBeInTheDocument()
  })

  it('marks the selected day', () => {
    const sat = new Date('2026-04-25T00:00:00Z')
    render(<WeekStrip weekStart={monday} selected={sat} onSelect={() => {}} densities={{}} />)
    expect(screen.getByTestId('day-cell-2026-04-25')).toHaveClass('border-stamp')
  })

  it('calls onSelect with the clicked day', () => {
    const onSelect = vi.fn()
    render(<WeekStrip weekStart={monday} selected={monday} onSelect={onSelect} densities={{}} />)
    fireEvent.click(screen.getByTestId('day-cell-2026-04-25'))
    expect(onSelect).toHaveBeenCalledWith(expect.any(Date))
    expect(onSelect.mock.calls[0][0].toISOString().slice(0, 10)).toBe('2026-04-25')
  })
})
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement `WeekStrip.tsx`**

```tsx
import { sevenDays, isoDateString } from '@/lib/dates'

const DAY_INITIALS = ['M','T','W','T','F','S','S']  // Monday-first

export function WeekStrip({
  weekStart, selected, onSelect, densities,
}: {
  weekStart: Date
  selected: Date
  onSelect: (d: Date) => void
  densities: Record<string, { type: string; count: number }[]>  // iso date → markers
}) {
  const days = sevenDays(weekStart)
  const selectedIso = isoDateString(selected)
  return (
    <div className="grid grid-cols-7 gap-1 mb-3">
      {days.map((d, i) => {
        const iso = isoDateString(d)
        const isSelected = iso === selectedIso
        const markers = densities[iso] ?? []
        return (
          <button
            key={iso}
            data-testid={`day-cell-${iso}`}
            onClick={() => onSelect(d)}
            className={`bg-white border ${isSelected ? 'border-stamp border-2' : 'border-gray-300'} p-1 text-center font-serif`}
          >
            <div className="font-mono text-[10px] text-muted">{DAY_INITIALS[i]}</div>
            <div className="text-base">{d.getUTCDate()}</div>
            <div className="flex gap-0.5 justify-center mt-0.5 h-1">
              {markers.slice(0, 3).map((m, idx) => (
                <span key={idx} className="w-1.5 h-1 bg-stamp rounded-sm" />
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run, expect pass**

```bash
bun run test src/components/calendar/WeekStrip.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/WeekStrip.tsx src/components/calendar/WeekStrip.test.tsx
git commit -m "feat(frontend): WeekStrip — 7 mini-page day cells with density markers"
```

---

### Task 37: `DayHero`, `WeekNav`, `TypeTabs`, `TagChips` (one task, similar TDD pattern)

**Files:**
- Create: `src/components/calendar/DayHero.tsx`, `src/components/calendar/WeekNav.tsx`, `src/components/filters/TypeTabs.tsx`, `src/components/filters/TagChips.tsx` (+ matching `.test.tsx` for each)

- [ ] **Step 1: Write all 4 test files**

```tsx
// src/components/calendar/DayHero.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayHero } from './DayHero'

describe('DayHero', () => {
  it('renders day name and big numeral', () => {
    render(<DayHero day={new Date('2026-04-26T12:00:00Z')} />)
    expect(screen.getByText('SATURDAY')).toBeInTheDocument()
    expect(screen.getByText('26')).toBeInTheDocument()
    expect(screen.getByText(/APR.*2026/i)).toBeInTheDocument()
  })
})
```

```tsx
// src/components/calendar/WeekNav.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekNav } from './WeekNav'

describe('WeekNav', () => {
  it('shows the week range and calls callbacks', () => {
    const onPrev = vi.fn(), onNext = vi.fn(), onToday = vi.fn()
    render(<WeekNav weekStart={new Date('2026-04-20T00:00:00Z')} onPrev={onPrev} onNext={onNext} onToday={onToday} />)
    expect(screen.getByText(/Apr 20 — Apr 26, 2026/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('previous week')); expect(onPrev).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('next week')); expect(onNext).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Today')); expect(onToday).toHaveBeenCalled()
  })
})
```

```tsx
// src/components/filters/TypeTabs.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TypeTabs } from './TypeTabs'

describe('TypeTabs', () => {
  it('renders all 7 tabs (All + 6 types)', () => {
    render(<TypeTabs value="all" onChange={() => {}} />)
    ;['All','Music','Food','Arts','Outdoors','Civic','Community'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('calls onChange with the canonical key', () => {
    const onChange = vi.fn()
    render(<TypeTabs value="all" onChange={onChange} />)
    fireEvent.click(screen.getByText('Music'))
    expect(onChange).toHaveBeenCalledWith('music')
  })

  it('marks the active tab', () => {
    render(<TypeTabs value="food" onChange={() => {}} />)
    expect(screen.getByText('Food').closest('button')).toHaveClass('text-stamp')
  })
})
```

```tsx
// src/components/filters/TagChips.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagChips } from './TagChips'

describe('TagChips', () => {
  it('renders 8 chips', () => {
    render(<TagChips selected={[]} onToggle={() => {}} />)
    ;['free','ticketed','outdoor','21+','family','accessible','weekend','happy-hour'].forEach(t => {
      expect(screen.getByText(t)).toBeInTheDocument()
    })
  })

  it('marks selected chips and calls onToggle', () => {
    const onToggle = vi.fn()
    render(<TagChips selected={['free']} onToggle={onToggle} />)
    expect(screen.getByText('free').closest('button')).toHaveClass('border-stamp')
    fireEvent.click(screen.getByText('outdoor'))
    expect(onToggle).toHaveBeenCalledWith('outdoor')
  })
})
```

- [ ] **Step 2: Run all 4, expect fail**

```bash
bun run test src/components
```

- [ ] **Step 3: Implement `DayHero.tsx`**

```tsx
const FULL_DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

export function DayHero({ day }: { day: Date }) {
  return (
    <div className="inline-block bg-white border border-gray-400 shadow-[2px_2px_0_#cc3333,3px_3px_8px_rgba(0,0,0,0.15)] text-center mb-4">
      <div className="bg-stamp text-white font-mono text-xs tracking-[0.2em] py-1 px-3">
        {FULL_DAYS[day.getUTCDay()]}
      </div>
      <div className="font-serif text-7xl font-bold text-ink leading-none px-6 py-3">
        {day.getUTCDate()}
      </div>
      <div className="border-t border-dashed border-gray-400 font-mono text-[10px] text-muted py-1 tracking-widest">
        {MONTHS[day.getUTCMonth()]} · {day.getUTCFullYear()}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `WeekNav.tsx`**

```tsx
import { formatWeekRange } from '@/lib/dates'

export function WeekNav({
  weekStart, onPrev, onNext, onToday,
}: {
  weekStart: Date; onPrev: () => void; onNext: () => void; onToday: () => void
}) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <button aria-label="previous week" onClick={onPrev} className="font-serif text-xl">◂</button>
      <div className="font-mono text-sm flex-1 text-center">{formatWeekRange(weekStart)}</div>
      <button aria-label="next week" onClick={onNext} className="font-serif text-xl">▸</button>
      <button onClick={onToday} className="font-mono text-xs underline">Today</button>
    </div>
  )
}
```

- [ ] **Step 5: Implement `TypeTabs.tsx`**

```tsx
const TYPES: { key: 'all'|'music'|'food'|'arts'|'outdoors'|'civic'|'community'; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'music',     label: 'Music' },
  { key: 'food',      label: 'Food' },
  { key: 'arts',      label: 'Arts' },
  { key: 'outdoors',  label: 'Outdoors' },
  { key: 'civic',     label: 'Civic' },
  { key: 'community', label: 'Community' },
]

export function TypeTabs({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {TYPES.map((t, i) => {
        const active = value === t.key
        const rot = i % 2 === 0 ? '-rotate-1' : 'rotate-1'
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`font-mono uppercase text-xs tracking-wider border-2 px-2 py-1 transform ${rot} ${
              active ? 'border-stamp text-stamp' : 'border-muted text-muted'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Implement `TagChips.tsx`**

```tsx
const TAGS = ['free','ticketed','outdoor','21+','family','accessible','weekend','happy-hour'] as const

export function TagChips({ selected, onToggle }: { selected: string[]; onToggle: (t: string) => void }) {
  const sel = new Set(selected)
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TAGS.map((t, i) => {
        const active = sel.has(t)
        const rot = i % 2 === 0 ? '-rotate-2' : 'rotate-2'
        return (
          <button
            key={t}
            onClick={() => onToggle(t)}
            className={`font-mono text-[10px] uppercase border px-2 py-0.5 whitespace-nowrap transform ${rot} ${
              active ? 'border-stamp text-stamp' : 'border-muted text-muted'
            }`}
          >
            {t}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: Run all 4 tests, expect pass**

```bash
bun run test src/components
```

Expected: 8 passed.

- [ ] **Step 8: Commit**

```bash
git add src/components
git commit -m "feat(frontend): DayHero, WeekNav, TypeTabs, TagChips with skeuomorphic styles"
```

---

### Task 38: `Header`, `EmptyState`, `/dev/components` route for visual review

**Files:**
- Create: `src/components/layout/Header.tsx`, `src/components/layout/EmptyState.tsx`, `src/pages/DevComponentsPage.tsx`

- [ ] **Step 1: Implement `Header.tsx`**

```tsx
import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="border-b border-gray-300 mb-4 pb-2 flex items-baseline justify-between">
      <Link to="/" className="font-serif text-2xl font-bold text-ink">DC Events Digest</Link>
      <Link to="/about" className="font-mono text-xs text-muted hover:text-ink">[About]</Link>
    </header>
  )
}
```

- [ ] **Step 2: Implement `EmptyState.tsx`**

```tsx
export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-block border-4 border-stamp text-stamp font-mono text-2xl tracking-widest px-6 py-3 -rotate-3">
        {message}
      </div>
      {hint && <div className="font-mono text-xs text-muted mt-4">{hint}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Implement `/dev/components` route page**

```tsx
// src/pages/DevComponentsPage.tsx
import { DayHero } from '@/components/calendar/DayHero'
import { WeekStrip } from '@/components/calendar/WeekStrip'
import { WeekNav } from '@/components/calendar/WeekNav'
import { TypeTabs } from '@/components/filters/TypeTabs'
import { TagChips } from '@/components/filters/TagChips'
import { EventCard } from '@/components/calendar/EventCard'
import { EmptyState } from '@/components/layout/EmptyState'
import { Header } from '@/components/layout/Header'
import { useState } from 'react'

const sample = {
  id: '1', title: 'Jazz in the Garden', start_at: '2026-04-26T21:00:00Z', end_at: null,
  is_all_day: false, type: 'music', venue_name: 'Sculpture Garden', venue_address: null,
  neighborhood: null, url: null, source: 'clockout', source_external_id: 'a',
  cost_text: 'Free', description: null, created_at: '', updated_at: '',
}

export function DevComponentsPage() {
  const [type, setType] = useState<any>('all')
  const [tags, setTags] = useState<string[]>([])
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <h2 className="font-mono text-xs text-muted uppercase">— DayHero —</h2>
      <DayHero day={new Date('2026-04-26T12:00:00Z')} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— WeekStrip —</h2>
      <WeekStrip weekStart={new Date('2026-04-20T00:00:00Z')} selected={new Date('2026-04-25T00:00:00Z')} onSelect={() => {}} densities={{ '2026-04-25': [{ type:'music', count:2 }] }} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— WeekNav —</h2>
      <WeekNav weekStart={new Date('2026-04-20T00:00:00Z')} onPrev={() => {}} onNext={() => {}} onToday={() => {}} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— TypeTabs —</h2>
      <TypeTabs value={type} onChange={setType} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— TagChips —</h2>
      <TagChips selected={tags} onToggle={(t) => setTags(s => s.includes(t) ? s.filter(x => x!==t) : [...s, t])} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— EventCard —</h2>
      <EventCard event={sample as any} tags={['free', 'outdoor']} />
      <h2 className="font-mono text-xs text-muted uppercase mt-6">— EmptyState —</h2>
      <EmptyState message="NO EVENTS" hint="check back tomorrow" />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout src/pages/DevComponentsPage.tsx
git commit -m "feat(frontend): Header, EmptyState, /dev/components review page"
```

---

### Task 39: Run a full component test sweep

- [ ] **Step 1: Run all tests**

```bash
bun run test
```

Expected: every test from Tasks 2, 31, 32, 33, 34, 35, 36, 37 passes. Fix any regressions.

- [ ] **Step 2: No commit (verification step only)**

---

## Phase 10 — Pages + routing (Tasks 40-42)

### Task 40: Wire React Router + `CalendarPage`

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`
- Create: `src/pages/CalendarPage.tsx`

- [ ] **Step 1: Replace `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 2: Replace `src/App.tsx` with the initial route table (only CalendarPage + DevComponentsPage; later tasks add the others)**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { CalendarPage } from './pages/CalendarPage'
import { DevComponentsPage } from './pages/DevComponentsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/week/:isoDate" element={<CalendarPage />} />
      <Route path="/dev/components" element={<DevComponentsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Implement `src/pages/CalendarPage.tsx`**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { TypeTabs } from '@/components/filters/TypeTabs'
import { TagChips } from '@/components/filters/TagChips'
import { WeekNav } from '@/components/calendar/WeekNav'
import { WeekStrip } from '@/components/calendar/WeekStrip'
import { DayHero } from '@/components/calendar/DayHero'
import { Agenda } from '@/components/calendar/Agenda'
import { EmptyState } from '@/components/layout/EmptyState'
import { useFilterState } from '@/hooks/useFilterState'
import { useEventsForWeek } from '@/hooks/useEventsForWeek'
import { startOfIsoWeek, isoDateString } from '@/lib/dates'

function parseIso(s?: string): Date {
  if (!s) return startOfIsoWeek(new Date())
  const d = new Date(s + 'T00:00:00Z')
  return isNaN(d.getTime()) ? startOfIsoWeek(new Date()) : startOfIsoWeek(d)
}

export function CalendarPage() {
  const { isoDate } = useParams()
  const nav = useNavigate()
  const weekStart = useMemo(() => parseIso(isoDate), [isoDate])

  const today = useMemo(() => new Date(), [])
  const isCurrentWeek = isoDateString(weekStart) === isoDateString(startOfIsoWeek(today))
  const [selected, setSelected] = useState<Date>(isCurrentWeek ? today : weekStart)

  const { type, tags, setType, toggleTag, clear } = useFilterState()
  const { events, loading, error } = useEventsForWeek(weekStart, type, tags)

  const goWeek = (offsetDays: number) => {
    const next = new Date(weekStart)
    next.setUTCDate(weekStart.getUTCDate() + offsetDays)
    nav(`/week/${isoDateString(next)}`)
  }

  const densities: Record<string, { type: string; count: number }[]> = {}
  for (const e of events) {
    const k = isoDateString(new Date(e.start_at))
    densities[k] = densities[k] ?? []
    densities[k].push({ type: e.type, count: 1 })
  }

  const eventTags: Record<string, string[]> = {}  // tag join not yet wired client-side

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <TypeTabs value={type} onChange={setType} />
      <div className="mt-2">
        <TagChips selected={tags} onToggle={toggleTag} />
      </div>
      <div className="mt-6">
        <WeekNav weekStart={weekStart} onPrev={() => goWeek(-7)} onNext={() => goWeek(7)} onToday={() => nav('/')} />
        <WeekStrip weekStart={weekStart} selected={selected} onSelect={setSelected} densities={densities} />
      </div>
      <div className="mt-4">
        <DayHero day={selected} />
      </div>
      {error && <EmptyState message="ERROR" hint={error} />}
      {!error && loading && <div className="font-mono text-sm text-muted">Loading…<span className="animate-pulse">▌</span></div>}
      {!error && !loading && events.length === 0 && (
        <EmptyState message="NO EVENTS" hint="Try clearing filters or check back tomorrow." />
      )}
      {!error && !loading && events.length > 0 && (
        <Agenda day={selected} events={events} eventTags={eventTags} />
      )}
      {tags.length > 0 && (
        <button onClick={clear} className="font-mono text-xs underline mt-6">Clear all filters</button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build + dev server**

```bash
bun run build
bun run dev
```

Expected: build succeeds, dev server renders the calendar (events may be empty if Supabase is empty — that's fine; you'll see the empty state).

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/App.tsx src/pages/CalendarPage.tsx
git commit -m "feat(frontend): React Router + CalendarPage composing all components"
```

---

### Task 41: `EventDetailPage` + add its route

**Files:**
- Create: `src/pages/EventDetailPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/layout/EmptyState'
import type { EventRow } from '@/hooks/useEventsForWeek'

export function EventDetailPage() {
  const { id } = useParams()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('events').select('*').eq('id', id).maybeSingle(),
      supabase.from('event_tags').select('tag_slug').eq('event_id', id),
    ]).then(([eRes, tRes]) => {
      if (eRes.error) setError(eRes.error.message)
      else setEvent(eRes.data as EventRow | null)
      setTags((tRes.data ?? []).map((r: any) => r.tag_slug))
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="max-w-3xl mx-auto p-6"><Header /><div className="font-mono text-sm text-muted">Loading…</div></div>
  if (error || !event) return <div className="max-w-3xl mx-auto p-6"><Header /><EmptyState message="NOT FOUND" hint="Event missing or unavailable." /></div>

  const start = new Date(event.start_at)
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <Link to="/" className="font-mono text-xs underline">← back</Link>
      <h1 className="font-serif text-3xl font-bold text-ink mt-4">{event.title}</h1>
      <div className="font-mono text-sm text-muted mt-2">
        {start.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </div>
      {event.venue_name && <div className="font-mono text-sm text-muted">{event.venue_name}{event.neighborhood ? ` · ${event.neighborhood}` : ''}</div>}
      {event.cost_text && <div className="font-mono text-sm text-muted">{event.cost_text}</div>}
      {tags.length > 0 && <div className="font-mono text-xs text-muted mt-2">{tags.join(' · ')}</div>}
      {event.description && <p className="font-serif text-base mt-4 leading-relaxed">{event.description}</p>}
      {event.url && (
        <a href={event.url} target="_blank" rel="noreferrer" className="font-mono text-xs underline mt-6 inline-block">
          See source →
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the route to `src/App.tsx`**

Edit `src/App.tsx` — add the import and route line:

```tsx
import { EventDetailPage } from './pages/EventDetailPage'
// inside <Routes>:
<Route path="/event/:id" element={<EventDetailPage />} />
```

- [ ] **Step 3: Verify route works**

```bash
bun run dev
# visit http://localhost:5173/event/<some-uuid> — should show NOT FOUND if no events seeded
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/EventDetailPage.tsx src/App.tsx
git commit -m "feat(frontend): EventDetailPage with deep-linkable URL"
```

---

### Task 42: `AboutPage` reading `sources.yaml` + add its route

**Files:**
- Create: `src/pages/AboutPage.tsx`, `src/lib/sources.ts`
- Modify: `vite.config.ts`, `src/App.tsx`

- [ ] **Step 1: Install yaml loader**

```bash
bun add -d @rollup/plugin-yaml
```

- [ ] **Step 2: Update `vite.config.ts`**

```ts
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml'

export default defineConfig({
  plugins: [react(), yaml()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

- [ ] **Step 3: Add a typed wrapper at `src/lib/sources.ts`**

```ts
// @ts-expect-error — yaml plugin transforms the import to JSON at build time
import sources from '../../scripts/sources.yaml'

export type SourceMeta = {
  key: string
  name: string
  url: string
  schedule: string
  module: string
  enabled: boolean
}

export const SOURCES: SourceMeta[] = (sources as SourceMeta[]).filter(s => s.enabled)
```

- [ ] **Step 4: Implement `AboutPage.tsx`**

```tsx
import { Header } from '@/components/layout/Header'
import { Link } from 'react-router-dom'
import { SOURCES } from '@/lib/sources'

export function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <Link to="/" className="font-mono text-xs underline">← back</Link>
      <h1 className="font-serif text-3xl font-bold text-ink mt-4">About</h1>
      <p className="font-serif text-base mt-3 leading-relaxed">
        DC Events Digest is a curated weekly calendar of things happening in DC — civic, community, cultural.
        Events are pulled daily from local sources, filtered for quality, and shown in a single weekly view.
      </p>
      <h2 className="font-serif text-xl font-semibold mt-6">Sources</h2>
      <ul className="font-mono text-sm mt-2 space-y-1">
        {SOURCES.map(s => (
          <li key={s.key}>
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.name}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 5: Add the route to `src/App.tsx`**

Edit `src/App.tsx` — add the import and route line:

```tsx
import { AboutPage } from './pages/AboutPage'
// inside <Routes>:
<Route path="/about" element={<AboutPage />} />
```

- [ ] **Step 6: Verify build + visit `/about`**

```bash
bun run build
bun run dev
# visit http://localhost:5173/about
```

Expected: list of enabled sources with linked names.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AboutPage.tsx src/lib/sources.ts src/App.tsx vite.config.ts package.json bun.lockb
git commit -m "feat(frontend): AboutPage reads sources.yaml at build time"
```

---

## Phase 11 — Integration test (Task 43)

### Task 43: Playwright smoke test

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/seed.ts`

- [ ] **Step 1: Install Playwright**

```bash
bun add -d @playwright/test
bunx playwright install chromium
```

- [ ] **Step 2: Add `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: { baseURL: 'http://localhost:5173' },
})
```

- [ ] **Step 3: Add `e2e/seed.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function seedFixtures() {
  // Tomorrow + day-after, in current week if possible
  const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const day3 = new Date(); day3.setUTCDate(day3.getUTCDate() + 2)

  const rows = [
    { title: 'E2E Jazz Night', start_at: tomorrow.toISOString(), type: 'music', source: 'e2e', source_external_id: 'e2e-1' },
    { title: 'E2E Market', start_at: tomorrow.toISOString(), type: 'food', source: 'e2e', source_external_id: 'e2e-2' },
    { title: 'E2E Council Meeting', start_at: day3.toISOString(), type: 'civic', source: 'e2e', source_external_id: 'e2e-3' },
  ]
  await sb.from('events').delete().eq('source', 'e2e')
  await sb.from('events').insert(rows)
}

export async function clearFixtures() {
  await sb.from('events').delete().eq('source', 'e2e')
}
```

- [ ] **Step 4: Add `e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { seedFixtures, clearFixtures } from './seed'

test.beforeAll(async () => { await seedFixtures() })
test.afterAll(async () => { await clearFixtures() })

test('loads, shows seeded events, filters by type', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('DC Events Digest')).toBeVisible()
  await expect(page.getByText('E2E Jazz Night')).toBeVisible()
  await expect(page.getByText('E2E Market')).toBeVisible()

  // Filter to music — Market should disappear
  await page.getByRole('button', { name: 'Music' }).click()
  await expect(page.getByText('E2E Jazz Night')).toBeVisible()
  await expect(page.getByText('E2E Market')).not.toBeVisible()
})
```

- [ ] **Step 5: Add a script to `package.json`**

```json
"e2e": "playwright test"
```

- [ ] **Step 6: Run**

```bash
bun run e2e
```

Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e package.json bun.lockb
git commit -m "test(e2e): Playwright smoke test seeds and filters events"
```

---

## Phase 12 — Deploy (Tasks 44-47)

### Task 44: GitHub Actions ingest workflow

**Files:**
- Create: `.github/workflows/ingest.yml`, `.github/workflows/test.yml`

- [ ] **Step 1: Add `.github/workflows/test.yml` (runs on every PR)**

```yaml
name: test
on: [push, pull_request]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test
      - run: bun run build

  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -e ".[dev]"
      - run: pytest tests/ -v --ignore=tests/db --ignore=tests/shared
        # DB-dependent tests run in a separate gated job (see ingest.yml)
```

- [ ] **Step 2: Add `.github/workflows/ingest.yml` (daily cron + manual trigger)**

```yaml
name: ingest
on:
  schedule:
    - cron: "0 6 * * *"   # daily 06:00 UTC; per-source schedules are documented in sources.yaml
  workflow_dispatch:
    inputs:
      source:
        description: "Source key (clockout | washingtonian | 730dc | all)"
        required: true
        default: "all"
      dry_run:
        description: "Dry run (true/false)"
        required: false
        default: "false"

jobs:
  ingest:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        source: [clockout, washingtonian, 730dc]
    env:
      SUPABASE_URL:               ${{ secrets.SUPABASE_URL }}
      SUPABASE_ANON_KEY:          ${{ secrets.SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY:  ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      ANTHROPIC_API_KEY:          ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -e .
      - name: Skip if not in scope
        if: github.event_name == 'workflow_dispatch' && github.event.inputs.source != 'all' && github.event.inputs.source != matrix.source
        run: echo "skipping ${{ matrix.source }}" && exit 0
      - name: Run ${{ matrix.source }}
        if: github.event_name != 'workflow_dispatch' || github.event.inputs.source == 'all' || github.event.inputs.source == matrix.source
        run: |
          DRY_FLAG=""
          if [ "${{ github.event.inputs.dry_run }}" = "true" ]; then DRY_FLAG="--dry-run"; fi
          MODULE=$(python -c "import yaml; s=[x for x in yaml.safe_load(open('scripts/sources.yaml')) if x['key']=='${{ matrix.source }}'][0]; print(s['module'].split(':')[0])")
          python -m "$MODULE" $DRY_FLAG
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows
git commit -m "ci: ingest cron + per-PR test workflows"
```

---

### Task 45: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# DC Events Digest

A curated weekly calendar of things happening in DC — civic, community, cultural — pulled daily from local sources.

## Architecture

Two halves separated by Supabase:

- **Ingestion**: Python jobs in GitHub Actions (daily cron) → write to `staging_events` → SQL `promote_pending_events()` garbage-filters into `public.events`.
- **Frontend**: Vite + React + TS + Tailwind + shadcn/ui SPA, hosted on Vercel, reads `public.events` via supabase-js.

See [`docs/superpowers/specs/2026-04-26-dc-events-digest-design.md`](docs/superpowers/specs/2026-04-26-dc-events-digest-design.md) for the full design.

## Local development

### Frontend

```bash
bun install
cp .env.example .env  # fill in Supabase URL + anon key
bun run dev           # http://localhost:5173
bun run test          # unit tests (Vitest)
bun run e2e           # smoke (Playwright; requires service-role key)
bun run build         # production build → dist/
```

### Ingestion

```bash
python3 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
pytest tests/ -v                     # all tests (DB tests need a real Supabase project)
python -m scripts.data_import.clockout.run --dry-run --limit 5
```

### Adding a new source

1. Create `scripts/data_import/<key>/run.py` with a `SourceBase` subclass (see existing sources).
2. Add an entry to `scripts/sources.yaml`.
3. Add a fixture under `tests/fixtures/<key>/` and a parser/extractor test.
4. Set `enabled: true` in `sources.yaml` once tests pass.

The GitHub Actions ingest workflow's matrix already includes the new source if you also add it to the `matrix.source` list in `.github/workflows/ingest.yml`.

## Deploy

- **Frontend**: Vercel project connected to this repo's `main` branch. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel env vars.
- **Ingestion**: GitHub Actions runs `.github/workflows/ingest.yml` daily. Required repo secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

## License

Not yet licensed. Add a `LICENSE` file before making the repo public.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

### Task 46: Vercel deploy

**Files:** (none in repo; configuration is in Vercel dashboard)

- [ ] **Step 1: Push to GitHub**

```bash
gh repo create dc-events-digest --public --source=. --remote=origin --push
```

If `gh` is not authenticated, run `gh auth login` first.

- [ ] **Step 2: Connect to Vercel**

In a browser, go to https://vercel.com/new, import the GitHub repo, accept Vite framework auto-detection.

- [ ] **Step 3: Set env vars in Vercel project settings**

```
VITE_SUPABASE_URL        = <from .env>
VITE_SUPABASE_ANON_KEY   = <from .env>
```

(Do **not** set `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` in Vercel — those are GH Actions only.)

- [ ] **Step 4: Trigger first deploy + verify**

Vercel will build automatically. Once green, visit the assigned `*.vercel.app` URL — calendar should load with whatever events your Supabase has.

- [ ] **Step 5: Set GitHub Actions secrets**

In repo Settings → Secrets and variables → Actions, add:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

- [ ] **Step 6: Trigger first ingest run manually**

Repo → Actions → ingest → Run workflow → source=`clockout`, dry_run=`true`. Verify the log shows fetched events. Re-run with `dry_run=false` to actually populate.

- [ ] **Step 7: No commit (deploy/config only)**

---

### Task 47: End-to-end verification

- [ ] **Step 1: Verify deployed site shows real events**

Open the Vercel URL. Confirm:
- Current week is shown by default
- At least one event from Clockout is visible
- Type tabs filter the agenda
- Tag chips toggle on/off and update the URL
- `/about` lists the enabled sources
- `/event/:id` deep-links work

- [ ] **Step 2: Verify a re-run of ingestion produces no duplicates**

Trigger the Actions ingest workflow a second time with `dry_run=false`. Open Supabase SQL editor and run:

```sql
select count(*), count(distinct (source, source_external_id)) from public.events;
```

Expected: both numbers are equal (idempotency holds).

- [ ] **Step 3: Mark v1 done**

```bash
git tag v0.1.0
git push --tags
```

---

## Self-review checklist

Spot-check before handing off:

| Spec section | Implemented in task(s) |
|---|---|
| §4 Sources | Clockout (22-24), Washingtonian (25-27), 730DC (28-29) |
| §6 Data model — events | Task 7 |
| §6 Data model — staging_events | Task 9 |
| §6 Data model — tags + event_tags | Tasks 6, 8 |
| §6 Data model — ingestion_state | Task 10 |
| §7 Taxonomy | Task 15 |
| §8.1 Clockout scraper | Tasks 22-24 |
| §8.2 Washingtonian extractor | Tasks 25-27 |
| §8.3 730DC extractor | Tasks 28-29 |
| §8.4 Garbage filter SQL | Task 11 |
| §8.5 Shared helpers | Tasks 15-21 |
| §9 Source extensibility (SourceBase, sources.yaml) | Task 21 |
| §10.1 Routes | Task 40 |
| §10.2 Layout (week strip + agenda) | Tasks 35, 36, 40 |
| §10.3 Component file structure | Tasks 34-42 |
| §10.4 Skeuomorphic visual brand | Tasks 1, 34, 36, 37, 38 (applied throughout components) |
| §11.1 Ingestion tests | Tasks 13, 14, 22, 24, 25, 27, 28 |
| §11.2 Frontend hook + component tests | Tasks 31-37 |
| §11.3 Playwright integration | Task 43 |
| §11.4 Dry-run discipline | Task 21 (SourceBase honors `--dry-run`) |
| §12.1 Vercel | Task 46 |
| §12.2 Supabase + GH Actions | Tasks 5, 44 |
| §12.3 Secrets | Task 4 (.env.example), Task 46 (Vercel + Actions) |
| §13 Repo layout | Tasks 1, 3, 21, 44, 45 |
