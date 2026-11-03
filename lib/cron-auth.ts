export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}
export function cronUnauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
