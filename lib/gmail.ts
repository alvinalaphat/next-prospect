import type { OpportunityRow } from '@/lib/db/schema';
import { stripEmDashes } from '@/lib/email-text';

/**
 * Gmail drafts for approved prospects.
 *
 * Uses OAuth with the narrow `gmail.compose` scope and a refresh token
 * minted once by `pnpm gmail:auth`. We only ever call drafts.create — the
 * rep reviews and clicks Send in Gmail themselves.
 *
 * The customer's published address goes in To. From is the connected Gmail
 * account: Gmail's composer leaves the recipient blank on API drafts that
 * omit From or base64-encode the whole body.
 */

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
export const VERCEL_LANDING_URL = 'https://vercel.com';

export type GmailDraft = { id: string; messageId: string; url: string; to: string | null; createdAt: string };

export function isGmailConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

export class GmailAuthError extends Error {}

async function accessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token'
    })
  });
  const json = await res.json();
  if (!res.ok) {
    // invalid_grant = revoked or expired (Testing-mode OAuth apps expire tokens after 7 days)
    throw new GmailAuthError(
      `Gmail token refresh failed (${json.error ?? res.status}) — re-run \`pnpm gmail:auth\``
    );
  }
  return json.access_token as string;
}

/** Mailbox that owns the refresh token. Required as From so Gmail shows To. */
async function accountEmail(token: string): Promise<string> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { authorization: `Bearer ${token}` }
  });
  const json = await res.json();
  if (!res.ok || typeof json.emailAddress !== 'string') {
    throw new Error(`Gmail profile lookup failed (${json.error?.message ?? res.status})`);
  }
  return json.emailAddress;
}

/** RFC 2047 encoded-word for non-ASCII headers. */
const encodeHeader = (v: string) =>
  /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;

/** `Name <email>` with quoting / RFC 2047 so a comma or accent doesn't drop the header. */
export function formatMailbox(name: string | null | undefined, email: string): string {
  const address = email.trim();
  const display = name?.trim() ?? '';
  if (!display) return address;
  if (/[^\x20-\x7e]/.test(display)) return `${encodeHeader(display)} <${address}>`;
  return `"${display.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" <${address}>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain copy with the first "Vercel" linked to the marketing site. */
export function emailHtml(body: string): string {
  let linkedOnce = false;
  const paragraphs = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const linked = escapeHtml(p)
        .replace(/\n/g, '<br>')
        .replace(/(^|[^A-Za-z0-9./])(Vercel)(?![A-Za-z0-9.])/gi, (match, pre, word) => {
          if (linkedOnce) return match;
          linkedOnce = true;
          return `${pre}<a href="${VERCEL_LANDING_URL}">${word}</a>`;
        });
      return `<p style="margin:0 0 16px">${linked}</p>`;
    });
  return `<!DOCTYPE html><html><body>${paragraphs.join('')}</body></html>`;
}

/** RFC 2045 quoted-printable. Gmail's composer drops To on a base64 body. */
function quotedPrintable(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.map(encodeQpLine).join('\r\n');
}

function encodeQpLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  let out = '';
  let col = 0;
  const emit = (token: string) => {
    if (col + token.length > 75) {
      out += '=\r\n';
      col = 0;
    }
    out += token;
    col += token.length;
  };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const atEnd = i === bytes.length - 1;
    const literal = (b >= 33 && b <= 126 && b !== 61) || ((b === 32 || b === 9) && !atEnd);
    emit(literal ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, '0')}`);
  }
  return out;
}

/**
 * Multipart RFC 5322 message. To is omitted when we don't have a verified address.
 * HTML is what Gmail shows; the plain part is the same copy without the link.
 */
export function buildMime({
  from,
  to,
  subject,
  body
}: {
  from: string;
  to: string | null;
  subject: string;
  body: string;
}) {
  const boundary = `np_${crypto.randomUUID().replace(/-/g, '')}`;
  const headers = [
    `From: ${from}`,
    ...(to ? [`To: ${to}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const part = (contentType: string, content: string) =>
    [
      `--${boundary}`,
      `Content-Type: ${contentType}`,
      'Content-Transfer-Encoding: quoted-printable',
      '',
      quotedPrintable(content)
    ].join('\r\n');
  const parts = [
    part('text/plain; charset="UTF-8"', body),
    part('text/html; charset="UTF-8"', emailHtml(body)),
    `--${boundary}--`,
    ''
  ];
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

/** Create a human-reviewed Gmail draft for one approved opportunity. */
export async function createOpportunityGmailDraft(opportunity: OpportunityRow): Promise<GmailDraft> {
  if (!opportunity.draft) throw new Error(`${opportunity.productName} opportunity has no draft`);
  const d = opportunity.draft;
  const email = d.to?.email ?? opportunity.contact?.email ?? null;
  const to = email ? formatMailbox(d.to?.name ?? opportunity.contact?.name, email) : null;
  const token = await accessToken();
  const from = formatMailbox(process.env.REP_NAME, await accountEmail(token));
  const raw = Buffer.from(
    buildMime({ from, to, subject: stripEmDashes(d.subject), body: stripEmDashes(d.body) })
  ).toString('base64url');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { raw } })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gmail drafts.create failed: ${json.error?.message ?? res.status}`);
  return {
    id: json.id,
    messageId: json.message.id,
    url: `https://mail.google.com/mail/#drafts?compose=${json.message.id}`,
    to,
    createdAt: new Date().toISOString()
  };
}
