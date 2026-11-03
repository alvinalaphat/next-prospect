# Weekly catalog and proof maintenance

Vercel Cron invokes two authenticated route handlers every Monday. Each route
starts a durable Workflow and returns immediately; Exa, AI, and database work
runs inside retry-safe `'use step'` functions.

## Schedules

- `14:00 UTC`: audit official Vercel docs, changelog, and product announcements;
- `15:00 UTC`: refresh Vercel, Cloudflare, and Railway customer stories.

Both routes require `Authorization: Bearer $CRON_SECRET`, which Vercel Cron
adds automatically when the project has `CRON_SECRET` configured.

## Safety boundaries

- The catalog audit stores matched products, possible changes, and candidate
  additions in `maintenance_runs`. It never edits `products.ts`, activates a
  scoring rule, or recycles a persisted product ID automatically.
- Vercel customer proof is stored separately from prospect evidence and cannot
  contribute scoring points. Extracted wording remains a candidate claim until
  a later reviewed catalog change explicitly approves it.
- Cloudflare and Railway stories are stored as competitive context with no
  approved outreach claims.
- Source URLs must be returned by Exa and must belong to the expected official
  domain before an item is persisted.

Product changes still require a reviewed code change to `lib/catalog/products.ts`.
The weekly audit exists to make that review current and explicit, not to let
unreviewed web content change sales behavior.
