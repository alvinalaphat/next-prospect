'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { authHeaders, secretCheckMessage, useRunSecret } from '@/lib/client-secret';

const POLL_ATTEMPTS = 45;
const POLL_INTERVAL_MS = 1_000;

export function DraftScoreButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const secretField = useRunSecret();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const { value, status } = await secretField.commit();
    if (status !== 'valid') {
      toast.error(secretCheckMessage(status));
      setBusy(false);
      return;
    }

    try {
      const endpoint = `/api/opportunities/${opportunityId}/draft-score`;
      const response = await fetch(endpoint, { method: 'POST', headers: authHeaders(value) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      if (typeof json.score === 'number') {
        router.refresh();
        return;
      }

      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const statusResponse = await fetch(endpoint, { cache: 'no-store' });
        const statusJson = await statusResponse.json();
        if (!statusResponse.ok) {
          throw new Error(statusJson.error ?? `HTTP ${statusResponse.status}`);
        }
        if (typeof statusJson.score === 'number') {
          toast.success(`Draft scored ${statusJson.score}/100`);
          router.refresh();
          return;
        }
      }

      toast.info('The draft score is still generating. Refresh shortly to see it.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate the draft score');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={busy}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/30 inline-flex min-h-8 items-center gap-2 rounded-md px-2 text-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <LoaderCircle className="size-3 animate-spin" aria-hidden /> : <Sparkles className="size-3" aria-hidden />}
      {busy ? 'Generating…' : 'Generate'}
    </button>
  );
}
