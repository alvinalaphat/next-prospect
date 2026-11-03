import { listActiveProofRecords } from '@/lib/db';

export async function selectOpportunityProof(productId: string, limit = 2) {
  const records = (await listActiveProofRecords()).filter((record) => record.productIds.includes(productId));
  const customerProof = records
    .filter((record) => record.usage === 'customer-proof' && record.vendor === 'vercel')
    .slice(0, limit);
  const competitiveContext = records
    .filter((record) => record.usage === 'competitive-context')
    .slice(0, limit);
  return {
    customerProof,
    competitiveContext,
    proofIds: customerProof.map((record) => record.id),
    competitiveContextIds: competitiveContext.map((record) => record.id)
  };
}
