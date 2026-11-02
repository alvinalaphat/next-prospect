'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authHeaders, useRunSecret } from '@/lib/client-secret';

export function OpportunityGmailButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const secretField = useRunSecret();
  async function create() {
    setBusy(true);
    const { value, status } = await secretField.commit();
    if (status !== 'valid') {
      if (status === 'empty') toast.error('Enter the run secret.');
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/gmail-draft`, { method: 'POST', headers: authHeaders(value) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success('Gmail draft created');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }
  return <Button size="sm" variant="outline" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create Gmail draft'}</Button>;
}
