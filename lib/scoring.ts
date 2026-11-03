import type { ProductDefinition, SignalCategory } from '@/lib/catalog/types';

export const ACCOUNT_SIGNAL_RULES = [
  { id: 'account.enterprise-scale', category: 'account_value' as const, points: 15, description: 'Enterprise or strategic scale is directly supported' },
  { id: 'account.growth-scale', category: 'account_value' as const, points: 10, description: 'Growth-stage or meaningful scale is directly supported' },
  { id: 'account.credible-growth', category: 'account_value' as const, points: 5, description: 'Smaller company with a credible growth signal' },
  { id: 'account.low-roi', category: 'risk' as const, points: -10, description: 'Low-priority small or professional-services account' }
] as const;

export type SignalConfidence = 'high' | 'medium' | 'low';

export type SignalMatch = {
  ruleId: string;
  evidenceIds: string[];
  confidence: SignalConfidence;
  observedAt?: string | null;
  explanation: string;
};

export type ScoredSignal = SignalMatch & {
  category: SignalCategory;
  basePoints: number;
  multiplier: number;
  points: number;
};

export type ScoreBreakdown = {
  productFit: number;
  trigger: number;
  accountValue: number;
  buyerQuality: number;
  risk: number;
  total: number;
};

const CONFIDENCE: Record<SignalConfidence, number> = { high: 1, medium: 0.7, low: 0.4 };
const CAPS: Record<Exclude<SignalCategory, 'risk'>, number> = {
  product_fit: 35,
  trigger: 25,
  account_value: 15,
  buyer: 15
};

export function freshnessMultiplier(observedAt?: string | null, now = new Date()): number {
  if (!observedAt) return 0;
  const timestamp = new Date(observedAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const days = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  if (days <= 30) return 1;
  if (days <= 90) return 0.85;
  if (days <= 365) return 0.6;
  return 0.3;
}

export function scoreOpportunity({
  product,
  matches,
  usesVercel,
  buyerQuality = 0,
  now = new Date()
}: {
  product: ProductDefinition;
  matches: SignalMatch[];
  usesVercel: boolean;
  buyerQuality?: number;
  now?: Date;
}): { score: number; breakdown: ScoreBreakdown; signals: ScoredSignal[]; suppressedReason: string | null } {
  if (usesVercel && product.id === 'vercel-platform') {
    return {
      score: 0,
      breakdown: { productFit: 0, trigger: 0, accountValue: 0, buyerQuality: 0, risk: 0, total: 0 },
      signals: [],
      suppressedReason: 'The inspected website is already hosted on Vercel'
    };
  }

  const rules = new Map(product.signals.map((rule) => [rule.id, rule]));
  for (const rule of ACCOUNT_SIGNAL_RULES) rules.set(rule.id, rule);
  const signals = matches.flatMap((match): ScoredSignal[] => {
    const rule = rules.get(match.ruleId);
    if (!rule || match.evidenceIds.length === 0) return [];
    const multiplier = CONFIDENCE[match.confidence] * (rule.freshnessSensitive ? freshnessMultiplier(match.observedAt, now) : 1);
    return [{ ...match, category: rule.category, basePoints: rule.points, multiplier, points: Math.round(rule.points * multiplier) }];
  });

  const sum = (category: SignalCategory) => signals.filter((s) => s.category === category).reduce((total, signal) => total + signal.points, 0);
  const productFit = Math.min(CAPS.product_fit, Math.max(0, sum('product_fit')));
  const trigger = Math.min(CAPS.trigger, Math.max(0, sum('trigger')));
  const accountValue = Math.min(CAPS.account_value, Math.max(0, sum('account_value') + (usesVercel ? 5 : 0)));
  const buyer = Math.min(CAPS.buyer, Math.max(0, buyerQuality));
  const risk = Math.max(-30, Math.min(0, sum('risk')));
  const total = Math.max(0, Math.min(100, productFit + trigger + accountValue + buyer + risk));

  return {
    score: total,
    breakdown: { productFit, trigger, accountValue, buyerQuality: buyer, risk, total },
    signals,
    suppressedReason: productFit === 0 ? 'No grounded product-fit signal' : null
  };
}
