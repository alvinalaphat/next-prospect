import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function main() {
  process.env.PGLITE_PATH = join(mkdtempSync(join(tmpdir(), 'next-prospect-e2e-')), 'db');
  delete process.env.DATABASE_URL;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GMAIL_REFRESH_TOKEN;

  const { PGlite } = await import('@electric-sql/pglite');
const { drizzle } = await import('drizzle-orm/pglite');
const { migrate } = await import('drizzle-orm/pglite/migrator');
const migrationClient = new PGlite(process.env.PGLITE_PATH);
await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' });
await migrationClient.close();

const { approvalToken } = await import('@/lib/approval-token');
const {
  completeMaintenanceRun,
  getLatestMaintenanceRun,
  insertOpportunity,
  getOpportunity,
  getProspect,
  listActiveProofRecords,
  startMaintenanceRun,
  upsertProofRecords,
  upsertProspect
} = await import('@/lib/db');
const { applyOpportunityDecision } = await import('@/lib/opportunity-decision');
const { getProduct } = await import('@/lib/catalog/products');
const { scoreOpportunity } = await import('@/lib/scoring');

const domain = 'fixture.example';
const runId = 'fixture-run';
const id = crypto.randomUUID();
await upsertProspect(domain, { status: 'awaiting_approval', runId, host: 'vercel' });

const product = getProduct('ai-gateway')!;
const scored = scoreOpportunity({
  product,
  usesVercel: true,
  buyerQuality: 15,
  matches: [
    { ruleId: 'customer-ai-product', evidenceIds: ['research.signal.0'], confidence: 'high', explanation: 'Public agent launch' },
    { ruleId: 'ai-product-launch', evidenceIds: ['research.signal.0'], confidence: 'high', observedAt: new Date().toISOString(), explanation: 'Recent public launch' },
    { ruleId: 'account.growth-scale', evidenceIds: ['research.size.0'], confidence: 'high', explanation: 'Growth-stage account' }
  ]
});
const token = approvalToken(id, runId, 'opportunity');
await insertOpportunity({
  id,
  domain,
  runId,
  productId: product.id,
  productName: product.name,
  category: product.category,
  salesMotion: 'expansion',
  status: 'awaiting_approval',
  angle: 'Build on the existing Vercel footprint for a new agent product',
  whyNow: 'The company recently launched a customer-facing agent.',
  whyVercel: 'AI Gateway is relevant to the public launch.',
  targetRole: 'Head of AI',
  score: scored.score,
  scoreBreakdown: scored.breakdown,
  matchedSignals: scored.signals,
  evidenceIds: ['research.signal.0', 'research.size.0'],
  contact: { name: 'Taylor Example', title: 'Head of AI', linkedinUrl: null, email: null, sourceUrl: 'https://example.com/team', rationale: 'Owns the AI product.' },
  draft: {
    subjectOptions: ['your new agent', 'building on vercel', 'the next AI layer'],
    subject: 'your new agent',
    body: 'Hi Taylor,\n\nYour team recently launched a customer-facing agent.\n\nSince your site already runs on Vercel, AI Gateway could be a natural way to build on that footprint.\n\nOpen to a short conversation?\n\nFixture Rep',
    emailCitations: ['research.signal.0', 'detect.host.summary'],
    talkingPoints: [
      { text: 'Recent agent launch', citations: ['research.signal.0'] },
      { text: 'Existing Vercel footprint', citations: ['detect.host.summary'] },
      { text: 'Growth-stage company', citations: ['research.size.0'] }
    ],
    warnings: [],
    to: { name: 'Taylor Example', title: 'Head of AI', email: null, linkedinUrl: null }
  },
  approvalToken: token
});

const result = await applyOpportunityDecision(token, {
  decision: 'approved',
  by: 'e2e-test',
  via: 'dashboard'
});
assert.equal(result.applied, true);
assert.equal((await getOpportunity(id))?.status, 'approved');
assert.equal((await getProspect(domain))?.status, 'approved');

await startMaintenanceRun('fixture-proof-refresh', 'proof');
const savedProofs = await upsertProofRecords([{
  id: 'vercel-fixture',
  vendor: 'vercel',
  usage: 'customer-proof',
  company: 'Fixture Customer',
  title: 'Fixture customer story',
  sourceUrl: 'https://vercel.com/customers/fixture',
  summary: 'A grounded fixture used to verify proof persistence.',
  productIds: ['ai-gateway'],
  industries: ['software'],
  workloads: ['customer-facing AI'],
  candidateClaims: ['Fixture Customer used AI Gateway.'],
  publishedAt: '2026-10-01',
  lastSeenAt: new Date().toISOString()
}]);
assert.equal(savedProofs, 1);
assert.equal((await listActiveProofRecords()).length, 1);
await completeMaintenanceRun('fixture-proof-refresh', {
  refreshedAt: new Date().toISOString(),
  discovered: 1,
  saved: 1,
  byVendor: { vercel: 1, cloudflare: 0, railway: 0 }
});
assert.equal((await getLatestMaintenanceRun('proof'))?.status, 'complete');
  console.log('✓ e2e: account → scored expansion opportunity → grounded draft → approval → parent status');
  console.log('✓ maintenance: proof upsert → durable refresh status');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
