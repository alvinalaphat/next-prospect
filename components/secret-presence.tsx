'use client';

import { useLayoutEffect } from 'react';
import { RUN_SECRET_STORAGE_KEY } from '@/lib/run-secret-key';

/** Restore the pre-paint hide flag before the browser paints hydration. */
export function SecretPresence() {
  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(RUN_SECRET_STORAGE_KEY)) {
        document.documentElement.dataset.secret = 'stored';
      }
    } catch {
      // storage unavailable — the field stays visible
    }
  }, []);
  return null;
}
