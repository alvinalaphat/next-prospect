'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs"
    >
      <span className="grid size-3" aria-hidden>
        <Copy className={`col-start-1 row-start-1 size-3 transition-opacity duration-150 ease-out-strong ${copied ? 'opacity-0' : ''}`} />
        <Check className={`col-start-1 row-start-1 size-3 transition-opacity duration-150 ease-out-strong ${copied ? '' : 'opacity-0'}`} />
      </span>
      <span className="grid">
        <span aria-hidden={copied} className={`col-start-1 row-start-1 transition-opacity duration-150 ease-out-strong ${copied ? 'opacity-0' : ''}`}>Copy</span>
        <span aria-hidden={!copied} className={`col-start-1 row-start-1 transition-opacity duration-150 ease-out-strong ${copied ? '' : 'opacity-0'}`}>Copied</span>
      </span>
    </button>
  );
}
