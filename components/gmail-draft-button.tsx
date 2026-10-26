'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, getSecret, setSecret } from '@/lib/client-secret';

/** For approved prospects without a draft yet (or to retry after an error). */
export function GmailDraftButton({ domain, label = 'Create Gmail draft' }: { domain: string; label?: string }) {
  const router = useRouter();
  const [secret, setSecretState] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setSecretState(getSecret()), []);

  async function create() {
    setBusy(true);
    setSecret(secret);
    try {
      const res = await fetch(`/api/prospects/${domain}/gmail-draft`, { method: 'POST', headers: authHeaders(secret) });
      const json = await res.json();
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
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecretState(e.target.value)}
        placeholder="RUN_SECRET"
        autoComplete="off"
        className="bg-background w-full rounded-lg border px-3 py-2 text-xs sm:w-40"
      />
      <Button size="sm" variant="outline" disabled={busy} onClick={create} className="w-full sm:w-auto">
        {busy ? 'Creating…' : label}
      </Button>
    </div>
  );
}
