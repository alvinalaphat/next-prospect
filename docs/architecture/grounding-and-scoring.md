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
| Score an opportunity | Never chooses final number | Applies weights, confidence, freshness, caps, and risk |
| Choose buyer | Selects from retrieved people | Verifies the selected name exists in retrieved text |
| Draft outreach | Writes from selected evidence and approved claims | Checks citations, numbers, formatting, and leaks |

The model may interpret evidence. It may not create new facts, product claims,
or score weights.

## Deterministic score

`lib/scoring.ts` is authoritative. The current maximum positive contributions
are:

| Category | Maximum |
| --- | ---: |
| Product fit | 35 |
| Timing trigger | 25 |
| Account potential | 15 |
| Buyer confidence | 15 |

Risk can subtract up to 30 points. Signal confidence and, where configured,
freshness reduce a rule's base points before category caps are applied. The
final score is clamped to 0–100. Freshness-sensitive triggers require a valid
observation date; missing or invalid dates contribute zero trigger points.

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

Buyer discovery happens after a product and angle are selected. Search results
are scoped to the product's target roles. A named contact is accepted only when
the selected name is present in retrieved content. Published emails are used
only when found in retrieved public text; addresses are never constructed.

When no person is sufficiently supported, store null contact fields and retain
the explicit target role. That is a valid, honest result.

## Draft contract

A first-touch email should contain:

1. a public trigger or observation;
2. why the selected Vercel product is relevant to the recipient's work; and
3. a short meeting request.

Keep the email concise, plain text, and reviewable. Do not include internal
scores, evidence IDs, implementation notes, or sensitive information. Regional
tone may change structure, but it never changes the evidence requirement.
