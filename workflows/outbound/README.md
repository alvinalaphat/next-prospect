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
  → search people once and assign a buyer to each opportunity
  → research public activity once per unique buyer and tailor it per opportunity
  → for each opportunity: attach customer proof and competitive context,
    rescore, draft, request review
  → stop at awaiting approval
```

The workflow does not wait for a decision. Dashboard and Slack routes record
decisions after the durable run reaches `awaiting_approval`.

An account-level failure exposes a protected **Try again** action. It expires any
still-reviewable opportunities, clears the failed account state, and starts the
same durable workflow from the beginning on the latest deployment. Within that
new run, Workflow SDK retries failed steps automatically. Planning retains an
explicit completion marker so a repeated planner step clears partial writes
instead of treating them as a complete product set.

## Durable execution rules

- Keep orchestration in the `'use workflow'` function and side-effecting or
  persisted stages in exported `'use step'` functions.
- Step inputs and outputs must be serializable.
- Make each step retry-safe. A retry must converge on the same prospect or
  opportunity state rather than duplicate externally visible work.
- Every new run clears prior account-stage data and owns newly created
  opportunities. Never transfer opportunities between run IDs.
- Persist a status before or with meaningful work so the dashboard explains
  where a run is.
- Treat missing optional integrations as degradation, not permission to invent
  evidence.
- Reserve account status `error` and the `error` field for unexpected failure.
  A product candidate being ineligible is normal planner behavior.
- Scope every step write to the owning `runId`, so an older or superseded run
  cannot overwrite the current account state.
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

Buyer discovery runs after every product angle is known. One combined people
search supplies candidates for all opportunities, then the model assigns the
best grounded buyer to each. The presence of a named buyer affects
buyer-confidence points. Public activity is searched once per unique selected
buyer and selected separately for each of that buyer's opportunities. It may
add recent posts, blogs, talks, podcasts, or GitHub activity to drafting
context, but it does not change product ranking or scoring.
Relevant Vercel customer proof and competitor case studies are selected from
the refreshed proof library and stored on the opportunity. Competitive context
is never passed to drafting. Drafting receives only prospect/buyer evidence,
the selected product context, and its approved catalog claims.
The account remains in a running state while these opportunities are enriched
and transitions once to `awaiting_approval` only after all of them are ready.
That final transition is conditional on the account still being in a processing
state, so it cannot overwrite an `approved` or `rejected` decision.

### Request review

Each opportunity receives its own approval token and status. Slack is optional;
the dashboard remains a valid review surface. Nothing sends automatically.

## When changing the workflow

1. Update this file if stage order, retry behavior, or a status invariant changes.
2. Run `pnpm check` and `pnpm build`.
3. Run `pnpm test` for planning, scoring, opportunity, persistence, token,
   or decision changes.
5. Exercise a real local run when changing an external stage or its degradation path.
