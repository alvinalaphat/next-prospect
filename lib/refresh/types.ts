export type MaintenanceKind = 'proof';
export type MaintenanceStatus = 'running' | 'complete' | 'failed';

export type ProofVendor = 'vercel' | 'cloudflare' | 'railway';
export type ProofUsage = 'customer-proof' | 'competitive-context';

export type ProofRecord = {
  id: string;
  vendor: ProofVendor;
  usage: ProofUsage;
  company: string;
  title: string;
  sourceUrl: string;
  summary: string;
  productIds: string[];
  industries: string[];
  workloads: string[];
  candidateClaims: string[];
  publishedAt: string | null;
  lastSeenAt: string;
};

export type ProofRefreshResult = {
  refreshedAt: string;
  discovered: number;
  saved: number;
  byVendor: Record<ProofVendor, number>;
};
