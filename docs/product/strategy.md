# Product strategy

This document explains why NextProspect exists and which product decisions must
survive implementation changes. `AGENTS.md` describes how to work in the repo;
this file describes what the product is trying to accomplish.

## The problem

Vercel's GTM organization can source a large number of accounts, but writing a
credible, specific first touch is still expensive. Generic personalization is
not enough: a rep needs to know which Vercel product is relevant, why the timing
is credible, and which person owns that problem.

The product should turn a company domain into a short list of conversations a
rep can understand and review, not a larger pile of undifferentiated research.

## The user

The primary user is a Vercel sales representative or sales leader reviewing
account-level outbound opportunities. They need to answer four questions:

1. Is this account worth attention?
2. Which Vercel product should lead the conversation?
3. Why is the conversation relevant now?
4. Who is the most appropriate person to contact, and why?

The output may later be copied into Outreach or another engagement system, but
NextProspect is currently the research, prioritization, and review layer.

## What the product does

For each submitted domain, NextProspect:

- observes the public website, hosting signals, and performance;
- researches public company, hiring, launch, regional, and timing signals;
- evaluates grounded evidence against the full Vercel product catalog;
- deterministically scores and ranks up to three distinct product motions;
- identifies a product-specific buyer or an explicit target role;
- drafts concise outreach using only approved product claims and cited public
  evidence; and
- waits for a human to approve, edit, or reject each opportunity.

## Product principles

### Recommend conversations, not data dumps

Research exists to support a decision. The account page should lead with the
company context and ranked product pitches. Technical details and source
receipts belong behind progressive disclosure.

### Product and buyer are inseparable

There is no standalone generic contact recommendation. Each product pitch owns
its angle, timing, buyer, score explanation, evidence, and draft.

### Weak signals remain visible

Grounded product-fit candidates are not hidden merely because their score is
low. A low score communicates uncertainty and lets a reviewer inspect weak
detection. A candidate with no grounded product-fit signal is suppressed.

### Scoring explains confidence, not absolute truth

The score is a deterministic prioritization aid. Product fit, timing, account
potential, buyer confidence, freshness, and risk contribute within fixed caps.
The UI should translate the breakdown into plain sales language and preserve
the exact points for auditability.

### Existing Vercel use creates expansion context

Observed Vercel hosting is useful evidence across the account. It suppresses an
incorrect pitch to migrate hosting to Vercel, but it can strengthen a distinct
expansion conversation such as AI Gateway, Workflow, security, or analytics.
Copy may say the inspected site runs on Vercel. It must not claim a private
contract, company-wide adoption, plan, spend, or use of another product.

### Region changes emphasis, not facts

EMEA outreach should favor a direct why-you, why-now structure. Privacy,
governance, or data-control language is used only when public evidence and the
selected product's approved claims support it. Location is never a license to
invent a compliance concern.

### Human review is permanent

Nothing is sent automatically. Approval records a decision and may create a
Gmail draft. A human remains responsible for final review and sending.

## Safety and quality constraints

- Use public, attributable evidence only.
- Keep customer and Vercel internal sensitive information out of drafts.
- Do not guess email addresses.
- Do not expose evidence IDs or internal scoring mechanics in email copy.
- Keep first-touch emails concise: a trigger, relevance, and a meeting ask.
- Lower-ROI account types may receive a deterministic risk deduction; they are
  not rejected through unsupported model judgment.
- Approved product claims come from the catalog, not model memory.

## Current non-goals

- Authentication, authorization, and multi-tenant rep accounts beyond the
  current `RUN_SECRET` write guard.
- Per-rep personalization beyond configured rep identity.
- Automatic sending or sequencing.
- Latency and concurrency optimization beyond conservative batch staggering.
- Replacing Salesforce, Outreach, or another system of record.
- Inferring private customer product usage.

## Product decision test

Before adding a surface or workflow step, ask whether it helps a rep make or
verify a product-specific outreach decision. If it only exposes more raw data,
it likely belongs in supporting evidence or outside the initial experience.
