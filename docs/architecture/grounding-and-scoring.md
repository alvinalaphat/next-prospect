# Grounding, scoring, and drafting boundaries

This is the highest-risk logic in the product. Read it before changing
research, prompts, the catalog, scoring, buyer selection, citations, or email
copy.

## Evidence ledger

Every externally verifiable observation is normalized into an `EvidenceItem`
with a stable ID, label, value, source URL when applicable, and collection
metadata. Detection, performance, and research all append evidence before the
planner runs.

The ledger is the factual boundary:

- research URLs must come from a tool result;
- model-selected citations are normalized and checked against known IDs;
- unknown citations are repaired once and then removed;
- unsupported numeric claims are retried once and then surfaced as warnings;
- citation IDs are stripped from user-facing email bodies; and
- the UI can jump from a citation chip to the exact source receipt.

Do not loosen these checks to make a draft look more complete.

## Division of responsibility

| Concern | Model | Deterministic code |
| --- | --- | --- |
| Find plausible public signals | Proposes | Validates source URLs |
| Match evidence to catalog rules | Proposes rule IDs and evidence IDs | Rejects unknown rules and evidence |
| Score an opportunity | Never chooses final number | Applies weights, confidence, freshness, caps, and one account tier |
| Choose buyer | Selects from retrieved people | Verifies the selected name exists in retrieved text |
| Find buyer activity | Selects and summarizes attributable public results | Requires the full selected name in retrieved content and preserves source dates |
| Draft outreach | Writes from selected evidence and approved claims | Checks citations, numbers, formatting, and leaks |

The model may interpret evidence. It may not create new facts, product claims,
or score weights.

## Deterministic score

`lib/scoring.ts` is authoritative. The current maximum positive contributions
are:

| Category | Maximum |
| --- | ---: |
| Product fit | 45 |
| Timing trigger | 20 |
| Account potential | 20 |
| Buyer confidence | 15 |

The positive category caps total 100 points. Signal confidence and, where
configured, freshness reduce a rule's base points before category caps are
applied. The final score is clamped to 0–100. Freshness-sensitive triggers
require a valid observation date; missing or invalid dates contribute zero
trigger points.

Account potential measures evidence-backed sales fit, not risk. At most one
shared account tier contributes: enterprise or strategic (20), mid-market or
growth-stage (15), smaller product-led with credible growth (10), or an SMB
with a meaningful digital product, commerce, or web workload (5). Traditional
small, local, or professional-services profiles receive no account-potential
points by default. Observed Vercel hosting can add 5 expansion-context points,
subject to the 20-point category cap.

Each rule ID scores at most once. If the planner repeats a rule, scoring keeps
the strongest supported match and combines its evidence receipts. When more
than one account tier is proposed, only the highest supported tier remains.

Scores are stored with each opportunity rather than recalculated on read. New
runs use only the positive sales-fit account tiers above.

The planner keeps grounded product-fit candidates even when their total is
weak. `productFit === 0` is the hard suppression boundary.

## Catalog rules

`lib/catalog/products.ts` defines products, supporting capabilities, target
roles, signals, and approved claims.

- Products with `canCreateOpportunity` may produce a standalone pitch.
- Capabilities roll up to a parent product and must not create repetitive
  micro-opportunities.
- Product-fit rules describe durable workload or need evidence. Trigger rules
  describe time-bound events, are explicitly classified, and cannot establish
  product relevance on their own.
- Shared account rules live in `lib/scoring.ts`.
- A catalog claim is permission to use that exact supported idea, not to extend
  it with model knowledge.

See [the catalog guide](../../lib/catalog/README.md) before making changes.

## Existing Vercel footprint

Observed Vercel hosting is safe shared account context because it comes from
public technical evidence. It may add expansion context to other product
opportunities. It must not imply:

- a paid contract or plan;
- organization-wide adoption;
- usage of products that were not observed;
- spend, renewal timing, or private account ownership; or
- internal customer or Vercel information.

## Buyer grounding

Buyer discovery happens after all product angles are selected. One combined
people search covers the union of their target roles, and the model assigns a
buyer to each opportunity. A named contact is accepted only when
the selected name is present in retrieved content. Published emails are used
only when found in retrieved public text; addresses are never constructed.

When no person is sufficiently supported, store null contact fields and retain
the explicit target role. That is a valid, honest result.

After buyers are grounded, public activity is searched once per unique person,
even when they own several opportunities. The model selects the relevant posts,
blogs, talks, podcasts, or GitHub activity separately for each opportunity. The complete
buyer name must appear as one boundary-aware phrase in the retrieved title,
author, or highlights before the result reaches the model. The retrieved
source owns the publication date; undated material is never described as
recent. Buyer activity may ground a draft, but it does not change product
ranking or numeric scoring. Its receipt ID includes the selected summary and
relevance context so two opportunity-specific interpretations of one URL do
not collide in the review ledger.

## Draft contract

A first-touch email should contain:

1. a public trigger or observation that explains why the timing is relevant;
2. why the selected Vercel product is relevant to the recipient's work;
3. for EMEA accounts, a product-specific privacy, governance, or data-control
   strength only when approved catalog claims support it; and
4. a short meeting or demo request about that product.

Drafts do not default to a hosting migration. Hosting migration language is
valid only for a Vercel Platform opportunity with supporting context. A recent
Vercel release can be used as the trigger only when dated, source-backed
release context is explicitly supplied to drafting.

The verified buyer's first name and configured `REP_NAME` are supplied directly
to drafting; generated emails do not contain identity placeholders. When no
buyer name is verified, the draft uses `Hi there,` and warns the reviewer.

Keep the email concise, plain text, and reviewable. Do not include internal
scores, evidence IDs, implementation notes, or sensitive information. Regional
tone may change structure, but it never changes the evidence requirement.
