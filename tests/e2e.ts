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
  delete process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_SIGNING_SECRET;
  delete process.env.SLACK_CHANNEL_ID;

  const { PGlite } = await import('@electric-sql/pglite');
const { drizzle } = await import('drizzle-orm/pglite');
const { migrate } = await import('drizzle-orm/pglite/migrator');
const migrationClient = new PGlite(process.env.PGLITE_PATH);
await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' });
await migrationClient.close();

const { approvalToken } = await import('@/lib/approval-token');
const {
  claimProspectRun,
  clearIncompleteOpportunityPlanning,
  claimFreshProspectRun,
  insertOpportunity,
  getOpportunity,
  getOpportunities,
  getProspect,
  resetProspectForNewRun,
  resetFailedProspectForRetry,
  restoreProspectRetry,
  updateOpportunity,
  updateOpportunityForRun,
  updateProspectForRun,
  upsertProspect
} = await import('@/lib/db');
const { applyOpportunityDecision } = await import('@/lib/opportunity-decision');
const { getProduct } = await import('@/lib/catalog/products');
const { scoreOpportunity } = await import('@/lib/scoring');
const { stepFinishOpportunityPlanning, stepRequestOpportunityApproval } = await import('@/workflows/outbound/steps');

const domain = 'fixture.example';
const runId = 'fixture-run';
const id = crypto.randomUUID();
await upsertProspect(domain, { status: 'awaiting_approval', runId, host: 'vercel' });

const supersededDomain = 'superseded.example';
await upsertProspect(supersededDomain, { status: 'queued', runId: null });
assert.equal(await claimProspectRun(supersededDomain, 'original-run', { status: 'detecting' }), true);
await upsertProspect(supersededDomain, { status: 'queued', runId: null });
assert.equal(await claimProspectRun(supersededDomain, 'replacement-run', { status: 'detecting' }), true);
assert.equal(
  await updateProspectForRun(supersededDomain, 'original-run', { status: 'researching' }),
  false
);
assert.equal((await getProspect(supersededDomain))?.runId, 'replacement-run');
await upsertProspect(supersededDomain, { status: 'approved' });
assert.equal(
  await updateProspectForRun(
    supersededDomain,
    'replacement-run',
    { status: 'awaiting_approval' },
    ['qualifying', 'researching', 'drafting']
  ),
  false
);
assert.equal((await getProspect(supersededDomain))?.status, 'approved');

const resetDomain = 'fresh-run.example';
await upsertProspect(resetDomain, {
  status: 'error',
  runId: 'stale-run',
  fitScore: 99,
  research: {
    companyName: 'Stale Company',
    summary: { text: 'Stale summary', sourceUrl: 'https://old.example/source' },
    sizeSignals: [],
    news: [],
    whyNow: [],
    region: { group: 'unknown', label: 'Unknown', sourceUrl: null },
    productSignals: [],
    precedents: []
  },
  evidence: [{ id: 'research.stale', source: 'research', label: 'Stale', value: 'Old evidence' }],
  error: 'Old run failed'
});
await resetProspectForNewRun(resetDomain, 'fresh-batch');
const resetProspect = await getProspect(resetDomain);
assert.equal(resetProspect?.status, 'queued');
assert.equal(resetProspect?.runId, null);
assert.equal(resetProspect?.research, null);
assert.equal(resetProspect?.evidence, null);
assert.equal(resetProspect?.fitScore, null);
assert.equal(resetProspect?.error, null);
assert.equal(resetProspect?.planningComplete, false);

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
const token = approvalToken(id, runId);
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
  contact: { name: 'Taylor Example', title: 'Head of AI', linkedinUrl: null, email: null, sourceUrl: 'https://example.com/team', region: null, rationale: 'Owns the AI product.' },
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

const supersededOpportunityId = crypto.randomUUID();
const reviewableOpportunity = await getOpportunity(id);
assert.ok(reviewableOpportunity);
await insertOpportunity({
  ...reviewableOpportunity,
  id: supersededOpportunityId,
  domain: supersededDomain,
  runId: 'original-run',
  status: 'drafting',
  decision: null,
  approvalToken: null
});
assert.equal(
  await updateOpportunityForRun(supersededOpportunityId, {
    status: 'awaiting_approval',
    approvalToken: approvalToken(supersededOpportunityId, 'original-run')
  }),
  null
);
assert.equal((await getOpportunity(supersededOpportunityId))?.status, 'drafting');

const retryDomain = 'retry.example';
const failedRunId = 'failed-run';
const retryRunId = 'retry-run';
const retryOpportunityId = crypto.randomUUID();
await upsertProspect(retryDomain, {
  status: 'error',
  runId: failedRunId,
  fitScore: 81,
  evidence: [{ id: 'research.retry', source: 'research', label: 'Old evidence', value: 'Clear me' }],
  error: 'Temporary provider credit error'
});
await insertOpportunity({
  ...reviewableOpportunity,
  id: retryOpportunityId,
  domain: retryDomain,
  runId: failedRunId,
  status: 'awaiting_approval',
  decision: null,
  approvalToken: null
});
assert.equal(await resetFailedProspectForRetry(retryDomain, failedRunId, 'retry-batch'), true);
assert.equal(await resetFailedProspectForRetry(retryDomain, failedRunId, 'duplicate-batch'), false);
const resetRetryProspect = await getProspect(retryDomain);
assert.equal(resetRetryProspect?.status, 'queued');
assert.equal(resetRetryProspect?.runId, null);
assert.equal(resetRetryProspect?.fitScore, 81);
assert.equal(resetRetryProspect?.evidence?.[0]?.id, 'research.retry');
assert.equal((await getOpportunity(retryOpportunityId))?.status, 'awaiting_approval');
assert.equal((await getOpportunity(retryOpportunityId))?.runId, failedRunId);
assert.equal(
  await restoreProspectRetry(retryDomain, failedRunId, 'Temporary provider credit error'),
  true
);
assert.equal((await getProspect(retryDomain))?.status, 'error');
assert.equal((await getProspect(retryDomain))?.fitScore, 81);
assert.equal((await getProspect(retryDomain))?.evidence?.[0]?.id, 'research.retry');
assert.equal((await getOpportunity(retryOpportunityId))?.status, 'awaiting_approval');
assert.equal(await resetFailedProspectForRetry(retryDomain, failedRunId, 'retry-batch-2'), true);
assert.equal(await claimFreshProspectRun(retryDomain, retryRunId), true);
assert.equal((await getProspect(retryDomain))?.fitScore, null);
assert.equal((await getProspect(retryDomain))?.evidence, null);
assert.equal((await getOpportunity(retryOpportunityId))?.status, 'expired');
await updateProspectForRun(retryDomain, retryRunId, { status: 'error', error: 'Fast retry failure' });
assert.equal(await claimProspectRun(retryDomain, retryRunId, {}), true);
assert.equal((await getProspect(retryDomain))?.status, 'error');
assert.equal((await getProspect(retryDomain))?.error, 'Fast retry failure');
assert.equal((await getOpportunity(retryOpportunityId))?.runId, failedRunId);

const partialPlanningDomain = 'partial-planning.example';
const partialPlanningRunId = 'partial-planning-run';
const partialOpportunityId = crypto.randomUUID();
await upsertProspect(partialPlanningDomain, {
  status: 'qualifying',
  runId: partialPlanningRunId,
  fitScore: 72,
  angle: 'Incomplete planner result',
  planningComplete: false
});
await insertOpportunity({
  ...reviewableOpportunity,
  id: partialOpportunityId,
  domain: partialPlanningDomain,
  runId: partialPlanningRunId,
  status: 'candidate',
  decision: null,
  approvalToken: null
});
assert.equal(await clearIncompleteOpportunityPlanning(partialPlanningDomain, partialPlanningRunId), true);
assert.equal((await getOpportunities(partialPlanningDomain, partialPlanningRunId)).length, 0);
assert.equal((await getProspect(partialPlanningDomain))?.fitScore, null);
assert.equal((await getProspect(partialPlanningDomain))?.planningComplete, false);

await updateProspectForRun(partialPlanningDomain, partialPlanningRunId, {
  planningComplete: true,
  fitScore: 72,
  angle: 'Complete planner result'
});
await insertOpportunity({
  ...reviewableOpportunity,
  id: crypto.randomUUID(),
  domain: partialPlanningDomain,
  runId: partialPlanningRunId,
  status: 'candidate',
  decision: null,
  approvalToken: null
});
assert.equal(await clearIncompleteOpportunityPlanning(partialPlanningDomain, partialPlanningRunId), false);
assert.equal((await getOpportunities(partialPlanningDomain, partialPlanningRunId)).length, 1);

const completionDomain = 'completion.example';
const completionRunId = 'completion-run';
const completionOpportunityId = crypto.randomUUID();
await upsertProspect(completionDomain, { status: 'researching', runId: completionRunId });
await insertOpportunity({
  ...reviewableOpportunity,
  id: completionOpportunityId,
  domain: completionDomain,
  runId: completionRunId,
  status: 'drafting',
  decision: null,
  approvalToken: null
});
assert.equal(
  await updateOpportunityForRun(completionOpportunityId, { status: 'awaiting_approval' }) !== null,
  true
);
const completionToken = approvalToken(completionOpportunityId, completionRunId);
await stepRequestOpportunityApproval(completionOpportunityId, completionToken);
assert.equal((await getOpportunity(completionOpportunityId))?.status, 'awaiting_approval');
assert.equal((await getOpportunity(completionOpportunityId))?.approvalToken, completionToken);
await updateOpportunity(completionOpportunityId, { status: 'rejected' });
await updateProspectForRun(completionDomain, completionRunId, { status: 'researching', error: null });
assert.equal(await stepFinishOpportunityPlanning(completionDomain, completionRunId), 'rejected');
assert.equal((await getProspect(completionDomain))?.status, 'rejected');
await updateOpportunity(completionOpportunityId, { status: 'approved' });
await updateProspectForRun(completionDomain, completionRunId, { status: 'researching', error: null });
assert.equal(await stepFinishOpportunityPlanning(completionDomain, completionRunId), 'approved');
assert.equal((await getProspect(completionDomain))?.status, 'approved');

const result = await applyOpportunityDecision(token, {
  decision: 'approved',
  by: 'e2e-test',
  via: 'dashboard'
});
assert.equal(result.applied, true);
assert.equal((await getOpportunity(id))?.status, 'approved');
assert.equal((await getProspect(domain))?.status, 'approved');

await updateOpportunity(id, {
  contactActivity: [{
    id: 'research.buyer-activity.fixture',
    personName: 'Taylor Example',
    text: 'Taylor discussed durable AI systems.',
    sourceUrl: 'https://example.com/taylor-post',
    sourceType: 'blog',
    publishedAt: null,
    relevance: 'Relevant to durable agents'
  }]
});
const enrichedOpportunity = await getOpportunity(id);
assert.equal(enrichedOpportunity?.contactActivity?.length, 1);
process.env.RUN_SECRET = 'bulk-action-secret';
const { POST: askProspect } = await import('@/app/api/prospects/[domain]/ask/route');
const askContext = { params: Promise.resolve({ domain: supersededDomain }) };
const askRequest = (question: string, authorized = true) => new Request('https://example.com/api/prospects/superseded.example/ask', {
  method: 'POST',
  headers: {
    ...(authorized ? { authorization: 'Bearer bulk-action-secret' } : {}),
    'content-type': 'application/json'
  },
  body: JSON.stringify({ question })
});
assert.equal((await askProspect(askRequest('What is known? ', false), askContext)).status, 401);
assert.equal((await askProspect(askRequest(' '), askContext)).status, 400);
const noEvidenceResponse = await askProspect(askRequest('What is known?'), askContext);
assert.equal(noEvidenceResponse.status, 200);
assert.deepEqual(await noEvidenceResponse.json(), {
  answer: 'no evidence found to answer this question',
  evidence: []
});
const { DELETE: deleteProspects } = await import('@/app/api/prospects/route');
const deleteResponse = await deleteProspects(new Request('https://example.com/api/prospects', {
  method: 'DELETE',
  headers: {
    authorization: 'Bearer bulk-action-secret',
    'content-type': 'application/json'
  },
  body: JSON.stringify({ domains: [domain, completionDomain] })
}));
assert.equal(deleteResponse.status, 200);
assert.deepEqual((await deleteResponse.json()).deleted.toSorted(), [completionDomain, domain].toSorted());
assert.equal(await getProspect(domain), null);
assert.equal(await getOpportunity(id), null, 'bulk account deletion should cascade to opportunities');
delete process.env.RUN_SECRET;
console.log('✓ e2e: account → scored expansion opportunity → grounded draft → approval → parent status');
console.log('✓ bulk actions: authenticated multi-account deletion cascades to opportunities');
console.log('✓ run ownership: superseded runs cannot overwrite current account or opportunity state');
console.log('✓ clean retries: failed state is cleared and old opportunities are not transplanted');
console.log('✓ opportunity completion: review publication and final decisions update parent state');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
