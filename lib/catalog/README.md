# Vercel product catalog

`products.ts` is the source of truth for the product surface NextProspect can
sell against. Prompts and UI should consume the catalog rather than maintain
their own product lists.

## Definition shape

A product definition owns:

- stable ID and display name;
- category and concise approved summary;
- target buyer roles;
- public signal rules with category, points, and optional freshness behavior;
- approved product claims; and
- whether it can create an independent opportunity or rolls up as a capability.

`types.ts` defines the contract. `productIndexForPrompt()` exposes the safe
subset the router needs.

## Products versus capabilities

Products with `canCreateOpportunity` can become one of the ranked pitches.
Supporting capabilities set `opportunity: false` and a `parentId`; the model
can match the capability, but the sales motion should roll up to the parent so
reps do not receive repetitive micro-opportunities.

## Adding or changing a product

1. Confirm the current Vercel product and its claims against authoritative
   product documentation. Do not rely on model memory.
2. Add a stable kebab-case ID. Never recycle an existing ID for a new meaning.
3. Choose distinct target roles based on functional ownership, not seniority
   alone.
4. Add observable public signals. A rule should describe evidence that could
   genuinely support a sales conversation, not a keyword.
5. Classify each rule explicitly. Product-fit rules establish a durable
   workload, problem, or requirement; trigger rules establish why the timing
   matters and must be freshness-sensitive.
6. Keep points within the intended category model. Shared account rules and
   category caps live in `lib/scoring.ts`.
7. Add only claims safe to place in externally reviewed outreach.
8. Decide whether the entry is a standalone product or a capability that must
   roll up to a parent.
9. Add or update deterministic cases in `eval/run.ts`.
10. Run `pnpm eval`, `pnpm test:e2e`, `pnpm typecheck`, and `pnpm build`.

## Invariants

- Every selected opportunity needs at least one grounded product-fit signal.
- Trigger signals never establish product fit and require a valid observation
  date to contribute points.
- Every standalone product defines at least one product-fit rule.
- Capabilities do not create standalone opportunities.
- Existing Vercel hosting suppresses only the Vercel Platform migration motion.
- Approved claims are not a general license to invent adjacent benefits.
- Product IDs are persisted in the database and may appear in historical runs.
- Avoid two products whose signals and conversation would be indistinguishable;
  prefer one product with supporting capabilities.
