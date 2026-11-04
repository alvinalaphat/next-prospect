import { App, LogLevel } from '@slack/bolt';
import type { KnownBlock } from '@slack/web-api';
import { VercelReceiver } from '@vercel/slack-bolt';
import type { OpportunityRow, ProspectRow } from '@/lib/db/schema';

const logLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
const hasSlackCredentials = process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET;

if (!hasSlackCredentials) {
  console.warn('⚠️  SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET is not set. Slack integration will be disabled.');
}

export const receiver = hasSlackCredentials
  ? new VercelReceiver({ signingSecret: process.env.SLACK_SIGNING_SECRET!, logLevel })
  : null;

export const slackApp = hasSlackCredentials
  ? new App({
      token: process.env.SLACK_BOT_TOKEN!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      receiver: receiver!,
      deferInitialization: true,
      logLevel
    })
  : null;

export const ACTIONS = {
  // Existing opportunity cards use these IDs. Keep them stable until every
  // published card has expired; handlers below are opportunity-only.
  approve: 'prospect_approve',
  edit: 'prospect_edit',
  reject: 'prospect_reject',
  editModal: 'prospect_edit_modal'
} as const;

export function appUrl(path = '') {
  const base = process.env.APP_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000');
  return `${base}${path}`;
}

function client() {
  if (!slackApp) throw new Error('Slack is not configured');
  return slackApp.client;
}

export async function markSuperseded(
  slack: { channel: string; ts: string },
  domain: string,
  note = 'This domain was re-run — use the newer card below.'
) {
  await client().chat.update({
    channel: slack.channel,
    ts: slack.ts,
    text: `${domain}: superseded`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `~${domain}~ · *superseded*\n${note}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `<${appUrl(`/prospect/${domain}`)}|Open current account →>` }] }
    ]
  });
}

function opportunityBlocks(
  prospect: ProspectRow,
  opportunity: OpportunityRow,
  token: string | null
): KnownBlock[] {
  const draft = opportunity.draft;
  const contact = opportunity.contact;
  const score = opportunity.scoreBreakdown;
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${prospect.domain} · ${opportunity.productName} · ${opportunity.score}/100`.slice(0, 150) }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Motion*\n${opportunity.salesMotion === 'expansion' ? 'Expansion' : 'New business'}` },
        { type: 'mrkdwn', text: `*Target*\n${contact?.name ?? opportunity.targetRole}${contact?.title ? ` — ${contact.title}` : ''}`.slice(0, 1900) },
        { type: 'mrkdwn', text: `*Score*\nFit ${score.productFit} · timing ${score.trigger} · account ${score.accountValue} · buyer ${score.buyerQuality}` },
        { type: 'mrkdwn', text: `*Angle*\n${opportunity.angle}`.slice(0, 1900) }
      ]
    },
    { type: 'section', text: { type: 'mrkdwn', text: `*Why now*\n${opportunity.whyNow}`.slice(0, 2900) } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Why Vercel*\n${opportunity.whyVercel}`.slice(0, 2900) } }
  ];
  if (draft) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Draft — ${draft.subject}*\n_To: ${draft.to ? `${draft.to.name}${draft.to.email ? ` <${draft.to.email}>` : ''}` : opportunity.targetRole}_\n${draft.body}`.slice(0, 2900)
        }
      }
    );
    if (draft.warnings.length) {
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `⚠️ ${draft.warnings.join(' · ')}`.slice(0, 2900) }] });
    }
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `<${appUrl(`/prospect/${prospect.domain}#opportunity-${opportunity.id}`)}|Open account plan with evidence →>` }]
  });
  if (token) {
    blocks.push({
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Approve' }, style: 'primary', action_id: ACTIONS.approve, value: token },
        { type: 'button', text: { type: 'plain_text', text: 'Edit' }, action_id: ACTIONS.edit, value: token },
        { type: 'button', text: { type: 'plain_text', text: 'Reject' }, style: 'danger', action_id: ACTIONS.reject, value: token }
      ]
    });
  } else if (opportunity.decision) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${opportunity.status === 'approved' ? '✅ Approved' : '❌ Rejected'} by ${opportunity.decision.by}${opportunity.gmailDraft ? ` · ✉️ <${opportunity.gmailDraft.url}|Gmail draft>` : ''}` }]
    });
  }
  return blocks;
}

export async function postOpportunityApprovalRequest(
  prospect: ProspectRow,
  opportunity: OpportunityRow,
  token: string
) {
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!channel) throw new Error('SLACK_CHANNEL_ID is not set');
  const result = await client().chat.postMessage({
    channel,
    text: `${prospect.domain}: ${opportunity.productName} opportunity (${opportunity.score}/100)`,
    blocks: opportunityBlocks(prospect, opportunity, token)
  });
  if (!result.ok || !result.ts) throw new Error('Failed to send Slack opportunity message');
  return { channel: result.channel!, ts: result.ts };
}

export async function updateOpportunityApprovalMessage(opportunity: OpportunityRow) {
  if (!opportunity.slack) return;
  const { getProspect } = await import('@/lib/db');
  const prospect = await getProspect(opportunity.domain);
  if (!prospect) return;
  await client().chat.update({
    channel: opportunity.slack.channel,
    ts: opportunity.slack.ts,
    text: `${opportunity.domain}: ${opportunity.productName} ${opportunity.status}`,
    blocks: opportunityBlocks(prospect, opportunity, null)
  });
}

export function opportunityEditModal(opportunity: OpportunityRow, token: string) {
  return {
    type: 'modal' as const,
    callback_id: ACTIONS.editModal,
    private_metadata: token,
    title: { type: 'plain_text' as const, text: 'Edit & approve' },
    submit: { type: 'plain_text' as const, text: 'Approve' },
    close: { type: 'plain_text' as const, text: 'Cancel' },
    blocks: [
      {
        type: 'input' as const,
        block_id: 'subject',
        label: { type: 'plain_text' as const, text: 'Subject' },
        element: { type: 'plain_text_input' as const, action_id: 'value', initial_value: opportunity.draft?.subject ?? '' }
      },
      {
        type: 'input' as const,
        block_id: 'body',
        label: { type: 'plain_text' as const, text: 'Body' },
        element: { type: 'plain_text_input' as const, action_id: 'value', multiline: true, initial_value: opportunity.draft?.body ?? '' }
      }
    ]
  };
}
