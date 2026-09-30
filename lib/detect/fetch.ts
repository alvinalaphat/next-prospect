import { isAllowedByRobots } from './robots';

export const USER_AGENT =
  'NextProspectBot/0.1 (+https://nextprospect.vercel.app/about; research prototype)';
const ROBOTS_TOKEN = 'NextProspectBot';

const ROBOTS_TIMEOUT_MS = 5_000;
const PAGE_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1_500_000;

export type FetchedPage =
  | {
      outcome: 'ok';
      fetchedUrl: string;
      finalUrl: string;
      status: number;
      headers: Record<string, string>;
      html: string;
    }
  | {
      outcome: 'robots_disallowed' | 'unreachable' | 'blocked';
      fetchedUrl: string;
      finalUrl: string | null;
      status: number | null;
      headers: Record<string, string>;
      html: string;
      error: string;
    };

/**
 * Polite homepage fetch: one robots.txt request, then at most one GET of "/"
 * (following redirects). No JS execution, capped body size, hard timeouts.
 */
export async function fetchHomepage(domain: string): Promise<FetchedPage> {
  const fetchedUrl = `https://${domain}/`;

  const robots = await fetchText(`https://${domain}/robots.txt`, ROBOTS_TIMEOUT_MS).catch(
    () => null
  );
  if (robots && robots.status < 400 && !isAllowedByRobots(robots.text, ROBOTS_TOKEN, '/')) {
    return {
      outcome: 'robots_disallowed',
      fetchedUrl,
      finalUrl: null,
      status: null,
      headers: {},
      html: '',
      error: 'robots.txt disallows "/" for our user agent'
    };
  }

  try {
    const res = await fetchText(fetchedUrl, PAGE_TIMEOUT_MS, MAX_BODY_BYTES);
    const base = {
      fetchedUrl,
      finalUrl: res.url,
      status: res.status,
      headers: res.headers,
      html: res.text
    };
    // 403/429/503 from a CDN usually means a bot challenge; headers are still
    // useful for host detection, but the HTML is not the real page.
    if ([401, 403, 429, 503].includes(res.status)) {
      return { ...base, outcome: 'blocked', error: `HTTP ${res.status}` };
    }
    return { ...base, outcome: 'ok' };
  } catch (err) {
    return {
      outcome: 'unreachable',
      fetchedUrl,
      finalUrl: null,
      status: null,
      headers: {},
      html: '',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function fetchText(url: string, timeoutMs: number, maxBytes = 200_000) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    }
  });

  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    url: res.url,
    status: res.status,
    headers,
    text: await readCapped(res, maxBytes)
  };
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (received >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return text + decoder.decode();
}
