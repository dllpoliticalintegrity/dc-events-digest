# DC Events Digest

A curated weekly calendar of things happening in DC — civic, community, cultural — pulled daily from local sources.

## Architecture

Two halves separated by Supabase:

- **Ingestion**: Python jobs in GitHub Actions (daily cron) → write to `staging_events` → SQL `promote_pending_events()` garbage-filters into `public.events`.
- **Frontend**: Vite + React + TS + Tailwind + shadcn/ui SPA, served as static assets by a Cloudflare Worker, reads `public.events` via supabase-js.

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
   If the source tracks a cursor, persist it in `on_success()` (called after a real run has staged
   and promoted), not in `fetch()`, so failed runs retry and `--dry-run` stays read-only.
2. Add an entry to `scripts/sources.yaml`.
3. Add a fixture under `tests/fixtures/<key>/` and a parser/extractor test.
4. Set `enabled: true` in `sources.yaml` once tests pass.

The GitHub Actions ingest workflow's matrix already includes the new source if you also add it to the `matrix.source` list in `.github/workflows/ingest.yml`.

## Deploy

- **Frontend**: Cloudflare Worker `dc-events-digest` (static assets, SPA fallback; config in `wrangler.jsonc`).
  `.github/workflows/deploy.yml` builds and deploys on every push to `main`. Required repo secrets:
  `CLOUDFLARE_API_TOKEN` (Account API token with the *Edit Cloudflare Workers* template),
  `CLOUDFLARE_ACCOUNT_ID`, plus `SUPABASE_URL` and `SUPABASE_ANON_KEY` (inlined into the bundle as `VITE_*`).
  The first deploy publishes at `https://dc-events-digest.<account-subdomain>.workers.dev`; add a custom domain
  under the Worker's Settings → Domains & Routes. To deploy by hand: `wrangler login` then `bun run deploy`.
- **Ingestion**: GitHub Actions runs `.github/workflows/ingest.yml` daily. Required repo secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
  The workflow fails fast with a `Missing repository secrets` error if any are unset. Apply the
  migrations in `supabase/migrations/` to the target project before the first run. If GitHub has
  disabled the schedule (Actions → ingest → "Enable workflow"), re-enable it, then run it manually
  with `workflow_dispatch` (`source=730dc`, `dry_run=true`) to check the pipeline before the next cron.

## License

Not yet licensed. Add a `LICENSE` file before making the repo public.
