# Database and migrations

The application uses one Drizzle schema against two PostgreSQL-compatible
backends:

- hosted or any environment with `DATABASE_URL`: Neon over the serverless HTTP
  driver;
- local development without `DATABASE_URL`: embedded PGlite at `./.pglite`, or
  the path in `PGLITE_PATH`.

Production throws when `DATABASE_URL` is missing. It never falls back to local
storage.

## Tables

- `prospects`: latest account-level workflow state, shared research, detection,
  performance, evidence, and legacy account-level draft fields.
- `opportunities`: product-specific angle, score, evidence IDs, buyer and
  attributable public activity, selected proof/context IDs, draft, approval
  state, and Slack/Gmail metadata.
- `psi_cache`: cached PageSpeed responses to reduce quota use.
- `maintenance_runs`: durable status and results for weekly catalog/proof jobs.
- `proof_records`: refreshed Vercel customer proof and competitor context;
  these records never contribute scoring points.

The opportunity is the unit of review. The prospect status is a dashboard-level
summary and must remain consistent with child decisions.

A brand-new run clears account-level detection, performance, research,
evidence, scoring, and legacy draft fields before it starts. A retry replacement
is different: it deliberately adopts only the failed run's persisted state and
transfers that run's opportunities to the replacement run ID in the same atomic
claim. `planning_complete` distinguishes a fully persisted product set from
partial planner writes; incomplete sets are cleared before the planner retries.

## Schema changes

1. Edit `lib/db/schema.ts`.
2. Run `pnpm db:generate` to create a new migration under `drizzle/`.
3. Review the generated SQL. Prefer additive and backwards-compatible changes.
4. Run the migration against an isolated local database.
5. Run relevant typecheck, build, scoring, and end-to-end checks.
6. Commit the schema and migration together.

Never edit or delete a migration that may have been applied. Add a follow-up
migration instead.

## Applying migrations

```bash
pnpm db:migrate
```

The script loads `.env.local`. If `DATABASE_URL` is set, it migrates that Neon
database; otherwise it migrates local `.pglite`. Always resolve and state the
target first. Do not use migration commands as an exploratory read.

## Resetting data

```bash
pnpm db:reset
```

This truncates `opportunities`, `prospects`, and `psi_cache` while preserving
the schema and migration history. It is destructive and follows the same
`DATABASE_URL` selection rule as migrations. Confirm the exact target before
running it.

For automated tests, prefer a temporary `PGLITE_PATH` and delete
`DATABASE_URL` in the test process, as `eval/e2e.ts` does.

## Query boundaries

- Keep database access in `lib/db/index.ts` or a clearly owned adjacent module.
- Use the typed Drizzle schema; do not duplicate row shapes by hand.
- Preserve stable domain normalization before reads and writes.
- Workflow retries may repeat writes, so prefer upserts or idempotent state
  transitions where the same logical stage can run again.
- Never log connection strings, row payloads containing secrets, or OAuth data.
