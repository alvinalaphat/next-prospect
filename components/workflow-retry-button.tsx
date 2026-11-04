'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, useRunSecret } from '@/lib/client-secret';

export function WorkflowRetryButton({ domain }: { domain: string }) {
  const router = useRouter();
  const secretField = useRunSecret();
  const [busy, setBusy] = useState(false);
  const [promptForSecret, setPromptForSecret] = useState(false);

  async function retry() {
    setBusy(true);
    const result = await secretField.commit();
    if (result.status !== 'valid') {
      setPromptForSecret(true);
      toast.error(
        result.status === 'empty'
          ? 'Enter the run secret to retry this workflow.'
          : result.status === 'invalid'
            ? 'The run secret is invalid.'
            : 'The run secret could not be verified.'
      );
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(`/api/prospects/${encodeURIComponent(domain)}/retry`, {
        method: 'POST',
        headers: authHeaders(result.value)
      });
      const json = await response.json();
      if (response.status === 401) {
        secretField.reveal();
        setPromptForSecret(true);
      }
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success(`Retrying ${domain} from its last completed stage`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to retry workflow');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
      {promptForSecret && secretField.show && (
        <input
          type="password"
          value={secretField.secret}
          onChange={(event) => secretField.update(event.target.value)}
          onBlur={() => void secretField.commit()}
          placeholder="RUN_SECRET"
          aria-label={`Run secret for retrying ${domain}`}
          aria-invalid={secretField.invalid}
          className="bg-background h-10 w-full rounded-lg border border-error/40 px-3 text-sm text-foreground sm:w-48"
          autoFocus
        />
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-error/40 text-error hover:bg-error/10"
        disabled={busy}
        onClick={retry}
      >
        <RefreshCw className={busy ? 'animate-spin' : ''} />
        {busy ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}
