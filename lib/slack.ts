import { App, LogLevel } from '@slack/bolt';
import type { KnownBlock } from '@slack/web-api';
import { VercelReceiver } from '@vercel/slack-bolt';
import type { ProspectRow } from '@/lib/db/schema';

const logLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;

const hasSlackCredentials = process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET;

if (!hasSlackCredentials) {
  console.warn(
    '⚠️  SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET is not set. Slack integration will be disabled.'
  );
}

// Only initialize Slack if credentials are available
export const receiver = hasSlackCredentials
  ? new VercelReceiver({
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      logLevel
    })
  : null;

/**
 * Slack App instance
 */
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
  approve: 'prospect_approve',
  edit: 'prospect_edit',
  reject: 'prospect_reject',
  editModal: 'prospect_edit_modal'
} as const;

export function appUrl(path = '') {
  const base =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000');
  return `${base}${path}`;
}

function client() {
  if (!slackApp) {
    throw new Error(
      'Slack app is not initialized. Please set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET environment variables.'
    );
  }
  return slackApp.client;
}

/**
 * Block Kit card for a prospect. The approval token rides along in each
 * button's `value`, so the click handler can resume the exact workflow run.
 */
function prospectBlocks(p: ProspectRow, token: string | null): KnownBlock[] {
  const q = p.qualification;
  const d = p.draft;
  const m = p.perf?.mobile;
  const fmt = (n: number | null | undefined, unit = '') => (n == null ? '—' : `${n}${unit}`);

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${p.domain} · fit ${p.fitScore ?? '—'}/100` }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Host*\n${p.host}${p.detection?.host.cdn ? ` (behind ${p.detection.host.cdn})` : ''}` },
        { type: 'mrkdwn', text: `*Next.js*\n${p.detection?.nextjs.router ?? '?'} router · ${p.nextjsConfidence}% conf.` },
        { type: 'mrkdwn', text: `*Mobile perf*\n${fmt(m?.score)} · LCP ${fmt(m?.field.lcpMs ?? m?.lab.lcpMs, 'ms')} · TTFB ${fmt(m?.field.ttfbMs ?? m?.lab.ttfbMs, 'ms')}` },
        { type: 'mrkdwn', text: `*Angle*\n${q?.strongestAngle.label ?? '—'}` }
      ]
    },
    { type: 'section', text: { type: 'mrkdwn', text: `*Why*\n${q?.reasoning ?? ''}` } }
  ];

  if (d) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Draft — ${d.subject}*\n${d.body}`.slice(0, 2900) }
      }
    );
    if (d.warnings.length) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `⚠️ ${d.warnings.join(' · ')}`.slice(0, 2900) }]
      });
    }
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `<${appUrl(`/prospect/${p.domain}`)}|Full brief with sources →>` }]
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
  } else if (p.approval) {
    const verb = p.status === 'approved' ? '✅ Approved' : p.status === 'rejected' ? '❌ Rejected' : p.status;
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${verb} by ${p.approval.by} via ${p.approval.via}${p.approval.editedDraft ? ' (edited)' : ''}`
        }
      ]
    });
  } else if (p.status === 'expired') {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '⌛ Expired without a decision' }] });
  }

  return blocks;
}

export async function postApprovalRequest(p: ProspectRow, token: string) {
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!channel) throw new Error('SLACK_CHANNEL_ID is not set');

  const result = await client().chat.postMessage({
    channel,
    text: `New prospect: ${p.domain} (fit ${p.fitScore}/100)`,
    blocks: prospectBlocks(p, token)
  });
  if (!result.ok || !result.ts) throw new Error('Failed to send Slack message');
  return { channel: result.channel!, ts: result.ts };
}

/** Replace the buttons with the outcome once a decision is recorded. */
export async function updateApprovalMessage(p: ProspectRow) {
  if (!p.slack) return;
  await client().chat.update({
    channel: p.slack.channel,
    ts: p.slack.ts,
    text: `${p.domain}: ${p.status}`,
    blocks: prospectBlocks(p, null)
  });
}

export function editModal(p: ProspectRow, token: string) {
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
        element: { type: 'plain_text_input' as const, action_id: 'value', initial_value: p.draft?.subject ?? '' }
      },
      {
        type: 'input' as const,
        block_id: 'body',
        label: { type: 'plain_text' as const, text: 'Body' },
        element: { type: 'plain_text_input' as const, action_id: 'value', multiline: true, initial_value: p.draft?.body ?? '' }
      }
    ]
  };
}
