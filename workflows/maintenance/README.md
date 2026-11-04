# Weekly customer-proof maintenance

Vercel Cron invokes one authenticated route every Monday at 15:00 UTC. The
route starts a durable Workflow and returns immediately; Exa, AI, and database
work runs inside retry-safe `'use step'` functions.

The route requires `Authorization: Bearer $CRON_SECRET`, which Vercel Cron adds
automatically when the project has `CRON_SECRET` configured.

## Safety boundaries

- Vercel customer proof is stored separately from prospect evidence and cannot
  contribute scoring points. Extracted wording remains a candidate claim until
  a later reviewed catalog change explicitly approves it.
- Cloudflare and Railway stories are stored as competitive context with no
  approved outreach claims.
- Source URLs must be returned by Exa and must belong to the expected official
  domain before an item is persisted.

The active product catalog remains code-owned in `lib/catalog/products.ts`.
Updating it requires a reviewed code change.
