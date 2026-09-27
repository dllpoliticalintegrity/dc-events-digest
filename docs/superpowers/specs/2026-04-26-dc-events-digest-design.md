# DC Events Digest — Design Spec

**Date:** 2026-04-26
**Status:** Draft (awaiting user review)
**Project:** `dc-events-digest` — a curated calendar of "things happening in DC" pulled from local sources.

---

## 1. Goal

A public, browse-only web calendar of local DC events (civic + community + cultural) aggregated from a small set of named sources. Users land on the current week, see a 7-day strip with a per-day agenda below, and filter by event type and tags. No sign-in. No personalization. v1 ships fast and is easy to extend with more sources later.

## 2. Non-goals (v1)

- No user accounts, no saved-events, no email/push digests.
- No mobile app wrapper (Capacitor) — web only; can be added later.
- No event submission UI — sources only.
- No payment, ticketing, or booking integrations.
- No map view (location is freeform text in v1).
- No real-time / sub-daily updates — daily ingestion cron.

## 3. Scope: events covered

Broad DC life: civic events (ANC meetings, hearings, town halls), community events, and cultural/things-to-do (music, food, arts, outdoors, markets, festivals, talks).

## 4. Sources (v1)

| Key | Name | URL | Ingestion shape |
|---|---|---|---|
| `clockout` | Clockout DC | `https://www.clockoutdc.com/events` | HTML scraper (BeautifulSoup; Playwright fallback) |
| `washingtonian` | Washingtonian — Things to Do | `https://washingtonian.com/sections/things-to-do/` | RSS → article fetch → LLM extractor |
| `730dc` | 730DC | Published Google Doc URL | HTML fetch of `/pub` view → LLM extractor |
| `rhizome` | Rhizome DC | `https://www.rhizomedc.org/new-events?format=json` | Squarespace collection JSON (no LLM) |
| `sixthandi` | Sixth & I | `https://www.sixthandi.org/wp-json/tribe/events/v1/events` | The Events Calendar REST API (no LLM) |
| `unionmarket` | Union Market | `https://unionmarketdc.com/wp-json/tribe/events/v1/events` | The Events Calendar REST API (no LLM) |
| `imp` | I.M.P. venues (9:30 Club, The Anthem, Lincoln Theatre, The Atlantis) | venue home pages | HTML card scraper; date from Ticketmaster URL (no LLM) |

**MigenteDMV is intentionally deferred** (returned 403 to direct fetch — needs alternative approach not worth blocking v1 on).

The architecture treats sources as plugins (see §9). Adding source #4, #5, #N is a one-folder + one-yaml-entry change.

## 5. Architecture overview

```
SOURCES                  GH ACTIONS (daily cron)              SUPABASE                 FRONTEND
──────                   ───────────────────────              ─────────                ────────
Clockout DC ─── scrape ─→ python scrapers/         ──────→  staging_events  ──┐
Washingtonian ─ LLM    ─→ python extractors/       ──────→  staging_events    ├─→  garbage filter (SQL fn)
730DC (gdoc) ── LLM    ─→ python extractors/       ──────→  staging_events  ──┘         │
                                                                                         ↓
                                                                                   public.events  ←── Vite/React app
                                                                                   public.event_tags     (anon SELECT)
                                                                                   public.tags
```

Two halves separated by Supabase:

- **Ingestion half**: Python jobs run on GitHub Actions daily, write raw candidates to a `staging_events` table, then call a Postgres function that promotes survivors into `public.events`.
- **Frontend half**: Vite + React + TypeScript + Tailwind + shadcn/ui SPA. Reads `public.events` directly via supabase-js with the `anon` key. Hosted on Vercel.

## 6. Data model

All public tables have RLS enabled.

```sql
-- staging: raw candidates from ingestion, never read by frontend
create table staging_events (
  id                   uuid primary key default gen_random_uuid(),
  source               text not null,        -- 'clockout' | 'washingtonian' | '730dc'
  external_id          text not null,        -- stable hash from source (url + title + date)
  raw_payload          jsonb not null,       -- whatever the scraper/extractor produced
  extracted_at         timestamptz not null default now(),
  status               text not null default 'pending',
                                             -- 'pending' | 'approved' | 'rejected' | 'duplicate'
  reject_reason        text,                 -- 'past_date' | 'missing_required' | 'bad_datetime'
                                             --  | 'editorial_mention' | 'duplicate' | 'low_confidence'
  promoted_event_id    uuid references events(id),
  unique (source, external_id)
);
-- service_role only; no anon access

-- public events shown on the calendar
create table events (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  description          text,
  start_at             timestamptz not null,
  end_at               timestamptz,          -- null = unknown duration
  is_all_day           boolean not null default false,
  type                 text not null,        -- one of the canonical 6 types (see §7)
  venue_name           text,
  venue_address        text,
  neighborhood         text,                 -- freeform for v1
  url                  text,                 -- "see source" link
  source               text not null,
  source_external_id   text not null,
  cost_text            text,                 -- 'Free' | '$15' | '$10-25'
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, source_external_id)
);
-- anon: SELECT only
-- service_role: full

create table tags (
  slug   text primary key,                   -- 'free' | 'outdoor' | '21+' | ...
  label  text not null
);
-- anon: SELECT only

create table event_tags (
  event_id uuid references events(id) on delete cascade,
  tag_slug text references tags(slug),
  primary key (event_id, tag_slug)
);
-- anon: SELECT only

-- per-source ingestion bookkeeping (last successful run, last-seen cursor, etc.)
create table ingestion_state (
  source         text primary key,
  last_run_at    timestamptz,
  last_cursor    text,                       -- e.g. RSS pub_date watermark
  last_status    text,                       -- 'ok' | 'failed'
  last_error     text
);
-- service_role only; no anon access
```

**Idempotency contract:** `(source, external_id)` is the upsert key on `staging_events`; `(source, source_external_id)` on `events`. Re-running a scraper produces the same DB state.

**Past-event handling:** kept in DB. Frontend filters `start_at >= now() - interval '1 day'` (small buffer for ongoing events). No archive job.

## 7. Taxonomy

**Type (single-pick, required):** one of:

`music` · `food` · `arts` · `outdoors` · `civic` · `community`

**Tags (multi-pick, optional):**

`free` · `ticketed` · `outdoor` · `21+` · `family` · `accessible` · `weekend` · `happy-hour`

The taxonomy lives in **one** canonical place: `scripts/shared/taxonomy.py`. It is the source of truth used by:
- The LLM extractor prompt template
- A `tags` table seeder script
- The frontend (via generated TypeScript types)

Adding a 7th type or 9th tag = one edit + regenerate types + redeploy.

## 8. Ingestion

### 8.1 Clockout DC scraper

- Fetch `/events` with `requests` + a real User-Agent header.
- Parse with `BeautifulSoup`. Selectors recorded as constants at top of `run.py`. If the site is JS-rendered, fall back to `playwright`.
- Per card: extract `title`, `start_at`, `venue_name`, `url`, raw description.
- `external_id` = SHA1 of `(url + start_at_iso)`.
- Default classification: `type` from a small keyword map; tags from keyword presence.
- Upsert to `staging_events`.

### 8.2 Washingtonian Things to Do extractor

- Fetch the section RSS feed (`/sections/things-to-do/feed/`).
- Track last-seen `pub_date` per source in a small `ingestion_state` table.
- For each new article, fetch the full HTML, strip to readable text.
- Send article text to **Claude Sonnet 4.6** with a structured-output prompt (template in `scripts/shared/extraction.py`):
  > Extract every individual event mentioned. For each, return JSON: `title`, `start_at` (ISO 8601, assume ET if no TZ), `end_at`, `venue_name`, `neighborhood`, `type` (one of: music/food/arts/outdoors/civic/community), `tags` (subset of the canonical tag list), `cost_text`, `source_url`. If the article is general commentary with no concrete event, return `{"events": []}`. Never invent dates.
- Each extracted event → `staging_events`, `external_id` = SHA1 of `(article_url + extracted_title + start_at_iso)`.
- `--limit N` caps LLM calls per run; first runs are cheap.

### 8.3 730DC newsletter extractor

- Newsletter is published as a public Google Doc with "Publish to web" enabled. Fetch the **published** version (`/pub`), which returns plain HTML — avoids auth.
- The doc is 730DC's *Weekly Scheduler*, re-published in place (day headings like "Wednesday, September 23" with no year, plus M/D long-tail dates). The prompt tweak passes the fetch date so the model can resolve year-less dates, and flags time-less "Also ||" items as all-day.
- Cursor = SHA1 of the doc's readable text (the doc has no publication date); saved in `on_success()` only after a real run stages and promotes.
- `external_id` = SHA1 of `(extracted_title + start_at_iso)` — independent of the fetch date, so re-fetching an unchanged doc updates rows instead of duplicating them.

### 8.4 Garbage filter (`promote_pending_events()` SQL function)

Runs at the end of every ingestion job. For each `pending` row in `staging_events`:

| Reject reason | Rule |
|---|---|
| `past_date` | `start_at < now() - interval '1 day'` |
| `missing_required` | `title is null/empty OR start_at is null` |
| `bad_datetime` | `start_at > now() + interval '2 years'` (LLM hallucination guard) |
| `editorial_mention` | title matches "open call", "submissions", "now hiring", "applications open", etc. |
| `duplicate` | already in `events` by `(source, source_external_id)` OR fuzzy match (same date + similar title via `pg_trgm`) |
| `low_confidence` | `raw_payload->>'confidence' < 0.7` (opt-in, used only by sources that emit a confidence score) |

Survivors → `INSERT INTO events ... ON CONFLICT (source, source_external_id) DO UPDATE`. Also sets `staging_events.status = 'approved'` and `promoted_event_id`. Rejected rows stay in staging with `status = 'rejected'` and `reject_reason` for audit.

### 8.5 Shared helpers

```
scripts/shared/
├── source.py        # SourceBase: dry-run gating, limits, logging, staging upserts, promote call
├── supabase.py      # get_supabase_client() returning service_role client
├── extraction.py    # Anthropic SDK wrapper + structured-output prompt template
├── dates.py         # ET-aware datetime parsing (Sat 5pm → next Saturday 17:00 ET)
├── staging.py       # upsert_staging(source, external_id, payload), call_promote_pending()
├── dedupe.py        # fuzzy-match helpers shared by SQL function and pre-checks
└── taxonomy.py      # canonical TYPES, TAGS lists
```

## 9. Source extensibility

Designed in from day one — adding a source must not touch shared code.

### 9.1 Plugin contract

Each source is a self-contained module under `scripts/data-import/<source>/` exposing one class:

```python
from scripts.shared.source import SourceBase

class ClockoutSource(SourceBase):
    source_key = "clockout"
    schedule = "0 6 * * *"

    def fetch(self) -> list[RawCandidate]:
        """Return source-shaped data."""
        ...

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        """Convert one raw chunk into 0..N event candidates."""
        ...

if __name__ == "__main__":
    ClockoutSource().run(dry_run=..., limit=...)
```

`SourceBase.run()` handles: dry-run gating, limit enforcement, logging, `staging_events` upserts, calling `promote_pending_events()`, emitting metrics.

### 9.2 Source registry

Single source of truth at `scripts/sources.yaml`:

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
  enabled: true

- key: 730dc
  name: "730DC"
  url: "https://docs.google.com/document/.../pub"
  schedule: "0 7 * * *"
  module: "scripts.data_import.dc730.run:DC730Source"
  enabled: true
```

Used by:
- The GH Actions matrix workflow (one job per enabled source — no workflow edits to add a source).
- The frontend's `/about` page source list (read at build time, displayed with attribution).
- `scripts/list_sources.py` debug helper.

### 9.3 Schema is source-agnostic

`events.source` and `staging_events.source` are plain strings, not enums. Adding a source requires zero schema migration. The garbage filter rules are likewise source-agnostic.

### 9.4 Out-of-scope-for-cheap

These additions would require beyond-trivial work (call out at the time):

- **Auth-walled sources** (Eventbrite-private, paid APIs) — needs per-source secret management.
- **High-frequency sources** (real-time webhooks, sub-hourly polling) — daily cron pattern would need rework.
- **Sources with no stable `external_id`** — need tighter fuzzy-match thresholds per source.

## 10. Frontend

### 10.1 Routes (SPA)

| Route | Purpose |
|---|---|
| `/` | Calendar — defaults to current week, today selected |
| `/week/:isoDate` | Explicit week start (e.g. `/week/2026-04-26`) |
| `/event/:id` | Event detail page (deep-linkable, shareable) |
| `/about` | What this is + source attribution from `sources.yaml` |

Filter state serializes to query params (`?type=music&tags=free,outdoor`) — shareable, browser back/forward works.

### 10.2 Layout

```
┌─────────────────────────────────────────────────────────┐
│  DC Events Digest                          [About]      │
├─────────────────────────────────────────────────────────┤
│  [All] [Music] [Food] [Arts] [Outdoors] [Civic] [Comm.] │  ← type tabs (single-pick)
│  free · ticketed · outdoor · 21+ · family · weekend     │  ← tag chips (multi-pick)
├─────────────────────────────────────────────────────────┤
│  ◂  Apr 21 — Apr 27, 2026  ▸                            │
│  ┌──┬──┬──┬──┬──┬──┬──┐                                 │
│  │M │T │W │T │F │S●│S │  ← week strip (mini-pages)      │
│  │21│22│23│24│25│26│27│    selected day = red border    │
│  └──┴──┴──┴──┴──┴──┴──┘                                 │
├─────────────────────────────────────────────────────────┤
│  — APR 26 · 3 EVENTS —                                  │  ← typographic divider
│  ┃ Jazz in the Garden                                    │
│  ┃ 5pm · Sculpture Garden · free · outdoor               │
│  ┃ Eastern Market                                        │
│  ┃ 9am · Capitol Hill                                    │
│  ┃ ANC 1A Public Meeting                                 │
│  ┃ 10am · Columbia Heights · civic                       │
└─────────────────────────────────────────────────────────┘
```

Mobile (≤768px): week strip stays (compact); tag chips horizontal-scroll; agenda full-width.

**Default state:** all types, no tags, current week, today selected.

**Empty states:**
- Filter mismatch: "No events match your filters this week. [Clear filters]"
- No data yet: big "NO EVENTS" rubber stamp + "check back tomorrow"

### 10.3 Component file structure

```
src/
├── pages/
│   ├── CalendarPage.tsx       # composes the whole calendar
│   ├── EventDetailPage.tsx
│   └── AboutPage.tsx
├── components/
│   ├── calendar/
│   │   ├── WeekStrip.tsx      # 7 mini-pages + density bars
│   │   ├── Agenda.tsx         # day-grouped event list
│   │   ├── EventCard.tsx      # one event in the agenda
│   │   ├── DayHero.tsx        # large tear-off page (selected day)
│   │   └── WeekNav.tsx        # ◂ ▸ + jump-to-date
│   ├── filters/
│   │   ├── TypeTabs.tsx       # single-pick rubber-stamp tabs
│   │   └── TagChips.tsx       # multi-pick rubber-stamp chips
│   └── layout/
│       ├── Header.tsx
│       └── EmptyState.tsx
├── hooks/
│   ├── useEventsForWeek.ts    # supabase query + filter application
│   └── useFilterState.ts      # URL <-> filter state sync
└── lib/
    ├── supabase.ts            # anon client
    ├── types.ts               # generated from generate_typescript_types
    └── dates.ts               # week-of helpers
```

Each file holds one responsibility; nothing exceeds ~150 lines without a strong reason.

### 10.4 Visual brand: skeuomorphic page-a-day desk block

A complete pivot from anything political — the surface should feel like a 1960s desk artifact.

- **Type:** Georgia (display + body), JetBrains Mono (metadata, stamps, labels).
- **Palette:** paper cream `#fafaf5`, ink `#1a1a1a`, stamp red `#cc3333`, muted gray `#888`.
- **Hero element:** large tear-off "page" for the selected day — day name in a red band, huge serif numeral, dashed perforation edge, slight shadow + 2px red offset for depth.
- **Week strip:** row of 7 mini-pages above the hero. Selected day = red border. Density bars hint type/count.
- **Type tabs:** red rubber stamps. Active = red border + red text; inactive = gray border + gray text. Slight rotation per stamp for skeuomorphic feel.
- **Tag chips:** smaller stamps, muted gray.
- **Event cards:** white index-card style with a colored left border per type; serif title + monospace metadata.
- **Section dividers:** typographic — `— APR 26 · 3 EVENTS —`.
- **Loading:** blinking typewriter cursor.
- **Empty state:** big "NO EVENTS" rubber stamp.

shadcn/ui components are used as scaffolding (focus management, accessibility), then restyled to fit the skeuomorphic system. No default shadcn aesthetic visible.

## 11. Testing

Three layers, scaled to risk.

### 11.1 Ingestion (highest risk)

- **Scrapers** — fixture-based. Real Clockout HTML at `tests/fixtures/clockout/<date>.html`. Test parser against fixtures, not the live site. Add a fixture whenever the format changes.
- **LLM extractors** — fixture article text → mocked Anthropic response → assertion on parsed structured output. Don't test Claude itself; test prompt assembly + response parsing + validation. One real-LLM end-to-end test gated behind `RUN_LLM_TESTS=1` (off in CI by default).
- **Garbage filter** — pgTAP or Python tests that seed staging rows then assert what ends up in `events` vs. what's marked rejected with which `reject_reason`. One test per reject rule, plus a happy-path promote test.
- **Idempotency** — for each source: run twice against the same fixture, assert identical DB state. Non-negotiable.

### 11.2 Frontend (medium risk)

- **Hook tests** (Vitest + RTL) — `useEventsForWeek`, `useFilterState`. Filter logic in isolation. URL serialize/deserialize round-trips.
- **Component tests** — render with sample data, assert what's on screen, assert click → state updates. Mock the hook output; no Supabase in component tests.
- **No snapshot tests** for the visual layer. Use a `/dev/components` route during development for eyeball checks.

### 11.3 Integration

- One Playwright smoke test on PR. Local Vite + `supabase start`, seed 3-5 fixture events, load `/`, assert agenda shows them, click a type filter, assert agenda updates, click a day, assert agenda re-anchors.

### 11.4 Dry-run discipline

Every ingestion script supports `--dry-run` (logs what it *would* upsert; touches no DB). First run of any new script is `--dry-run --limit 5`. The `data-pipeline-validator` agent gates this — it blocks scripts missing a dry-run flag.

## 12. Deploy & ops

### 12.1 Frontend hosting

- **Vercel.** Connect GitHub repo. Auto-deploy `main`. Preview deploys on PRs. Free tier covers v1.
- Build: `bun run build`. Output: `dist/`.
- Env vars in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (both safe to ship; RLS protects everything).

### 12.2 Backend (data + ingestion)

- **Supabase project** (free tier). Single project, single env for v1; add a Supabase branch when staging is needed.
- Schema lives in `supabase/migrations/`, applied via Supabase MCP (`apply_migration`). After every schema change run `generate_typescript_types`.
- **Ingestion** runs in **GitHub Actions**. One workflow `ingest.yml` with a matrix per enabled source from `scripts/sources.yaml`. Daily cron per source. `workflow_dispatch` enabled for manual triggers.

### 12.3 Secrets

| Secret | Lives in | Used by |
|---|---|---|
| `SUPABASE_URL` | GH Actions secrets + Vercel env (`VITE_SUPABASE_URL`) | Both |
| `SUPABASE_ANON_KEY` | GH Actions secrets + Vercel env (`VITE_SUPABASE_ANON_KEY`) | Both |
| `SUPABASE_SERVICE_ROLE_KEY` | GH Actions secrets only | Ingestion jobs only — **never** in Vercel, never in frontend bundle |
| `ANTHROPIC_API_KEY` | GH Actions secrets only | Washingtonian + 730DC LLM jobs only |

`.env.example` checked in. Real `.env` is gitignored. The `block-env.sh` PreToolUse hook prevents accidental edits.

### 12.4 Observability (lightweight v1)

- **Frontend**: Vercel Analytics (free tier). No Sentry until there's a real issue rate to track.
- **Ingestion**: GH Actions logs are the audit trail. Each `run.py` emits a one-line summary at end: `source=clockout fetched=42 staged=12 approved=10 rejected=2 reasons={past_date:1, duplicate:1}`. Failed runs trigger Actions email.
- **Supabase**: built-in logs panel. The `staging_events` table itself is the audit trail for the garbage filter — query any time for "what got rejected last week and why."

### 12.5 Cost (monthly, v1)

| Service | Cost |
|---|---|
| Vercel (hobby) | $0 |
| Supabase (free) | $0 |
| GitHub Actions | $0 (public repo or ~150 free min/mo if private; ~5 min/day cron) |
| Anthropic (Sonnet 4.6) | ~$3-8 (~30 articles/day × ~2K input tokens) |
| **Total** | **<$10/mo** |

### 12.6 Domain

- v1: `dc-events-digest.vercel.app`.
- Future: bring a real domain — Vercel handles DNS + cert automatically. Spec doesn't block on this.

## 13. Repo layout

```
~/dc-events-digest/
├── .github/workflows/
│   └── ingest.yml              # matrix per source from sources.yaml
├── src/                        # Vite + React frontend
├── supabase/
│   └── migrations/             # schema + RLS via Supabase MCP
├── scripts/
│   ├── sources.yaml            # source registry
│   ├── data-import/
│   │   ├── clockout/
│   │   ├── washingtonian/
│   │   └── dc730/
│   └── shared/
│       ├── source.py           # SourceBase
│       ├── supabase.py
│       ├── extraction.py       # Anthropic SDK + prompt template
│       ├── dates.py
│       ├── staging.py
│       ├── dedupe.py
│       └── taxonomy.py         # canonical type + tag lists
├── tests/
│   ├── fixtures/
│   │   ├── clockout/
│   │   ├── washingtonian/
│   │   └── dc730/
│   └── ...
├── docs/superpowers/
│   ├── specs/                  # this design doc
│   └── plans/                  # implementation plan (next)
├── .env.example
├── .gitignore                  # .env, *.csv, logs/, dist/, .superpowers/, __pycache__/
├── package.json                # bun
├── pyproject.toml              # ingestion deps
└── README.md
```

## 14. Open follow-ups (deliberately deferred)

- **MigenteDMV** — alternative ingestion path (Instagram, Eventbrite, manual workaround).
- **Saved events / sign-in** — adds Supabase Auth, `user_saved_events` with RLS.
- **Email/push digest** — separate project for the comms layer.
- **Map view** — needs neighborhood normalization first.
- **Capacitor wrapper** — when there's user demand for a native app.
- **Real domain** — when ready.
