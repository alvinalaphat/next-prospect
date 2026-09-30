import { createHandler } from '@vercel/slack-bolt';
import { getProspect } from '@/lib/db';
import { ACTIONS, editModal, receiver, slackApp } from '@/lib/slack';
import { approvalHook } from '@/workflows/outbound/hooks';

const domainFromToken = (token: string) => token.split(':')[1] ?? '';

// Only set up event handlers if Slack is initialized
if (slackApp && receiver) {
  slackApp.action(ACTIONS.approve, async ({ ack, body, action, logger }) => {
    await ack();
    if (action.type !== 'button' || !action.value) return;
    await approvalHook
      .resume(action.value, { decision: 'approved', by: body.user.name ?? body.user.id, via: 'slack' })
      .catch((err) => logger.warn(`resume failed (already decided?): ${err}`));
  });

  slackApp.action(ACTIONS.reject, async ({ ack, body, action, logger }) => {
    await ack();
    if (action.type !== 'button' || !action.value) return;
    await approvalHook
      .resume(action.value, { decision: 'rejected', by: body.user.name ?? body.user.id, via: 'slack' })
      .catch((err) => logger.warn(`resume failed (already decided?): ${err}`));
  });

  slackApp.action(ACTIONS.edit, async ({ ack, body, action, client }) => {
    await ack();
    if (action.type !== 'button' || !action.value || body.type !== 'block_actions') return;
    const prospect = await getProspect(domainFromToken(action.value));
    if (!prospect) return;
    await client.views.open({ trigger_id: body.trigger_id, view: editModal(prospect, action.value) });
  });

  slackApp.view(ACTIONS.editModal, async ({ ack, body, view, logger }) => {
    await ack();
    const values = view.state.values;
    await approvalHook
      .resume(view.private_metadata, {
        decision: 'approved',
        by: body.user.name ?? body.user.id,
        via: 'slack',
        editedDraft: {
          subject: values.subject.value.value ?? '',
          body: values.body.value.value ?? ''
        }
      })
      .catch((err) => logger.warn(`resume failed (already decided?): ${err}`));
  });
}

export const POST =
  slackApp && receiver
    ? createHandler(slackApp, receiver)
    : () =>
        new Response('Slack credentials not configured', {
          status: 503
        });
