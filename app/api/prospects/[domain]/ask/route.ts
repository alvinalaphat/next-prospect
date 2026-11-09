import { z } from 'zod';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { getProspect } from '@/lib/db';
import { answerProspectQuestion } from '@/lib/prospect-qa';

const bodySchema = z.object({ question: z.string().trim().min(1).max(1000) });

export async function POST(request: Request, ctx: { params: Promise<{ domain: string }> }) {
  if (!isAuthorized(request)) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter a question of 1–1000 characters.' }, { status: 400 });

  const { domain } = await ctx.params;
  const prospect = await getProspect(decodeURIComponent(domain));
  if (!prospect) return Response.json({ error: 'Account not found.' }, { status: 404 });

  try {
    return Response.json(await answerProspectQuestion(parsed.data.question, prospect.evidence ?? []));
  } catch {
    return Response.json({ error: 'Could not answer right now. Please try again.' }, { status: 502 });
  }
}
