import type { ProspectRow } from '@/lib/db/schema';

/**
 * Gmail drafts for approved prospects.
 *
 * Uses OAuth with the narrow `gmail.compose` scope and a refresh token
 * minted once by `pnpm gmail:auth`. We only ever call drafts.create — the
 * rep reviews and clicks Send in Gmail themselves.
 */

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';

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

/** RFC 2047 encoded-word for non-ASCII headers. */
const encodeHeader = (v: string) =>
  /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;

/** Plain-text RFC 2822 message; To is omitted when we don't have a verified address. */
export function buildMime({ to, subject, body }: { to: string | null; subject: string; body: string }) {
  const headers = [
    ...(to ? [`To: ${to}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64'
  ];
  const encodedBody = Buffer.from(body.replace(/\r?\n/g, '\r\n'), 'utf8')
    .toString('base64')
    .replace(/.{76}/g, '$&\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${encodedBody}`;
}

export async function createGmailDraft(p: ProspectRow): Promise<GmailDraft> {
  if (!p.draft) throw new Error(`${p.domain} has no draft`);
  const d = p.draft;
  const to = d.to?.email ? `${d.to.name} <${d.to.email}>` : null;
  const raw = Buffer.from(buildMime({ to, subject: d.subject, body: d.body })).toString('base64url');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
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
