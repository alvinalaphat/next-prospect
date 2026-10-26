'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, useRunSecret } from '@/lib/client-secret';
import type { Draft } from '@/lib/types';

/**
 * Dashboard twin of the Slack buttons. Records the decision directly.
 * Approve only marks the prospect approved — nothing is ever sent.
 */
export function ApprovalBar({ domain, draft }: { domain: string; draft: Draft }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState(false);
  const secretField = useRunSecret();

  async function decide(decision: 'approved' | 'rejected') {
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
      const res = await fetch(`/api/prospects/${domain}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(value) },
        body: JSON.stringify({
          decision,
          by: 'dashboard',
          editedDraft: editing && decision === 'approved' ? { subject, body } : undefined
        })
      });
      const json = await res.json();
      if (res.status === 401) secretField.reveal();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast.success(decision === 'approved' ? 'Approved' : 'Rejected');
      if (json.gmailError) toast.warning(json.gmailError);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-warning/40 bg-hover p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="text-sm">
          <span className="font-medium">Waiting for review.</span>{' '}
          <span className="text-muted-foreground">Approve, edit, or reject here or in Slack. Nothing is sent.</span>
        </div>
        <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-auto sm:max-w-full">
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => decide('approved')}>
              {editing ? 'Save & approve' : 'Approve'}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing((e) => !e)}>
              {editing ? 'Cancel edit' : 'Edit'}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decide('rejected')}>
              Reject
            </Button>
          </div>
        </div>
      </div>
      {editing && (
        <div className="space-y-4">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="bg-background w-full rounded-lg border px-4 py-4 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="bg-background w-full rounded-lg border px-4 py-4 text-sm"
          />
        </div>
      )}
    </div>
  );
}
