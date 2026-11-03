import assert from 'node:assert/strict';
import { OPPORTUNITY_PRODUCTS, PRODUCTS, getProduct } from '@/lib/catalog/products';
import { isCronAuthorized } from '@/lib/cron-auth';
import { freshnessMultiplier, scoreOpportunity } from '@/lib/scoring';

const ids = PRODUCTS.map((product) => product.id);
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

process.env.CRON_SECRET = 'fixture-cron-secret';
assert.equal(isCronAuthorized(new Request('https://example.com/api/cron', {
  headers: { authorization: 'Bearer fixture-cron-secret' }
})), true);
assert.equal(isCronAuthorized(new Request('https://example.com/api/cron')), false);
delete process.env.CRON_SECRET;

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
  productFit: 18,
  trigger: 20,
  accountValue: 15,
  buyerQuality: 15,
  risk: 0,
  total: 68
});
assert.equal(expansion.score, 68);

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
assert.equal(undatedTrigger.breakdown.productFit, 18);
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
console.log('✓ scoring: explicit fit/trigger classification, freshness, account value, buyer quality, expansion, and suppression');
