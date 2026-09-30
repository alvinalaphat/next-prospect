'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, getSecret, setSecret } from '@/lib/client-secret';
import { parseDomains } from '@/lib/domains';
import { cn } from '@/lib/utils';

const MAX_DOMAINS = 250;

export function RunPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [domains, setDomains] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [secret, setSecretState] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setSecretState(getSecret()), []);

  // Same parser the API uses, so the preview count matches what will run.
  const parsed = useMemo(() => parseDomains(domains), [domains]);

  async function loadFile(file: File) {
    if (
      !/\.(csv|txt)$/i.test(file.name) &&
      !file.type.includes('csv') &&
      !file.type.startsWith('text/')
    ) {
      toast.error('Upload a .csv or .txt file');
      return;
    }
    if (file.size > 2_000_000) {
      toast.error('File is too large (max 2 MB)');
      return;
    }
    setDomains(await file.text());
    setFileName(file.name);
  }

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
      setFileName(null);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setBusy(false);
    }
  }

  const count = parsed.domains.length;
  const tooMany = count > MAX_DOMAINS;

  return (
    <div className="relative">
      <Button onClick={() => setOpen((o) => !o)} variant={open ? 'outline' : 'default'}>
        <Play /> Run domains
      </Button>
      {open && (
        <div className="bg-background absolute top-full right-0 z-30 mt-2 w-[calc(100vw-2rem)] space-y-3 rounded-lg border p-4 shadow-lg sm:w-[26rem]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Run domains</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) loadFile(file);
            }}
            className={cn(
              'text-muted-foreground hover:text-foreground flex w-full flex-col items-center gap-1 rounded-md border border-dashed px-3 py-4 text-xs transition-colors',
              dragging && 'border-foreground bg-accent text-foreground'
            )}
          >
            <FileUp className="size-4" />
            {fileName ? (
              <span>
                <span className="text-foreground font-medium">{fileName}</span> · click to replace
              </span>
            ) : (
              <span>
                Drop a CSV here or{' '}
                <span className="text-foreground underline underline-offset-2">choose a file</span>
              </span>
            )}
            <span className="text-[11px]">
              Uses a “domain”, “website” or “url” column, or the first column
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
              e.target.value = '';
            }}
          />

          <textarea
            value={domains}
            onChange={(e) => {
              setDomains(e.target.value);
              setFileName(null);
            }}
            rows={4}
            placeholder={'…or paste domains, one per line\nacme.com\nexample.io'}
            className="bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
          />

          {domains.trim() && (
            <p
              className={cn(
                'text-xs',
                tooMany ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
              )}
            >
              <span className="text-foreground font-medium">{count}</span> valid domain
              {count === 1 ? '' : 's'}
              {parsed.invalid.length > 0 && (
                <span title={parsed.invalid.slice(0, 20).join(', ')}>
                  {' '}
                  · {parsed.invalid.length} invalid rows skipped
                </span>
              )}
              {tooMany && ` · max ${MAX_DOMAINS} per batch`}
            </p>
          )}

          <input
            type="password"
            value={secret}
            onChange={(e) => setSecretState(e.target.value)}
            placeholder="RUN_SECRET"
            autoComplete="off"
            className="bg-background h-9 w-full rounded-md border px-3 text-sm"
          />
          <Button onClick={run} disabled={busy || count === 0 || tooMany} className="w-full">
            {busy ? 'Starting…' : `Start ${count || ''} workflow${count === 1 ? '' : 's'}`}
          </Button>
          <p className="text-muted-foreground text-xs">
            One durable workflow per domain, staggered a few seconds apart. Domains already in
            progress are skipped.
          </p>
        </div>
      )}
    </div>
  );
}
