import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { parseDomains } from '@/lib/domains';

config({ path: '.env.local' });

/**
 * Start a batch from a CSV:  pnpm run:csv data/domains.csv [--url https://…] [--force]
 * Posts the file to /api/run, which starts one durable workflow per domain.
 */
async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--')) ?? 'data/seed.csv';
  const urlIdx = args.indexOf('--url');
  const base = urlIdx >= 0 ? args[urlIdx + 1] : process.env.APP_URL ?? 'http://localhost:3000';
  const force = args.includes('--force');

  const { domains, invalid } = parseDomains(readFileSync(file, 'utf8'));
  if (invalid.length) console.warn(`Ignoring invalid rows: ${invalid.join(', ')}`);
  const res = await fetch(`${base}/api/run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.RUN_SECRET ? { authorization: `Bearer ${process.env.RUN_SECRET}` } : {})
    },
    body: JSON.stringify({ domains, force })
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(res.status, json);
    process.exit(1);
  }
  console.log(`Started ${json.started.length} workflows (batch ${json.batch})`);
  if (json.alreadyRunning.length) console.log(`Already running: ${json.alreadyRunning.join(', ')}`);
  if (json.invalid.length) console.log(`Invalid: ${json.invalid.join(', ')}`);
  console.log(`Dashboard: ${base}/`);
}

main();
