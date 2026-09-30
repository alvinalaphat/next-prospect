import { detect } from '@/lib/detect';

async function main() {
const domains = process.argv.slice(2);
for (const domain of domains) {
  const d = await detect(domain);
  console.log(
    [
      domain.padEnd(22),
      d.outcome.padEnd(10),
      `next=${d.nextjs.isNextjs ? 'yes' : 'no '}(${d.nextjs.confidence.toFixed(2)},${d.nextjs.router ?? '-'})`.padEnd(22),
      `host=${d.host.primary}${d.host.cdn ? '+' + d.host.cdn : ''}`.padEnd(24),
      d.nextjs.signals.map((s) => s.id).join(',') + ' | ' + d.host.signals.map((s) => s.id).join(',')
    ].join(' ')
  );
}
}

main();
