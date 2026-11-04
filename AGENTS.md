<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# NextProspect — AI Agent Context

> Read this first. This file is a map, not the complete manual. It contains the
> rules that apply to every change and points to the smallest relevant document
> for deeper context. Keep implementation details in the linked docs so this
> file remains quick to load and hard to stale.

**What NextProspect is:** an account-level outbound planning tool for Vercel. It
turns public company evidence into ranked, product-specific opportunities, a
recommended buyer, and grounded draft outreach for human review. Read
[the product strategy](./docs/product/strategy.md) before making product, copy,
scoring, or workflow decisions.

`CLAUDE.md` delegates to this file. Edit `AGENTS.md`, not both.

## Stack — verify before changing

| Area | Current choice |
| --- | --- |
| App | Next.js 16.3 App Router, React 19.3, TypeScript |
| Durable execution | Vercel Workflow SDK 4.8 |
| AI | AI SDK 7 through Vercel AI Gateway |
| Research | Exa |
| Performance | PageSpeed Insights and CrUX |
| Data | Drizzle with Neon in hosted environments, PGlite locally |
| Review surfaces | Dashboard and optional Slack |
| Final handoff | Optional Gmail draft creation; never automatic sending |

Package versions in `package.json` are authoritative. Next.js APIs are not
assumed from memory: follow the generated rule block above and read the
relevant guide under `node_modules/next/dist/docs/` first.

## Rules that apply to every change

- **Use pnpm.** `pnpm-lock.yaml` is the committed lockfile. Do not introduce an
  npm or Yarn lockfile.
- **Nothing sends outreach automatically.** Approval changes state and may
  create a Gmail draft. A human still reviews and sends it. Preserve this
  boundary in UI copy, APIs, Slack actions, and integrations.
- **Public evidence is the only factual input to outreach.** Generated company
  claims must resolve to evidence-ledger IDs. Never infer private product use,
  contracts, spend, infrastructure, or internal plans.
- **Keep sensitive information out of prompts, logs, UI, and drafts.** Never
  print or commit `.env.local`, tokens, OAuth credentials, or database URLs.
- **Scoring stays deterministic.** The model proposes grounded signal matches;
  `lib/scoring.ts` owns weights, caps, freshness, and account-tier selection. Do not
  let prose generation decide the final numeric score.
- **The catalog is the product source of truth.** Add or reshape Vercel product
  motions in `lib/catalog/products.ts`, not in prompts or UI conditionals. Read
  [the catalog guide](./lib/catalog/README.md) first.
- **Existing Vercel use is expansion context, not account disqualification.**
  Suppress only an invalid hosting-migration motion. Other grounded product
  opportunities remain eligible.
- **Database changes are migrations.** Change `lib/db/schema.ts`, generate a
  new file under `drizzle/`, and commit both. Do not edit an applied migration.
  Read [the database guide](./lib/db/README.md) before schema or reset work.
- **Workflow steps must be durable and retry-safe.** Keep external work and
  persisted stage transitions inside `'use step'` functions. Read
  [the outbound workflow guide](./workflows/outbound/README.md) before changing
  orchestration.
- **Starting runs and recording decisions are privileged writes.** Preserve
  `RUN_SECRET` checks and approval-token validation. Reads are public only for
  the current demo form factor; this is not a multi-tenant authorization model.
- **Interface work follows the design standard.** Read
  [the interface design guide](./docs/design/interface.md) before creating or
  materially changing pages, components, interactions, or visual styles. Reuse
  Geist tokens and shared patterns, preserve accessibility, and verify both
  themes at desktop and mobile widths.
- **Verify in proportion to risk.** Run `pnpm check` for code changes and
  the scoped checks in [the verification guide](./docs/testing/verification.md).
  UI changes require actually opening the page in Chrome at desktop and mobile
  widths, clicking the affected interactions, and checking console errors.
- **Keep the local and remote gates aligned.** `pnpm verify` is the complete
  non-browser gate. `.github/workflows/ci.yml` runs the same checks on pull
  requests and pushes to `main`; update both when that contract changes.

## Where to look — progressive disclosure

### Product and sales behavior

- [docs/product/strategy.md](./docs/product/strategy.md) — user, problem,
  product boundaries, sales principles, regional behavior, and non-goals.
- [docs/architecture/grounding-and-scoring.md](./docs/architecture/grounding-and-scoring.md)
  — evidence ledger, LLM boundaries, deterministic scoring, citations, and
  safe drafting. Read before changing prompts, opportunity planning, scoring, or copy.

### Architecture and code ownership

- [docs/design/interface.md](./docs/design/interface.md) — required Geist design
  baseline, layout and interaction rules, accessibility, and UI verification.
- [docs/architecture/system.md](./docs/architecture/system.md) — request flow,
  module ownership, server/client boundaries, and the end-to-end data path.
- [workflows/outbound/README.md](./workflows/outbound/README.md) — durable stage
  order, retry behavior, status transitions, and workflow invariants.
- [lib/catalog/README.md](./lib/catalog/README.md) — product definitions,
  capabilities, signal rules, and the safe process for adding a product.
- [lib/db/README.md](./lib/db/README.md) — Neon/PGlite selection, migrations,
  schema ownership, resets, and production cautions.

### Testing and shipping

- [docs/testing/verification.md](./docs/testing/verification.md) — command
  matrix, browser QA, test scope, and what each check proves.
- [docs/shipping/deployment.md](./docs/shipping/deployment.md) — current Git to
  Vercel path, environment variables, migrations, release verification, and
  rollback cautions.
- [tests/README.md](./tests/README.md) — detector labels, fixture methodology,
  and limitations.

### Agent capabilities

- [docs/agent/skills.md](./docs/agent/skills.md) — repo-local skills and the
  optional runtime skills agents should select for database, Vercel, workflow,
  AI, and interface work.

### Operator setup

- [README.md](./README.md) — local setup, environment variable names, Slack,
  Gmail, CLI usage, and project overview.

## Documentation maintenance

- Update the owning doc in the same change when an invariant, command, stage,
  environment requirement, or deployment path changes.
- Prefer links over duplicating detailed instructions in `AGENTS.md`.
- Document current behavior, not planned behavior. Mark known gaps explicitly.
- Turn repeated review mistakes into tests or tooling when practical; prose is
  a soft boundary, not enforcement.
