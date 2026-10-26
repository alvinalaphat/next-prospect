import { isAuthorized, unauthorized } from '@/lib/auth';

/** POST /api/secret — check the bearer token without starting a run. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  return Response.json({ ok: true });
}
