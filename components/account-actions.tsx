'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ellipsis, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { authHeaders, secretCheckMessage, useRunSecret } from '@/lib/client-secret';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';

export function AccountActions({ domain }: { domain: string }) {
  const router = useRouter();
  const secretField = useRunSecret();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [busy, setBusy] = useState<'rerun' | 'delete' | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const placeMenu = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    placeMenu();
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open]);

  async function authorized() {
    const result = await secretField.commit();
    if (result.status !== 'valid') toast.error(secretCheckMessage(result.status));
    return result.status === 'valid' ? result.value : null;
  }

  async function rerun() {
    setBusy('rerun');
    const secret = await authorized();
    if (!secret) return setBusy(null);
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(secret) },
        body: JSON.stringify({ domains: [domain], force: true })
      });
      const json = await response.json();
      if (response.status === 401) secretField.reveal();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success(`Re-running ${domain}`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to re-run account');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    const secret = await authorized();
    if (!secret) return setBusy(null);
    try {
      const response = await fetch(`/api/prospects/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
        headers: authHeaders(secret)
      });
      const json = await response.json();
      if (response.status === 401) secretField.reveal();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success(`Deleted ${domain}`);
      setDeleteConfirmOpen(false);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
    <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
      <Button
        ref={triggerRef}
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Actions for ${domain}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy !== null}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis />
      </Button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${domain}`}
          className="bg-background fixed z-50 w-48 rounded-lg border p-1.5 shadow-lg"
          style={{ top: position.top, right: position.right }}
        >
          {secretField.show && (
            <Input
              type="password"
              value={secretField.secret}
              onChange={(event) => secretField.update(event.target.value)}
              onBlur={() => void secretField.commit()}
              placeholder="RUN_SECRET"
              aria-label={`Run secret for ${domain}`}
              className="mb-1.5 h-9 px-2 text-xs"
              autoFocus
            />
          )}
          <button
            type="button"
            role="menuitem"
            disabled={busy !== null}
            onClick={rerun}
            className="hover:bg-hover flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${busy === 'rerun' ? 'animate-spin' : ''}`} />
            Re-run
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy !== null}
            onClick={() => {
              setOpen(false);
              setDeleteConfirmOpen(true);
            }}
            className="text-error hover:bg-hover flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
        </div>,
        document.body
      )}
    </div>
    <ConfirmDialog
      open={deleteConfirmOpen}
      title={`Delete ${domain}?`}
      description="This permanently removes the account and all of its opportunities and drafts. This action cannot be undone."
      confirmLabel="Delete account"
      busy={busy === 'delete'}
      onConfirm={() => void remove()}
      onOpenChange={setDeleteConfirmOpen}
    />
    </>
  );
}
