import assert from 'node:assert/strict';
import { OPPORTUNITY_PRODUCTS, PRODUCTS, getProduct } from '@/lib/catalog/products';
import { scoreOpportunity } from '@/lib/scoring';

const ids = PRODUCTS.map((product) => product.id);
assert.equal(new Set(ids).size, ids.length, 'catalog product ids must be unique');
assert.ok(PRODUCTS.length >= 25, 'catalog should cover the broad Vercel product surface');
for (const product of OPPORTUNITY_PRODUCTS) {
  assert.ok(product.targetRoles.length > 0, `${product.id} needs target roles`);
  assert.ok(product.signals.length > 0, `${product.id} needs deterministic signals`);
  assert.ok(product.prohibitedClaims.length > 0, `${product.id} needs claim guardrails`);
}

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

console.log(`✓ catalog: ${PRODUCTS.length} entries, ${OPPORTUNITY_PRODUCTS.length} independent sales motions`);
console.log('✓ scoring: product fit, freshness, account value, buyer quality, expansion, and suppression');
