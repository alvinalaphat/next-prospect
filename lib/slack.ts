import { App, LogLevel } from '@slack/bolt';
import type { KnownBlock } from '@slack/web-api';
import { VercelReceiver } from '@vercel/slack-bolt';
import type { OpportunityRow, ProspectRow } from '@/lib/db/schema';

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
 * button's `value`, so a click applies to this run and not a later re-run.
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
    { type: 'section', text: { type: 'mrkdwn', text: `*Why*\n${q?.reasoning ?? ''}` } },
    { type: 'section', text: { type: 'mrkdwn', text: stakeholderText(p) } }
  ];

  if (d) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Draft — ${d.subject}*\n_To: ${d.to ? `${d.to.name}${d.to.email ? ` <${d.to.email}>` : ''}` : 'no verified stakeholder'}_\n${d.body}`.slice(0, 2900)
        }
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
    if (p.gmailDraft) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `✉️ <${p.gmailDraft.url}|Gmail draft ready>${p.gmailDraft.to ? '' : ' — add a recipient before sending'}` }]
      });
    } else if (p.gmailError) {
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `⚠️ ${p.gmailError}` }] });
    }
  } else if (p.status === 'expired') {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '⌛ Expired without a decision' }] });
  }

  return blocks;
}

/** Stakeholder line with LinkedIn / email so the reviewer can verify the pick. */
function stakeholderText(p: ProspectRow): string {
  const r = p.research;
  const b = r?.likelyBuyer;
  if (!b?.name) {
    return `*Stakeholder*\n_No named person verified_ — target role: ${b?.role ?? 'unknown'}`;
  }
  const links = [
    b.linkedinUrl ? `<${b.linkedinUrl}|LinkedIn>` : null,
    r?.buyerEmail ? `<mailto:${r.buyerEmail.address}|${r.buyerEmail.address}>` : '_no published email_'
  ].filter(Boolean);
  const alts = b.alternates?.length
    ? `\nAlternates: ${b.alternates
        .map((a) => (a.linkedinUrl ? `<${a.linkedinUrl}|${a.name}>` : a.name) + (a.title ? ` (${a.title})` : ''))
        .join(', ')}`
    : '';
  return `*Stakeholder*\n${b.name}${b.title ? ` — ${b.title}` : ''} · ${links.join(' · ')}${alts}`.slice(0, 2900);
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
/**
 * Mark an older card as superseded (the domain was re-run), removing its
 * buttons so clicks can't silently go nowhere.
 */
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
      { type: 'context', elements: [{ type: 'mrkdwn', text: `<${appUrl(`/prospect/${domain}`)}|Open current brief →>` }] }
    ]
  });
}

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

function opportunityBlocks(
  prospect: ProspectRow,
  opportunity: OpportunityRow,
  token: string | null
): KnownBlock[] {
  const d = opportunity.draft;
  const c = opportunity.contact;
  const b = opportunity.scoreBreakdown;
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${prospect.domain} · ${opportunity.productName} · ${opportunity.score}/100`.slice(0, 150) }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Motion*\n${opportunity.salesMotion === 'expansion' ? 'Expansion' : 'New business'}` },
        { type: 'mrkdwn', text: `*Target*\n${c?.name ?? opportunity.targetRole}${c?.title ? ` — ${c.title}` : ''}`.slice(0, 1900) },
        { type: 'mrkdwn', text: `*Score*\nFit ${b.productFit} · timing ${b.trigger} · account ${b.accountValue} · buyer ${b.buyerQuality}${b.risk ? ` · risk ${b.risk}` : ''}` },
        { type: 'mrkdwn', text: `*Angle*\n${opportunity.angle}`.slice(0, 1900) }
      ]
    },
    { type: 'section', text: { type: 'mrkdwn', text: `*Why now*\n${opportunity.whyNow}`.slice(0, 2900) } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Why Vercel*\n${opportunity.whyVercel}`.slice(0, 2900) } }
  ];
  if (d) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Draft — ${d.subject}*\n_To: ${d.to ? `${d.to.name}${d.to.email ? ` <${d.to.email}>` : ''}` : opportunity.targetRole}_\n${d.body}`.slice(0, 2900)
        }
      }
    );
    if (d.warnings.length) {
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `⚠️ ${d.warnings.join(' · ')}`.slice(0, 2900) }] });
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
