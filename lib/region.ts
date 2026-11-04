import type { EvidenceItem, OpportunityContact, Region } from '@/lib/types';

/**
 * EMEA guidance applies when either the company's verified headquarters or the
 * selected buyer's verified work location is in EMEA. A buyer location expands
 * coverage; it never overrides an EMEA headquarters.
 */
export function opportunityRegion(
  companyRegion: Region | null | undefined,
  buyerRegion: OpportunityContact['region'] | undefined
): Region | undefined {
  if (companyRegion?.group === 'emea') return companyRegion;
  if (buyerRegion?.group === 'emea') return buyerRegion;
  return companyRegion ?? buyerRegion ?? undefined;
}

export function buyerRegionEvidence(contact: OpportunityContact): EvidenceItem[] {
  if (!contact.name || !contact.region) return [];
  return [{
    id: 'research.buyer-region',
    source: 'research',
    label: 'Buyer work location',
    value: `${contact.name}: ${contact.region.label}`,
    url: contact.region.sourceUrl
  }];
}
