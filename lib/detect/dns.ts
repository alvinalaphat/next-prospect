import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

export type DnsInfo = { cname: string[]; a: string[] };

/**
 * CNAME chain + A records for the apex and www. Apex domains usually can't
 * have a CNAME, so we also look at www — that's where "cname.vercel-dns.com"
 * or "*.cloudfront.net" typically shows up.
 */
export async function lookupDns(domain: string): Promise<DnsInfo> {
  const names = domain.startsWith('www.') ? [domain] : [domain, `www.${domain}`];
  const cname = new Set<string>();
  const a = new Set<string>();

  await Promise.all(
    names.map(async (name) => {
      const [c, ips] = await Promise.all([
        withTimeout(dns.resolveCname(name)).catch(() => [] as string[]),
        withTimeout(dns.resolve4(name)).catch(() => [] as string[])
      ]);
      c.forEach((v) => cname.add(v.toLowerCase().replace(/\.$/, '')));
      if (name === domain) ips.forEach((v) => a.add(v));
    })
  );

  return { cname: [...cname], a: [...a] };
}

function withTimeout<T>(p: Promise<T>, ms = 3_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('dns timeout')), ms))
  ]);
}

/** Guard against pointing the fetcher at internal infrastructure. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** IPv4 CIDR membership, used for known CDN ranges. */
export function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const toInt = (s: string) => s.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(range) & mask);
}
