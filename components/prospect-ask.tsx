'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { authHeaders, secretCheckMessage, useRunSecret } from '@/lib/client-secret';
import type { ProspectAnswer } from '@/lib/prospect-qa';

export function ProspectAsk({ domain }: { domain: string }) {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<ProspectAnswer | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const secretField = useRunSecret();
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = question.trim();
    if (!submitted || busy) return;

    setBusy(true);
    setResult(null);
    setError('');
    const current = new AbortController();
    controller.current = current;

    try {
      const { value, status } = await secretField.commit();
      if (current.signal.aborted) return;
      if (status !== 'valid') {
        setError(status === 'empty' ? 'Add your run secret on the Accounts page first.' : secretCheckMessage(status) ?? 'Could not verify the run secret.');
        return;
      }

      const response = await fetch(`/api/prospects/${encodeURIComponent(domain)}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(value) },
        body: JSON.stringify({ question: submitted }),
        signal: current.signal
      });
      const json = await response.json();
      if (current.signal.aborted) return;
      if (response.status === 401) secretField.reveal();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      setResult(json as ProspectAnswer);
    } catch (caught) {
      if (!current.signal.aborted) setError(caught instanceof Error ? caught.message : 'Could not answer right now.');
    } finally {
      if (!current.signal.aborted) setBusy(false);
      if (controller.current === current) controller.current = null;
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section aria-labelledby="prospect-ask-title" className="max-w-5xl rounded-xl border border-border p-5 sm:p-6">
      <h2 id="prospect-ask-title" className="text-lg font-semibold tracking-tight">Ask about this prospect</h2>
      <p className="text-muted-foreground mt-1 text-sm">Answers use saved public evidence and link to their sources.</p>
      <form onSubmit={ask} className="mt-5 space-y-3">
        <label htmlFor="prospect-question" className="text-sm font-medium">Your question</label>
        <Textarea
          id="prospect-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What public signals show this company is growing?"
          rows={3}
          maxLength={1000}
          disabled={busy}
          aria-describedby="prospect-ask-hint"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="prospect-ask-hint" className="text-muted-foreground text-xs">Cmd/Ctrl+Enter to ask</p>
          <Button type="submit" disabled={busy || !question.trim()}>{busy ? 'Asking…' : 'Ask'}</Button>
        </div>
      </form>
      <div aria-live="polite" aria-atomic="true" className="mt-5 min-h-10 text-sm leading-6">
        {busy && <p className="text-muted-foreground">Checking the saved evidence…</p>}
        {error && (
          <p className="text-error" role="alert">
            {error} {error.startsWith('Add your run secret') && <Link href="/" className="underline underline-offset-2">Accounts</Link>}
          </p>
        )}
        {result && (
          result.evidence.length ? (
            <ul className="space-y-4">
              {result.evidence.map((item, index) => (
                <li key={`${item.url}-${index}`}>
                  <p>{item.text}</p>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground mt-1 inline-block text-xs underline decoration-dotted underline-offset-2">
                    {item.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : <p>{result.answer}</p>
        )}
      </div>
    </section>
  );
}
