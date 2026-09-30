import { isAuthorized, unauthorized } from '@/lib/auth';
import { getProspect, upsertProspect } from '@/lib/db';
import { createGmailDraft, isGmailConfigured } from '@/lib/gmail';
import { updateApprovalMessage } from '@/lib/slack';

/**
 * POST /api/prospects/:domain/gmail-draft — create (or re-create) the Gmail
 * draft for an approved prospect, e.g. one approved before Gmail was set up.
 */
export async function POST(request: Request, ctx: { params: Promise<{ domain: string }> }) {
  if (!isAuthorized(request)) return unauthorized();
  if (!isGmailConfigured()) {
    return Response.json({ error: 'Gmail is not configured (run pnpm gmail:auth)' }, { status: 503 });
  }
  const { domain } = await ctx.params;
  const prospect = await getProspect(domain);
  if (!prospect || prospect.status !== 'approved') {
    return Response.json({ error: 'Only approved prospects get drafts' }, { status: 409 });
  }

  try {
    const gmailDraft = await createGmailDraft(prospect);
    await upsertProspect(domain, { gmailDraft, gmailError: null });
    if (prospect.slack) await updateApprovalMessage({ ...prospect, gmailDraft }).catch(() => {});
    return Response.json({ gmailDraft });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertProspect(domain, { gmailError: message });
    return Response.json({ error: message }, { status: 502 });
  }
}
