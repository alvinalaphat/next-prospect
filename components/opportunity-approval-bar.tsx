'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { authHeaders, secretCheckMessage, useRunSecret } from '@/lib/client-secret';
import type { Draft } from '@/lib/types';

export function OpportunityApprovalBar({ opportunityId, draft }: { opportunityId: string; draft: Draft }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState(false);
  const secretField = useRunSecret();

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    const { value, status } = await secretField.commit();
    if (status !== 'valid') {
      toast.error(secretCheckMessage(status));
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(value) },
        body: JSON.stringify({
          decision,
          by: 'dashboard',
          editedDraft: editing && decision === 'approved' ? { subject, body } : undefined
        })
      });
      const json = await response.json();
      if (response.status === 401) secretField.reveal();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success(decision === 'approved' ? 'Opportunity approved' : 'Opportunity rejected');
      if (json.gmailError) toast.warning(json.gmailError);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-auto">
          {secretField.show && (
            <div data-secret-slot>
              <Input
                type="password"
                value={secretField.secret}
                onChange={(event) => secretField.update(event.target.value)}
                onBlur={() => void secretField.commit()}
                placeholder="RUN_SECRET"
                autoComplete="off"
                aria-label="Run secret"
                aria-invalid={secretField.invalid || undefined}
                className="w-full text-xs sm:w-40"
              />
              {secretField.invalid && <p className="text-error mt-1 text-xs">Doesn&apos;t match.</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => decide('approved')}>{editing ? 'Save & approve' : 'Approve'}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel edit' : 'Edit'}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decide('rejected')}>Reject</Button>
          </div>
        </div>
      </div>
      {editing && (
        <div className="space-y-4">
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Email subject" />
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} aria-label="Email body" />
        </div>
      )}
    </div>
  );
}
