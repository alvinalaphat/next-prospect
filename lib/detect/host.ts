import type { HostDetection, HostId, Signal } from '@/lib/types';
import { inCidr, type DnsInfo } from './dns';

type Layer = 'platform' | 'cdn';
type Hit = Signal & { host: HostId; layer: Layer; weight: number };

type Rule = {
  id: string;
  host: HostId;
  layer: Layer;
  weight: number;
  label: string;
  test: (h: Record<string, string>, dns: DnsInfo) => string | null;
};

const hdr = (h: Record<string, string>, name: string, re?: RegExp) => {
  const v = h[name];
  if (v === undefined) return null;
  return !re || re.test(v) ? `${name}: ${v}` : null;
};
const cname = (dns: DnsInfo, re: RegExp) => {
  const c = dns.cname.find((c) => re.test(c));
  return c ? `CNAME ${c}` : null;
};
const ip = (dns: DnsInfo, cidrs: string[]) => {
  const a = dns.a.find((a) => cidrs.some((c) => inCidr(a, c)));
  return a ? `A ${a}` : null;
};

// https://www.cloudflare.com/ips-v4
const CLOUDFLARE_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'
];
const VERCEL_V4 = ['76.76.21.0/24', '216.198.79.0/24', '216.150.1.0/24'];

const RULES: Rule[] = [
  // Vercel — any of these means "already a customer"
  { id: 'x-vercel-id', host: 'vercel', layer: 'platform', weight: 1, label: 'x-vercel-id header', test: (h) => hdr(h, 'x-vercel-id') },
  { id: 'server-vercel', host: 'vercel', layer: 'platform', weight: 1, label: 'server: Vercel', test: (h) => hdr(h, 'server', /^vercel$/i) },
  { id: 'x-vercel-cache', host: 'vercel', layer: 'platform', weight: 0.9, label: 'x-vercel-cache header', test: (h) => hdr(h, 'x-vercel-cache') },
  { id: 'cname-vercel', host: 'vercel', layer: 'platform', weight: 0.9, label: 'CNAME to Vercel DNS', test: (_, d) => cname(d, /vercel-dns(-\d+)?\.com$|\.vercel\.app$/) },
  { id: 'a-vercel', host: 'vercel', layer: 'platform', weight: 0.7, label: 'A record in Vercel anycast range', test: (_, d) => ip(d, VERCEL_V4) },

  // Netlify
  { id: 'x-nf-request-id', host: 'netlify', layer: 'platform', weight: 1, label: 'x-nf-request-id header', test: (h) => hdr(h, 'x-nf-request-id') },
  { id: 'server-netlify', host: 'netlify', layer: 'platform', weight: 1, label: 'server: Netlify', test: (h) => hdr(h, 'server', /netlify/i) },
  { id: 'cname-netlify', host: 'netlify', layer: 'platform', weight: 0.9, label: 'CNAME to Netlify', test: (_, d) => cname(d, /netlify\.(app|com)$/) },
  { id: 'a-netlify', host: 'netlify', layer: 'platform', weight: 0.7, label: 'A record 75.2.60.5 (Netlify LB)', test: (_, d) => ip(d, ['75.2.60.5/32']) },

  // AWS
  { id: 'x-amz-cf-id', host: 'aws', layer: 'cdn', weight: 0.9, label: 'x-amz-cf-id header (CloudFront)', test: (h) => hdr(h, 'x-amz-cf-id') },
  { id: 'via-cloudfront', host: 'aws', layer: 'cdn', weight: 0.9, label: 'via: … CloudFront', test: (h) => hdr(h, 'via', /cloudfront/i) },
  { id: 'cname-cloudfront', host: 'aws', layer: 'cdn', weight: 0.8, label: 'CNAME to *.cloudfront.net', test: (_, d) => cname(d, /cloudfront\.net$/) },
  { id: 'cname-amplify', host: 'aws', layer: 'platform', weight: 0.9, label: 'CNAME to AWS Amplify', test: (_, d) => cname(d, /amplifyapp\.com$/) },
  { id: 'cname-elb', host: 'aws', layer: 'platform', weight: 0.8, label: 'CNAME to AWS load balancer', test: (_, d) => cname(d, /elb\.amazonaws\.com$|awsglobalaccelerator\.com$/) },
  { id: 'server-awselb', host: 'aws', layer: 'platform', weight: 0.8, label: 'server: awselb', test: (h) => hdr(h, 'server', /awselb|amazons3/i) },
  { id: 'x-amzn-headers', host: 'aws', layer: 'platform', weight: 0.6, label: 'x-amzn-* headers (API Gateway/Lambda)', test: (h) => { const k = Object.keys(h).find((k) => k.startsWith('x-amzn-')); return k ? `${k}: ${h[k]}` : null; } },

  // Cloudflare
  { id: 'cf-ray', host: 'cloudflare', layer: 'cdn', weight: 0.9, label: 'cf-ray header', test: (h) => hdr(h, 'cf-ray') },
  { id: 'server-cloudflare', host: 'cloudflare', layer: 'cdn', weight: 0.9, label: 'server: cloudflare', test: (h) => hdr(h, 'server', /^cloudflare$/i) },
  { id: 'a-cloudflare', host: 'cloudflare', layer: 'cdn', weight: 0.7, label: 'A record in Cloudflare range', test: (_, d) => ip(d, CLOUDFLARE_V4) },
  { id: 'cname-pages-dev', host: 'cloudflare', layer: 'platform', weight: 0.9, label: 'CNAME to Cloudflare Pages/Workers', test: (_, d) => cname(d, /\.(pages|workers)\.dev$/) },

  // Fastly / Akamai
  { id: 'x-fastly', host: 'fastly', layer: 'cdn', weight: 0.9, label: 'Fastly headers', test: (h) => hdr(h, 'x-fastly-request-id') ?? hdr(h, 'x-served-by', /^cache-/) },
  { id: 'cname-fastly', host: 'fastly', layer: 'cdn', weight: 0.8, label: 'CNAME to Fastly', test: (_, d) => cname(d, /fastly(lb)?\.net$/) },
  { id: 'server-akamai', host: 'akamai', layer: 'cdn', weight: 0.9, label: 'server: AkamaiGHost / akamai headers', test: (h) => hdr(h, 'server', /akamai/i) ?? hdr(h, 'x-akamai-transformed') },
  { id: 'cname-akamai', host: 'akamai', layer: 'cdn', weight: 0.8, label: 'CNAME to Akamai edge', test: (_, d) => cname(d, /(akamaiedge|edgekey|edgesuite|akamai)\.net$/) },

  // Other platforms
  { id: 'gcp', host: 'gcp', layer: 'platform', weight: 0.8, label: 'Google Frontend / Cloud Run', test: (h) => hdr(h, 'server', /google frontend/i) ?? hdr(h, 'x-cloud-trace-context') },
  { id: 'cname-firebase', host: 'gcp', layer: 'platform', weight: 0.8, label: 'CNAME to Firebase Hosting', test: (_, d) => cname(d, /(firebaseapp|web\.app|hosted-by-firebase)/) },
  { id: 'azure', host: 'azure', layer: 'platform', weight: 0.8, label: 'Azure headers', test: (h) => hdr(h, 'x-azure-ref') ?? hdr(h, 'x-msedge-ref') },
  { id: 'cname-azure', host: 'azure', layer: 'platform', weight: 0.8, label: 'CNAME to Azure', test: (_, d) => cname(d, /(azurewebsites\.net|azurefd\.net|azurestaticapps\.net|azureedge\.net)$/) },
  { id: 'render', host: 'render', layer: 'platform', weight: 0.9, label: 'Render headers', test: (h) => hdr(h, 'x-render-origin-server') ?? hdr(h, 'rndr-id') },
  { id: 'fly', host: 'fly', layer: 'platform', weight: 0.9, label: 'Fly.io headers', test: (h) => hdr(h, 'fly-request-id') ?? hdr(h, 'server', /^fly/i) },
  { id: 'railway', host: 'railway', layer: 'platform', weight: 0.9, label: 'Railway edge', test: (h) => hdr(h, 'server', /railway/i) ?? hdr(h, 'x-railway-request-id') },
  { id: 'heroku', host: 'heroku', layer: 'platform', weight: 0.8, label: 'Heroku router', test: (h) => hdr(h, 'via', /vegur/i) }
];

export function detectHost(headers: Record<string, string>, dns: DnsInfo): HostDetection {
  const hits: Hit[] = [];
  for (const rule of RULES) {
    const match = rule.test(headers, dns);
    if (match) {
      hits.push({
        id: rule.id,
        host: rule.host,
        layer: rule.layer,
        weight: rule.weight,
        label: rule.label,
        match: match.slice(0, 200)
      });
    }
  }

  const best = (layer: Layer): HostId | null => {
    const scores = new Map<HostId, number>();
    for (const h of hits.filter((h) => h.layer === layer)) {
      scores.set(h.host, (scores.get(h.host) ?? 0) + h.weight);
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  // Vercel signals pass through any proxy in front, so they always win.
  const vercel = hits.some((h) => h.host === 'vercel' && h.weight >= 0.9);
  const platform = vercel ? 'vercel' : best('platform');
  const cdn = best('cdn');
  const primary = platform ?? cdn ?? 'unknown';

  return {
    primary,
    cdn: cdn && cdn !== primary ? cdn : null,
    signals: hits.map(({ layer: _layer, weight: _weight, ...s }) => s)
  };
}
