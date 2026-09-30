import { timingSafeEqual } from 'node:crypto';

/**
 * Starting runs costs money (LLM + Exa + PSI quota) and approvals are
 * decisions, so both require RUN_SECRET. Reads stay public for the demo;
 * put the deployment behind Vercel Authentication for anything real.
 */
export function isAuthorized(request: Request): boolean {
  const secret = cleanSecret(process.env.RUN_SECRET ?? '');
  if (!secret) return process.env.NODE_ENV === 'development';
  const header = request.headers.get('authorization') ?? '';
  const given = cleanSecret(header.replace(/^Bearer\s+/i, ''));
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Forgive common paste mistakes: whitespace, quotes, or the whole `RUN_SECRET=…` line. */
export function cleanSecret(value: string): string {
  return value
    .trim()
    .replace(/^RUN_SECRET\s*=\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export const unauthorized = () =>
  Response.json(
    { error: 'Wrong or missing RUN_SECRET. Paste the value from .env.local (without "RUN_SECRET=").' },
    { status: 401 }
  );
