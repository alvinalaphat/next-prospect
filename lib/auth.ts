/**
 * Starting runs costs money (LLM + Exa + PSI quota) and approvals are
 * decisions, so both require RUN_SECRET. Reads stay public for the demo;
 * put the deployment behind Vercel Authentication for anything real.
 */
export function isAuthorized(request: Request): boolean {
  const secret = process.env.RUN_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export const unauthorized = () => Response.json({ error: 'Unauthorized' }, { status: 401 });
