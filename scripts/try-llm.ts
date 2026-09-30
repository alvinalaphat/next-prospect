import { config } from 'dotenv';
config({ path: '.env.local' });
import { detect, detectionEvidence } from '@/lib/detect';
import { qualify, writeDraft } from '@/lib/services';

/** Dev helper: detect → qualify → draft for one domain, without DB or workflow. */
async function main() {
  const domain = process.argv[2] ?? 'mongodb.com';
  const d = await detect(domain);
  const ledger = detectionEvidence(d);
  const t0 = Date.now();
  const { qualification, warnings } = await qualify(domain, ledger);
  console.log(JSON.stringify({ qualification, warnings }, null, 2));
  const draft = await writeDraft(domain, ledger, qualification);
  console.log(JSON.stringify(draft, null, 2));
  console.log(`LLM time ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
main();
