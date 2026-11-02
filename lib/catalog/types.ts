export type ProductCategory =
  | 'platform'
  | 'compute'
  | 'ai'
  | 'observability'
  | 'security'
  | 'collaboration'
  | 'storage'
  | 'developer-tools';

export type SignalCategory = 'product_fit' | 'trigger' | 'account_value' | 'buyer' | 'risk';

export type ProductSignalRule = {
  id: string;
  description: string;
  category: SignalCategory;
  points: number;
  freshnessSensitive?: boolean;
};

/**
 * A compact, code-reviewed sales playbook. All products are visible to the
 * router; only the detailed definitions for plausible products are sent to
 * the opportunity planner.
 */
export type ProductDefinition = {
  id: string;
  name: string;
  category: ProductCategory;
  kind: 'product' | 'capability';
  canCreateOpportunity: boolean;
  parentId?: string;
  summary: string;
  targetRoles: string[];
  signals: ProductSignalRule[];
  approvedClaims: string[];
  prohibitedClaims: string[];
  emeaNotes?: string[];
};
