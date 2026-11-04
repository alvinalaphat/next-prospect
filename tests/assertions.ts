import assert from 'node:assert/strict';
import { OPPORTUNITY_PRODUCTS, PRODUCTS, getProduct } from '@/lib/catalog/products';
import { approvalToken, parseApprovalToken } from '@/lib/approval-token';
import { isCronAuthorized } from '@/lib/auth';
import { contactActivityEvidence, contactActivityId, containsFullName } from '@/lib/contact-activity';
import { relativeTime } from '@/lib/format';
import { freshnessMultiplier, scoreOpportunity } from '@/lib/scoring';

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

process.env.CRON_SECRET = 'fixture-cron-secret';
assert.equal(isCronAuthorized(new Request('https://example.com/api/cron', {
  headers: { authorization: 'Bearer fixture-cron-secret' }
})), true);
assert.equal(isCronAuthorized(new Request('https://example.com/api/cron')), false);
delete process.env.CRON_SECRET;

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
