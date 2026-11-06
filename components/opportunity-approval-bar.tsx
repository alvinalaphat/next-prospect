'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { authHeaders, secretCheckMessage, useRunSecret } from '@/lib/client-secret';
import { rejectionReasons, type Draft } from '@/lib/types';

export function OpportunityApprovalBar({ opportunityId, draft }: { opportunityId: string; draft: Draft }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<(typeof rejectionReasons)[number]['value'][]>([]);
  const [rejectionContext, setRejectionContext] = useState('');
  const rejectDialog = useRef<HTMLDialogElement>(null);
  const rejectTitleId = useId();
  const rejectHelpId = useId();
  const secretField = useRunSecret();

  useEffect(() => {
    const dialog = rejectDialog.current;
    if (!dialog) return;
    if (rejectOpen && !dialog.open) dialog.showModal();
    if (!rejectOpen && dialog.open) dialog.close();
  }, [rejectOpen]);

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
          ...(decision === 'approved'
            ? { editedDraft: editing ? { subject, body } : undefined }
            : { rejectionReasons: selectedReasons, rejectionContext: rejectionContext.trim() || undefined })
        })
      });
      const json = await response.json();
      if (response.status === 401) secretField.reveal();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success(decision === 'approved' ? 'Opportunity approved' : 'Opportunity rejected');
      if (decision === 'rejected') setRejectOpen(false);
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
          {secretField.show && !rejectOpen && (
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
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>Reject</Button>
          </div>
        </div>
      </div>
      {editing && (
        <div className="space-y-4">
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Email subject" />
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} aria-label="Email body" />
        </div>
      )}
      <dialog
        ref={rejectDialog}
        aria-labelledby={rejectTitleId}
        aria-describedby={rejectHelpId}
        onCancel={(event) => { if (busy) event.preventDefault(); else setRejectOpen(false); }}
        onClose={() => setRejectOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget && !busy) setRejectOpen(false); }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border bg-background p-0 text-foreground shadow-geist backdrop:bg-overlay backdrop:backdrop-blur-[2px]"
      >
        <form onSubmit={(event) => { event.preventDefault(); void decide('rejected'); }} className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
          <h2 id={rejectTitleId} className="text-lg font-semibold tracking-tight">Reject email draft</h2>
          <p id={rejectHelpId} className="text-muted-foreground mt-2 text-sm leading-6">Select the reasons that apply, or add context for the team.</p>
          <fieldset className="mt-5 space-y-1">
            <legend className="mb-2 text-sm font-medium">Reasons</legend>
            {rejectionReasons.map((reason) => (
              <label key={reason.value} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-hover">
                <Checkbox
                  checked={selectedReasons.includes(reason.value)}
                  disabled={busy}
                  onChange={(event) => setSelectedReasons((current) => event.target.checked
                    ? [...current, reason.value]
                    : current.filter((value) => value !== reason.value))}
                />
                <span className="text-sm">{reason.label}</span>
              </label>
            ))}
          </fieldset>
          <label htmlFor={`${rejectTitleId}-context`} className="mt-5 block text-sm font-medium">More context (optional)</label>
          <Textarea
            id={`${rejectTitleId}-context`}
            value={rejectionContext}
            onChange={(event) => setRejectionContext(event.target.value)}
            maxLength={2000}
            rows={3}
            disabled={busy}
            className="mt-2"
            placeholder="What should change?"
          />
          {secretField.show && (
            <div className="mt-5">
              <label htmlFor={`${rejectTitleId}-secret`} className="text-sm font-medium">Run secret</label>
              <Input
                id={`${rejectTitleId}-secret`}
                type="password"
                value={secretField.secret}
                onChange={(event) => secretField.update(event.target.value)}
                onBlur={() => void secretField.commit()}
                autoComplete="off"
                aria-invalid={secretField.invalid || undefined}
                className="mt-2"
              />
              {secretField.invalid && <p className="text-error mt-1 text-xs">Doesn&apos;t match.</p>}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" variant="destructive" disabled={busy || (selectedReasons.length === 0 && !rejectionContext.trim())}>
              {busy ? 'Saving…' : 'Submit rejection'}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
