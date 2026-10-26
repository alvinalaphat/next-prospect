'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-hover hover:text-foreground"
    >
      <Sun
        className="theme-icon size-4 scale-100 opacity-100 transition-[transform,opacity] duration-[160ms] ease-out-strong dark:scale-95 dark:opacity-0"
        aria-hidden
      />
      <Moon
        className="theme-icon absolute size-4 scale-95 opacity-0 transition-[transform,opacity] duration-[160ms] ease-out-strong dark:scale-100 dark:opacity-100"
        aria-hidden
      />
    </button>
  );
}
