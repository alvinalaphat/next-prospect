import assert from 'node:assert/strict';
import { EMEA_TRUST_NOTE, OPPORTUNITY_PRODUCTS, PRODUCTS, getProduct } from '@/lib/catalog/products';
import { approvalToken, parseApprovalToken } from '@/lib/approval-token';
import { contactActivityEvidence, contactActivityId, containsFullName } from '@/lib/contact-activity';
import { placeClosingNoteBeforeSignoff, stripEmDashes } from '@/lib/email-text';
import { presentEvidence, salesLanguage } from '@/lib/evidence-presentation';
import { relativeTime } from '@/lib/format';
import { isOfficialVercelCustomerStory, latestEvidenceDate, precedentEvidence, researchEvidence } from '@/lib/grounding';
import { buyerRegionEvidence, opportunityRegion } from '@/lib/region';
import { freshnessMultiplier, scoreOpportunity } from '@/lib/scoring';
import { enforceEmailIdentity, stripCitationLeaks } from '@/lib/services';

const ids = PRODUCTS.map((product) => product.id);
assert.deepEqual(parseApprovalToken(approvalToken('opportunity-id', 'run-id')), {
  opportunityId: 'opportunity-id',
  runId: 'run-id'
});
assert.equal(parseApprovalToken('approval:example.com:old-run'), null, 'account-level tokens are retired');
assert.equal(new Set(ids).size, ids.length, 'catalog product ids must be unique');
assert.ok(PRODUCTS.length >= 25, 'catalog should cover the broad Vercel product surface');
for (const product of OPPORTUNITY_PRODUCTS) {
  assert.ok(product.targetRoles.length > 0, `${product.id} needs target roles`);
  assert.ok(product.signals.length > 0, `${product.id} needs deterministic signals`);
  assert.ok(product.signals.some((signal) => signal.category === 'product_fit'), `${product.id} needs a product-fit signal`);
  assert.ok(product.prohibitedClaims.length > 0, `${product.id} needs claim guardrails`);
}
for (const product of PRODUCTS) {
  for (const signal of product.signals) {
    if (signal.category === 'trigger') {
      assert.equal(signal.freshnessSensitive, true, `${product.id}.${signal.id} trigger must be freshness-sensitive`);
    }
  }
}

assert.equal(freshnessMultiplier(), 0, 'undated freshness-sensitive evidence must not score');
assert.equal(freshnessMultiplier('not-a-date'), 0, 'invalid freshness-sensitive evidence must not score');
assert.equal(
  relativeTime('2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:01:00Z')),
  '1m ago',
  'relative time should be deterministic when the render timestamp is supplied'
);

const undatedActivity = contactActivityEvidence([{
  id: 'research.buyer-activity.fixture',
  personName: 'Taylor Example',
  text: 'Taylor discussed durable AI systems.',
  sourceUrl: 'https://example.com/taylor-post',
  sourceType: 'blog',
  publishedAt: null,
  relevance: 'Relevant to durable agents'
}]);
assert.equal(undatedActivity[0].label, 'Buyer activity');
assert.doesNotMatch(undatedActivity[0].label, /recent/i);
assert.equal(containsFullName('A conversation with Bo Li about AI systems', 'Bo Li'), true);
assert.equal(containsFullName('A conversation with Bo Chen about AI systems', 'Bo Li'), false);
assert.equal(containsFullName('Annual release notes from Leeway', 'Ann Lee'), false);
assert.notEqual(
  contactActivityId({ sourceUrl: 'https://example.com/post', text: 'First summary', relevance: 'AI' }),
  contactActivityId({ sourceUrl: 'https://example.com/post', text: 'Second summary', relevance: 'AI' })
);

const datedResearchEvidence = researchEvidence({
  companyName: 'Linear',
  summary: { text: 'Product development software', sourceUrl: 'https://linear.app' },
  sizeSignals: [],
  news: [{ text: 'Introducing Linear Agent', date: '2026-03-24', sourceUrl: 'https://linear.app/changelog/linear-agent' }],
  whyNow: [],
  region: { group: 'americas', label: 'San Francisco, United States', sourceUrl: 'https://linear.app/about' },
  productSignals: [{ text: 'Linear Agent entered public beta', kind: 'launch', date: '2026-03-24', sourceUrl: 'https://linear.app/changelog/linear-agent' }],
  precedents: [{
    companyName: 'Acme',
    similarity: 'Both operate collaborative software products.',
    outcome: 'Acme reported faster releases.',
    products: ['Vercel Platform'],
    sourceUrl: 'https://vercel.com/customers/acme'
  }]
});
assert.equal(datedResearchEvidence.find((item) => item.id === 'research.news.0')?.observedAt, '2026-03-24');
assert.equal(datedResearchEvidence.find((item) => item.id === 'research.signal.0')?.observedAt, '2026-03-24');
assert.equal(latestEvidenceDate(['research.news.0', 'research.signal.0'], datedResearchEvidence), '2026-03-24');
assert.equal(latestEvidenceDate(['research.region'], datedResearchEvidence), null);
assert.equal(datedResearchEvidence.some((item) => item.id.startsWith('research.precedent.')), false, 'customer precedent must stay out of scoring evidence');
assert.equal(precedentEvidence({
  companyName: 'Linear',
  summary: { text: '', sourceUrl: '' },
  sizeSignals: [],
  news: [],
  whyNow: [],
  region: { group: 'unknown', label: 'Unknown', sourceUrl: null },
  productSignals: [],
  precedents: [{
    companyName: 'Acme',
    similarity: 'Both operate collaborative software products.',
    outcome: 'Acme reported faster releases.',
    products: ['Vercel Platform'],
    sourceUrl: 'https://vercel.com/customers/acme'
  }]
})[0]?.id, 'research.precedent.0');
assert.equal(isOfficialVercelCustomerStory('https://vercel.com/customers/acme'), true);
assert.equal(isOfficialVercelCustomerStory('https://www.vercel.com/customers/acme'), true);
assert.equal(isOfficialVercelCustomerStory('https://example.com/customers/acme'), false);
assert.equal(isOfficialVercelCustomerStory('https://customer.vercel.com/customers/acme'), false);
assert.equal(isOfficialVercelCustomerStory('https://vercel.com/blog/acme'), false);

const draftWithoutTrust = 'Hi Taylor,\n\nA relevant product point.\n\nOpen to a short conversation?\n\nFixture Rep';
const draftWithTrust = placeClosingNoteBeforeSignoff(draftWithoutTrust, EMEA_TRUST_NOTE);
assert.ok(draftWithTrust.includes(`Open to a short conversation?\n\n${EMEA_TRUST_NOTE}\n\nFixture Rep`));
const misplacedTrust = `Hi Taylor,\n\n${EMEA_TRUST_NOTE}\n\nA relevant product point.\n\nOpen to a short conversation?\n\nFixture Rep`;
assert.equal(placeClosingNoteBeforeSignoff(misplacedTrust, EMEA_TRUST_NOTE), draftWithTrust, 'EMEA trust copy must move after the ask without duplicating');
const draftWithClosingSalutation = 'Hi Taylor,\n\nA relevant product point.\n\nOpen to a short conversation?\n\nBest,\n\nFixture Rep';
assert.ok(
  placeClosingNoteBeforeSignoff(draftWithClosingSalutation, EMEA_TRUST_NOTE).endsWith(
    `Open to a short conversation?\n\n${EMEA_TRUST_NOTE}\n\nBest,\n\nFixture Rep`
  ),
  'EMEA trust copy must stay before the complete sign-off'
);

const questionDraft = stripEmDashes(enforceEmailIdentity(
  stripCitationLeaks('Hi Taylor,\n\nWould a short walkthrough be useful?\n\nFixture Rep'),
  'Hi Taylor,',
  'Fixture Rep'
));
assert.ok(questionDraft.includes('Would a short walkthrough be useful?'), 'draft cleanup must preserve question marks');

const emeaHeadquarters = { group: 'emea' as const, label: 'London, United Kingdom', sourceUrl: 'https://example.com/about' };
const americasHeadquarters = { group: 'americas' as const, label: 'San Francisco, United States', sourceUrl: 'https://example.com/about' };
const emeaBuyer = { group: 'emea' as const, label: 'Paris, France', sourceUrl: 'https://example.com/buyer' };
const americasBuyer = { group: 'americas' as const, label: 'New York, United States', sourceUrl: 'https://example.com/buyer' };
assert.equal(opportunityRegion(emeaHeadquarters, americasBuyer), emeaHeadquarters, 'EMEA headquarters must take precedence');
assert.equal(opportunityRegion(americasHeadquarters, emeaBuyer), emeaBuyer, 'an EMEA buyer must expand EMEA coverage');
assert.equal(opportunityRegion(americasHeadquarters, undefined), americasHeadquarters);
assert.deepEqual(buyerRegionEvidence({
  name: 'Taylor Example',
  title: 'Head of AI',
  linkedinUrl: null,
  email: null,
  sourceUrl: 'https://example.com/buyer',
  region: emeaBuyer,
  rationale: 'Owns the AI product.'
}, 'opportunity-123'), [{
  id: 'research.buyer-region.opportunity-123',
  source: 'research',
  label: 'Buyer work location',
  value: 'Taylor Example: Paris, France',
  url: 'https://example.com/buyer'
}]);

const plainSpeed = presentEvidence({
  id: 'psi.mobile.field.lcp',
  source: 'psi',
  label: 'Real-user LCP, origin-level field p75 (mobile)',
  value: '3040 ms',
  url: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fexample.com'
});
assert.equal(plainSpeed.label, 'Real visitor experience');
assert.match(plainSpeed.statement, /main page content appeared in 3 seconds/i);
assert.doesNotMatch(plainSpeed.statement, /LCP|p75|field/i);

const plainHosting = presentEvidence({
  id: 'detect.host.summary',
  source: 'detect',
  label: 'Hosting',
  value: 'Primary host: cloudflare'
});
assert.match(plainHosting.statement, /hosting signal for Cloudflare/i);
assert.doesNotMatch(plainHosting.statement, /primary host/i);
assert.match(presentEvidence({
  id: 'detect.host.summary',
  source: 'detect',
  label: 'Hosting',
  value: 'Primary host: unknown'
}).statement, /could not identify a hosting provider/i);
assert.match(presentEvidence({
  id: 'detect.nextjs.next-root',
  source: 'detect',
  label: 'Pages Router root element',
  value: '<div id="__next">'
}).statement, /Next\.js-related marker/i);
assert.doesNotMatch(presentEvidence({
  id: 'detect.nextjs.next-root',
  source: 'detect',
  label: 'Pages Router root element',
  value: '<div id="__next">'
}).statement, /reliable|confirm/i);
assert.equal(
  salesLanguage('CrUX p75 LCP 3040 ms behind a CDN'),
  'real-user performance data the experience for most visitors main-content load time 3 seconds behind a content delivery network'
);

const platform = getProduct('vercel-platform')!;
const suppressed = scoreOpportunity({
  product: platform,
  usesVercel: true,
  matches: [{
    ruleId: 'nextjs-off-vercel',
    evidenceIds: ['detect.nextjs.summary'],
    confidence: 'high',
    explanation: 'Fixture'
  }]
});
assert.equal(suppressed.score, 0);
assert.match(suppressed.suppressedReason ?? '', /already hosted on Vercel/);

const gateway = getProduct('ai-gateway')!;
const expansion = scoreOpportunity({
  product: gateway,
  usesVercel: true,
  buyerQuality: 15,
  now: new Date('2026-10-30T00:00:00Z'),
  matches: [
    {
      ruleId: 'customer-ai-product',
      evidenceIds: ['research.signal.0'],
      confidence: 'high',
      explanation: 'Customer-facing agent is live'
    },
    {
      ruleId: 'ai-product-launch',
      evidenceIds: ['research.signal.1'],
      confidence: 'high',
      observedAt: '2026-10-15',
      explanation: 'Recent launch'
    },
    {
      ruleId: 'account.enterprise-scale',
      evidenceIds: ['research.size.0'],
      confidence: 'high',
      explanation: 'Enterprise scale'
    }
  ]
});
assert.deepEqual(expansion.breakdown, {
  productFit: 21,
  trigger: 20,
  accountValue: 20,
  buyerQuality: 15,
  total: 76
});
assert.equal(expansion.score, 76);

const duplicateAndTiered = scoreOpportunity({
  product: gateway,
  usesVercel: false,
  matches: [
    {
      ruleId: 'customer-ai-product',
      evidenceIds: ['research.signal.0'],
      confidence: 'medium',
      explanation: 'First match for the same product-fit rule'
    },
    {
      ruleId: 'customer-ai-product',
      evidenceIds: ['research.signal.1'],
      confidence: 'high',
      explanation: 'Stronger match for the same product-fit rule'
    },
    {
      ruleId: 'account.growth-scale',
      evidenceIds: ['research.size.0'],
      confidence: 'high',
      explanation: 'Growth-stage account'
    },
    {
      ruleId: 'account.credible-growth',
      evidenceIds: ['research.size.1'],
      confidence: 'high',
      explanation: 'A lower account tier should not stack'
    }
  ]
});
assert.equal(duplicateAndTiered.breakdown.productFit, 21, 'a repeated rule id must score only once');
assert.equal(duplicateAndTiered.breakdown.accountValue, 15, 'only the highest supported account tier should score');
assert.deepEqual(
  duplicateAndTiered.signals.find((signal) => signal.ruleId === 'customer-ai-product')?.evidenceIds,
  ['research.signal.0', 'research.signal.1'],
  'deduplication should retain every grounded evidence receipt'
);
assert.equal(duplicateAndTiered.signals.some((signal) => signal.ruleId === 'account.credible-growth'), false);

const maximum = scoreOpportunity({
  product: gateway,
  usesVercel: false,
  buyerQuality: 15,
  now: new Date('2026-10-30T00:00:00Z'),
  matches: [
    { ruleId: 'multi-model-ai', evidenceIds: ['research.technical.0'], confidence: 'high', explanation: 'Multiple model providers' },
    { ruleId: 'customer-ai-product', evidenceIds: ['research.signal.0'], confidence: 'high', explanation: 'Customer-facing agent' },
    { ruleId: 'ai-product-launch', evidenceIds: ['research.news.0'], confidence: 'high', observedAt: '2026-10-20', explanation: 'Recent launch' },
    { ruleId: 'account.enterprise-scale', evidenceIds: ['research.size.0'], confidence: 'high', explanation: 'Enterprise scale' }
  ]
});
assert.deepEqual(maximum.breakdown, {
  productFit: 45,
  trigger: 20,
  accountValue: 20,
  buyerQuality: 15,
  total: 100
});

const digitalSmb = scoreOpportunity({
  product: gateway,
  usesVercel: false,
  matches: [
    { ruleId: 'customer-ai-product', evidenceIds: ['research.signal.0'], confidence: 'high', explanation: 'Customer-facing agent' },
    { ruleId: 'account.smb-digital', evidenceIds: ['research.size.0'], confidence: 'high', explanation: 'Meaningful digital SMB workload' }
  ]
});
assert.equal(digitalSmb.breakdown.accountValue, 5);

const hiringOnly = scoreOpportunity({
  product: gateway,
  usesVercel: false,
  now: new Date('2026-10-30T00:00:00Z'),
  matches: [{
    ruleId: 'ai-platform-hiring',
    evidenceIds: ['research.job.0'],
    confidence: 'high',
    observedAt: '2026-10-20',
    explanation: 'Recent AI platform opening'
  }]
});
assert.equal(hiringOnly.breakdown.productFit, 0);
assert.equal(hiringOnly.breakdown.trigger, 12);
assert.match(hiringOnly.suppressedReason ?? '', /No grounded product-fit signal/);

const undatedTrigger = scoreOpportunity({
  product: gateway,
  usesVercel: false,
  matches: [
    {
      ruleId: 'customer-ai-product',
      evidenceIds: ['research.signal.0'],
      confidence: 'high',
      explanation: 'Customer-facing agent is live'
    },
    {
      ruleId: 'ai-product-launch',
      evidenceIds: ['research.signal.1'],
      confidence: 'high',
      explanation: 'Launch date was not established'
    }
  ]
});
assert.equal(undatedTrigger.breakdown.productFit, 21);
assert.equal(undatedTrigger.breakdown.trigger, 0);
assert.equal(undatedTrigger.suppressedReason, null);

const proofCannotScore = scoreOpportunity({
  product: gateway,
  usesVercel: false,
  matches: [{
    ruleId: 'proof.vercel.customer-story',
    evidenceIds: ['proof.fixture'],
    confidence: 'high',
    explanation: 'Customer proof is supporting context, not prospect evidence'
  }]
});
assert.equal(proofCannotScore.score, 0);
assert.match(proofCannotScore.suppressedReason ?? '', /No grounded product-fit signal/);

console.log(`✓ catalog: ${PRODUCTS.length} entries, ${OPPORTUNITY_PRODUCTS.length} independent sales motions`);
console.log('✓ scoring: 100-point caps, unique rules, one sales-fit account tier, freshness, expansion, and suppression');
