'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, getSecret, setSecret } from '@/lib/client-secret';

export function RunPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [domains, setDomains] = useState('');
  const [secret, setSecretState] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setSecretState(getSecret()), []);

  async function run() {
    setBusy(true);
    setSecret(secret);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'text/plain', ...authHeaders(secret) },
        body: domains
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast.success(
        `Started ${json.started.length} workflow${json.started.length === 1 ? '' : 's'}` +
          (json.skippedInFlight.length ? ` · ${json.skippedInFlight.length} already running` : '') +
          (json.invalid.length ? ` · ${json.invalid.length} invalid` : '')
      );
      setDomains('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Play /> Run domains
      </Button>
    );
  }

  return (
    <div className="bg-background w-full space-y-3 rounded-lg border p-4 shadow-sm sm:w-96">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Run domains</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <textarea
        value={domains}
        onChange={(e) => setDomains(e.target.value)}
        rows={5}
        placeholder={'One per line, or paste a CSV with a "domain" column\nacme.com\nexample.io'}
        className="bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
      />
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecretState(e.target.value)}
        placeholder="RUN_SECRET"
        autoComplete="off"
        className="bg-background h-9 w-full rounded-md border px-3 text-sm"
      />
      <Button onClick={run} disabled={busy || !domains.trim()} className="w-full">
        {busy ? 'Starting…' : 'Start workflows'}
      </Button>
      <p className="text-muted-foreground text-xs">
        One durable workflow per domain, staggered a few seconds apart.
      </p>
    </div>
  );
}
