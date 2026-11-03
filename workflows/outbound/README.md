# Outbound workflow

`workflowOutbound` is the durable, one-domain orchestration path. Read this
before changing `index.ts` or `steps.ts`.

## Stage order

```text
optional batch delay
  → detect website, Next.js, host, and DNS
  → measure mobile and desktop performance
  → research public account signals
  → assemble the shared evidence ledger
  → plan and score up to three product opportunities
  → for each opportunity: find buyer, research public buyer activity, attach
    customer proof and competitive context, rescore, draft, request review
  → stop at awaiting approval
```

The workflow does not wait for a decision. Dashboard and Slack routes record
decisions after the durable run reaches `awaiting_approval`.

## Durable execution rules

- Keep orchestration in the `'use workflow'` function and side-effecting or
  persisted stages in exported `'use step'` functions.
- Step inputs and outputs must be serializable.
- Make each step retry-safe. A retry must converge on the same prospect or
  opportunity state rather than duplicate externally visible work.
- Persist a status before or with meaningful work so the dashboard explains
  where a run is.
- Treat missing optional integrations as degradation, not permission to invent
  evidence.
- Reserve account status `error` and the `error` field for unexpected failure.
  A product candidate being suppressed is normal planner behavior.
- Keep batch staggering unless quota and concurrency behavior is deliberately
  redesigned and tested.

## Stage-specific behavior

### Detect

Uses a polite plain fetch plus DNS. It does not run a headless browser. Product
product eligibility is evaluated later, so being off Next.js or already on
Vercel does not stop the entire account. An unreachable site is recorded but
the current workflow still returns `stop: false`; change this only with an
explicit product decision.

### Performance

Runs mobile and desktop PSI in parallel and uses the cache in `lib/psi.ts`.
Quota errors use `RetryableError` with progressive delay. After the final
attempt, continue with empty performance evidence and an explanatory error.

### Research

The research agent may use Exa results only. `researchEvidence` drops items
whose URLs were not returned by tools. Missing or invalid Exa credentials
continue without research.

### Plan opportunities

The model proposes catalog rule matches. Deterministic code validates them,
scores them, removes candidates without product fit, deduplicates by product,
sorts by score, and keeps up to three.

### Enrich opportunity

Buyer discovery runs after the product angle is known. The presence of a named,
grounded buyer affects buyer-confidence points. A second grounded search may
add the selected buyer's recent public posts, blogs, talks, podcasts, or GitHub
activity to drafting context, but it does not change product ranking or scoring.
Relevant Vercel customer proof and competitor case studies are selected from
the refreshed proof library and stored on the opportunity. Competitive context
is never passed to drafting. Drafting receives only prospect/buyer evidence,
plus exact observed-host evidence for expansion copy when needed.

### Request review

Each opportunity receives its own approval token and status. Slack is optional;
the dashboard remains a valid review surface. Nothing sends automatically.

## When changing the workflow

1. Update this file if stage order, retry behavior, or a status invariant changes.
2. Run `pnpm typecheck` and `pnpm build`.
3. Run `pnpm eval` for planning or scoring changes.
4. Run `pnpm test:e2e` for opportunity, persistence, token, or decision changes.
5. Exercise a real local run when changing an external stage or its degradation path.
