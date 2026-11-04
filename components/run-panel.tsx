'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, secretCheckMessage, useRunSecret } from '@/lib/client-secret';
import { parseDomains } from '@/lib/domains';
import { cn } from '@/lib/utils';

const MAX_DOMAINS = 250;

const isFileDrag = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');

export function RunPanel() {
  const router = useRouter();
  const [domains, setDomains] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const secretField = useRunSecret();
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

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
    const { value, status } = await secretField.commit();
    if (status !== 'valid') {
      toast.error(secretCheckMessage(status));
      setBusy(false);
      return;
    }
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'text/plain', ...authHeaders(value) },
        body: domains
      });
      const json = await res.json();
      if (res.status === 401) secretField.reveal();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast.success(
        `Started ${json.started.length} workflow${json.started.length === 1 ? '' : 's'}` +
          (json.alreadyRunning.length ? ` · ${json.alreadyRunning.length} already running` : '') +
          (json.invalid.length ? ` · ${json.invalid.length} invalid` : '')
      );
      setDomains('');
      setFileName(null);
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
    <div className="space-y-4">
      <div
        className={cn(
          'flex flex-col rounded-lg border sm:flex-row sm:items-stretch',
          dragging && 'border-foreground bg-hover'
        )}
        onDragEnter={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          dragDepth.current = 0;
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (!file) return;
          e.preventDefault();
          loadFile(file);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Domains to research</span>
          <textarea
            value={domains}
            onChange={(e) => {
              setDomains(e.target.value);
              setFileName(null);
            }}
            rows={3}
            placeholder={'Paste domains, one per line, or drop a CSV\nacme.com'}
            className="h-full min-h-24 w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-normal outline-none"
          />
        </label>
        <div className="flex shrink-0 gap-4 border-t p-4 sm:flex-col sm:justify-center sm:border-t-0 sm:border-l">
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} className="flex-1 sm:flex-none">
            <FileUp /> Upload CSV
          </Button>
          <Button type="button" onClick={run} disabled={busy || count === 0 || tooMany} className="flex-1 sm:flex-none">
            {busy ? 'Running…' : 'Run'}
          </Button>
        </div>
      </div>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className={cn('text-sm', tooMany ? 'text-error' : 'text-muted-foreground')}>
          {domains.trim() ? (
            <>
              {fileName && <span className="text-foreground">{fileName} · </span>}
              <span className="text-foreground font-medium">{count}</span> domain{count === 1 ? '' : 's'}
              {parsed.invalid.length > 0 && (
                <span title={parsed.invalid.slice(0, 20).join(', ')}>
                  {' '}
                  · {parsed.invalid.length} invalid
                </span>
              )}
              {tooMany && ` · max ${MAX_DOMAINS} per batch`}
            </>
          ) : dragging ? (
            'Drop the file to fill the list'
          ) : (
            'A CSV can use a domain, website, or url column.'
          )}
        </p>
        {secretField.show && (
          <div data-secret-slot className="w-full sm:w-40">
            <input
              type="password"
              value={secretField.secret}
              onChange={(e) => secretField.update(e.target.value)}
              onBlur={() => void secretField.commit()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void secretField.commit();
              }}
              placeholder="RUN_SECRET"
              autoComplete="off"
              aria-label="Run secret"
              aria-invalid={secretField.invalid || undefined}
              className={cn(
                'bg-background h-11 w-full rounded-lg border px-3 text-sm',
                secretField.invalid && 'border-error'
              )}
            />
            {secretField.invalid && <p className="text-error mt-1 text-xs">Doesn't match.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
