'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, useRunSecret } from '@/lib/client-secret';

/** For approved prospects without a draft yet (or to retry after an error). */
export function GmailDraftButton({ domain, label = 'Create Gmail draft' }: { domain: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const secretField = useRunSecret();

  async function create() {
    setBusy(true);
    const { value, status } = await secretField.commit();
    if (status === 'empty') {
      toast.error('Enter the run secret.');
      setBusy(false);
      return;
    }
    if (status === 'invalid') {
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/prospects/${domain}/gmail-draft`, { method: 'POST', headers: authHeaders(value) });
      const json = await res.json();
      if (res.status === 401) secretField.reveal();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast.success('Gmail draft created');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
      {secretField.show && (
        <div data-secret-slot className="contents">
          <input
            type="password"
            value={secretField.secret}
            onChange={(e) => secretField.update(e.target.value)}
            onBlur={() => void secretField.commit()}
            placeholder="RUN_SECRET"
            autoComplete="off"
            aria-label="Run secret"
            aria-invalid={secretField.invalid || undefined}
            className={`bg-background w-full rounded-lg border px-3 py-2 text-xs sm:w-40 ${secretField.invalid ? 'border-error' : ''}`}
          />
          {secretField.invalid && <p className="text-error text-xs">Doesn't match.</p>}
        </div>
      )}
      <Button size="sm" variant="outline" disabled={busy} onClick={create} className="w-full sm:w-auto">
        {busy ? 'Creating…' : label}
      </Button>
    </div>
  );
}
