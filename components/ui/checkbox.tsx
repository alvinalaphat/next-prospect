'use client';

import { Check, Minus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export function Checkbox({
  checked,
  indeterminate = false,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'checked'> & {
  checked: boolean;
  indeterminate?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={cn('relative inline-flex size-6 shrink-0 items-center justify-center', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        aria-checked={indeterminate ? 'mixed' : checked}
        className="peer absolute inset-0 z-10 size-full cursor-pointer appearance-none rounded-[5px] outline-none disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none flex size-[18px] items-center justify-center rounded-[5px] border bg-background text-background',
          'transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out-strong',
          'peer-hover:border-foreground/50',
          'peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/30',
          'peer-disabled:opacity-50',
          (checked || indeterminate) && 'border-foreground bg-foreground'
        )}
      >
        {indeterminate
          ? <Minus className="size-3.5" strokeWidth={2.5} />
          : <Check className={cn('size-3.5 transition-opacity', checked ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />}
      </span>
    </span>
  );
}
