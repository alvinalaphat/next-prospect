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
- finds relevant official Vercel customer stories as clearly attributed sales
  precedent without treating another customer's result as prospect evidence;
- evaluates grounded evidence against the full Vercel product catalog;
- deterministically scores and ranks up to three distinct product motions;
- identifies a product-specific named buyer whenever public results support a
  direct or reasonably adjacent owner, using an explicit target role only when
  expanded search still cannot ground a relevant person;
- drafts concise outreach using only approved product claims and cited public
  evidence; and
- waits for a human to approve, edit, or reject each opportunity.

## Product principles

### Recommend conversations, not data dumps

Research exists to support a decision. The account page should lead with the
company context and ranked product pitches. Evidence should be translated into
plain sales language and shown with the opportunity and score category it
supports. Internal receipt IDs and raw implementation details stay out of the
rep-facing experience.

### Product and buyer are inseparable

There is no standalone generic contact recommendation. Each product pitch owns
its angle, timing, buyer, score explanation, evidence, and draft.

### Weak signals remain visible

Grounded product-fit candidates are not hidden merely because their score is
low. A low score communicates uncertainty and lets a reviewer inspect weak
detection. A candidate with no grounded product-fit signal is suppressed.

### Scoring explains confidence, not absolute truth

The score is a deterministic prioritization aid. Product fit, timing, account
potential, buyer confidence, and freshness contribute within fixed caps.
The UI should translate the breakdown into plain sales language and preserve
the exact points for auditability.

### Existing Vercel use creates expansion context

Observed Vercel hosting is useful evidence across the account. It suppresses an
incorrect pitch to migrate hosting to Vercel, but it can strengthen a distinct
expansion conversation such as AI Gateway, Workflow, security, or analytics.
Copy may say the inspected site runs on Vercel. It must not claim a private
contract, company-wide adoption, plan, spend, or use of another product.

### Region changes emphasis, not facts

EMEA outreach should favor a direct why-you, why-now structure. An opportunity
is treated as EMEA when public evidence places either the company headquarters
or the selected buyer's work location there. A buyer location expands EMEA
coverage; it never overrides an EMEA headquarters. An office location alone is
insufficient unless public evidence connects the buyer to it. Every EMEA draft
must close with the approved, concise Vercel platform note beginning "By the
way," and covering GDPR, independently audited security controls, and the Data
Processing Addendum. It
appears after the meeting ask and before the sign-off so it does not interrupt
the product argument. Location is never a license to invent any additional
compliance concern.

### Human review is permanent

Nothing is sent automatically. Approval records a decision and may create a
Gmail draft. A human remains responsible for final review and sending.

## Safety and quality constraints

- Use public, attributable evidence only.
- Keep customer and Vercel internal sensitive information out of drafts.
- Do not guess email addresses.
- Do not expose evidence IDs or internal scoring mechanics in email copy.
- Keep first-touch emails concise: a trigger, relevance, and a meeting ask.
- Account potential is a positive, evidence-backed sales-fit tier. Enterprise,
  growth-stage, product-led, and digitally meaningful SMB profiles can earn
  points; traditional small or professional-services profiles receive no
  account-potential points unless public evidence supports meaningful digital
  scale or workload.
- Approved product claims come from the catalog, not model memory.
- Customer precedent may support the conversation and call preparation, but it
  never changes the prospect score or promises the same outcome.

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
