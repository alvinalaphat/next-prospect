import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { GMAIL_SCOPE } from '@/lib/gmail';

config({ path: '.env.local', quiet: true });

/**
 * One-time Gmail consent (loopback OAuth for a "Desktop app" client).
 * Opens Google's consent screen in your browser, receives the code on
 * 127.0.0.1, and writes GMAIL_REFRESH_TOKEN into .env.local. The token is
 * never printed.
 */
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first (see README → Gmail).');
    process.exit(1);
  }

  const state = randomBytes(16).toString('hex');
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: 'code',
      scope: GMAIL_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state
    });

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT);
      if (url.pathname !== '/callback') return res.end();
      const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html' });
      res.end(ok ? '<p>Gmail connected. You can close this tab.</p>' : `<p>Failed: ${url.searchParams.get('error') ?? 'bad state'}</p>`);
      server.close();
      ok ? resolve(url.searchParams.get('code')!) : reject(new Error(url.searchParams.get('error') ?? 'bad state'));
    }).listen(PORT, '127.0.0.1');
    console.log(`\nOpening Google consent (scope: gmail.compose — create drafts only).\nIf it doesn't open, visit:\n\n${authUrl}\n`);
    execFile('open', [authUrl], () => {});
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: 'authorization_code' })
  });
  const json = await res.json();
  if (!res.ok || !json.refresh_token) {
    console.error('Token exchange failed:', json.error_description ?? json.error ?? res.status);
    process.exit(1);
  }

  const env = readFileSync('.env.local', 'utf8').replace(/^GMAIL_REFRESH_TOKEN=.*\n?/m, '');
  writeFileSync('.env.local', `${env.trimEnd()}\nGMAIL_REFRESH_TOKEN=${json.refresh_token}\n`);
  console.log('✓ Saved GMAIL_REFRESH_TOKEN to .env.local');
  console.log('\nAdd it to Vercel (paste the value from .env.local when prompted):\n  vercel env add GMAIL_REFRESH_TOKEN production\n');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
