import { createHandler } from '@vercel/slack-bolt';
import { parseApprovalToken } from '@/lib/approval-token';
import { applyDecision } from '@/lib/decision';
import { getProspect } from '@/lib/db';
import { ACTIONS, editModal, markSuperseded, receiver, slackApp } from '@/lib/slack';
import type { Approval } from '@/lib/types';

type CardBody = {
  channel?: { id?: string };
  message?: { ts?: string };
  container?: { channel_id?: string; message_ts?: string };
};

const clickedCard = (body: CardBody) => {
  const channel = body.channel?.id ?? body.container?.channel_id;
  const ts = body.message?.ts ?? body.container?.message_ts;
  return channel && ts ? { channel, ts } : null;
};

// Only set up event handlers if Slack is initialized
if (slackApp && receiver) {
  slackApp.action(ACTIONS.approve, async ({ ack, body, action, logger }) => {
    await ack();
    if (action.type !== 'button' || !action.value) return;
    await decide(action.value, { decision: 'approved', by: body.user.name ?? body.user.id, via: 'slack' }, body, logger);
  });

  slackApp.action(ACTIONS.reject, async ({ ack, body, action, logger }) => {
    await ack();
    if (action.type !== 'button' || !action.value) return;
    await decide(action.value, { decision: 'rejected', by: body.user.name ?? body.user.id, via: 'slack' }, body, logger);
  });

  slackApp.action(ACTIONS.edit, async ({ ack, body, action, client }) => {
    await ack();
    if (action.type !== 'button' || !action.value || body.type !== 'block_actions') return;
    const parsed = parseApprovalToken(action.value);
    if (!parsed) return;
    const prospect = await getProspect(parsed.domain);
    if (!prospect || prospect.approvalToken !== action.value) {
      const card = clickedCard(body);
      if (card) {
        await markSuperseded(card, parsed.domain).catch((err) => console.warn('supersede failed', err));
      }
      return;
    }
    await client.views.open({ trigger_id: body.trigger_id, view: editModal(prospect, action.value) });
  });

  slackApp.view(ACTIONS.editModal, async ({ ack, body, view, logger }) => {
    await ack();
    const values = view.state.values;
    await decide(
      view.private_metadata,
      {
        decision: 'approved',
        by: body.user.name ?? body.user.id,
        via: 'slack',
        editedDraft: {
          subject: values.subject.value.value ?? '',
          body: values.body.value.value ?? ''
        }
      },
      {},
      logger
    );
  });
}

async function decide(
  token: string,
  approval: Approval,
  body: CardBody,
  logger: { warn: (message: string) => void }
) {
  const result = await applyDecision(token, approval, clickedCard(body)).catch((err: unknown) => {
    logger.warn(`decision failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  });
  if (result && !result.applied) logger.warn(`decision not applied (${result.reason})`);
}

export const POST =
  slackApp && receiver
    ? createHandler(slackApp, receiver)
    : () =>
        new Response('Slack credentials not configured', {
          status: 503
        });
