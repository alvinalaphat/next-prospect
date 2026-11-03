export type MaintenanceKind = 'catalog' | 'proof';
export type MaintenanceStatus = 'running' | 'complete' | 'failed';

export type CatalogSnapshotItem = {
  name: string;
  summary: string;
  sourceUrl: string;
  lifecycle: 'ga' | 'beta' | 'deprecated' | 'unknown';
  announcedAt: string | null;
  catalogProductId: string | null;
  status: 'matched' | 'new' | 'possible-change';
  notes: string;
};
export type CatalogAuditResult = {
  checkedAt: string;
  items: CatalogSnapshotItem[];
  matchedProductIds: string[];
  notObservedCatalogProductIds: string[];
  candidateAdditions: CatalogSnapshotItem[];
  possibleChanges: CatalogSnapshotItem[];
};

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
