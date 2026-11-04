import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { detect } from '@/lib/detect';

type Label = { domain: string; is_nextjs: string; host: string; on_vercel: string };

/**
 * Runs only the deterministic detector (no LLM, no DB) against hand labels
 * and reports precision / recall for "is Next.js" and "is on Vercel", plus
 * host accuracy.
 */
async function main() {
  const labels = Papa.parse<Label>(readFileSync('tests/labels.csv', 'utf8'), {
    header: true,
    skipEmptyLines: true
  }).data;

  const results = await Promise.all(
    labels.map(async (l) => {
      const d = await detect(l.domain);
      return {
        domain: l.domain,
        nextTrue: l.is_nextjs === 'yes',
        nextPred: d.nextjs.isNextjs,
        vercelTrue: l.on_vercel === 'yes',
        vercelPred: d.host.primary === 'vercel',
        hostOk: l.host.split('|').includes(d.host.primary),
        hostTrue: l.host,
        hostPred: d.host.primary + (d.host.cdn ? `+${d.host.cdn}` : ''),
        conf: d.nextjs.confidence,
        outcome: d.outcome
      };
    })
  );

  const pr = (t: (r: (typeof results)[number]) => boolean, p: (r: (typeof results)[number]) => boolean) => {
    const tp = results.filter((r) => t(r) && p(r)).length;
    const fp = results.filter((r) => !t(r) && p(r)).length;
    const fn = results.filter((r) => t(r) && !p(r)).length;
    const precision = tp + fp ? tp / (tp + fp) : 1;
    const recall = tp + fn ? tp / (tp + fn) : 1;
    return { tp, fp, fn, precision, recall };
  };
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  console.log('\ndomain               next.js (label/pred conf)   host (label → pred)             outcome');
  console.log('─'.repeat(100));
  for (const r of results) {
    const mark = (ok: boolean) => (ok ? '✓' : '✗');
    console.log(
      [
        r.domain.padEnd(20),
        `${mark(r.nextTrue === r.nextPred)} ${r.nextTrue ? 'yes' : 'no '} / ${r.nextPred ? 'yes' : 'no '} ${r.conf.toFixed(2)}`.padEnd(27),
        `${mark(r.hostOk)} ${r.hostTrue} → ${r.hostPred}`.padEnd(32),
        r.outcome
      ].join(' ')
    );
  }

  const next = pr((r) => r.nextTrue, (r) => r.nextPred);
  const vercel = pr((r) => r.vercelTrue, (r) => r.vercelPred);
  const hostAcc = results.filter((r) => r.hostOk).length / results.length;

  console.log('\nNext.js detection   ' + `precision ${pct(next.precision)}  recall ${pct(next.recall)}  (tp ${next.tp}, fp ${next.fp}, fn ${next.fn})`);
  console.log('On-Vercel detection ' + `precision ${pct(vercel.precision)}  recall ${pct(vercel.recall)}  (tp ${vercel.tp}, fp ${vercel.fp}, fn ${vercel.fn})`);
  console.log(`Host accuracy       ${pct(hostAcc)}  (${results.filter((r) => r.hostOk).length}/${results.length})\n`);
}

main();
