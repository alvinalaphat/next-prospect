'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, getSecret, setSecret } from '@/lib/client-secret';
import type { Draft } from '@/lib/types';

/**
 * Dashboard twin of the Slack buttons: resumes the same workflow hook.
 * Approve only marks the prospect approved — nothing is ever sent.
 */
export function ApprovalBar({ domain, draft }: { domain: string; draft: Draft }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [secret, setSecretState] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setSecretState(getSecret()), []);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    setSecret(secret);
    try {
      const res = await fetch(`/api/prospects/${domain}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(secret) },
        body: JSON.stringify({
          decision,
          by: 'dashboard',
          editedDraft: editing && decision === 'approved' ? { subject, body } : undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast.success(decision === 'approved' ? 'Approved' : 'Rejected');
      // The workflow records the decision in its next step; give it a moment.
      setTimeout(() => router.refresh(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="text-sm">
          <span className="font-medium">Waiting for review.</span>{' '}
          <span className="text-muted-foreground">The workflow is suspended until someone decides here or in Slack.</span>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecretState(e.target.value)}
            placeholder="RUN_SECRET"
            autoComplete="off"
            className="bg-background h-8 w-32 rounded-md border px-2 text-xs"
          />
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
      {editing && (
        <div className="space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="bg-background h-9 w-full rounded-md border px-3 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}
