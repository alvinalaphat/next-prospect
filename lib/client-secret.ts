'use client';

import { useEffect, useState } from 'react';

const KEY = 'next-prospect:run-secret';

/** RUN_SECRET is kept in this browser only, for authorizing runs/decisions. */
export function getSecret(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setSecret(value: string) {
  try {
    localStorage.setItem(KEY, cleanSecret(value));
  } catch {
    // storage unavailable — the caller still has the value for this request
  }
}

/** Mirrors the server's cleanup so a pasted `RUN_SECRET=…` line or stray whitespace still works. */
export function cleanSecret(value: string): string {
  return value
    .trim()
    .replace(/^RUN_SECRET\s*=\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function authHeaders(secret: string): HeadersInit {
  const s = cleanSecret(secret);
  return s ? { authorization: `Bearer ${s}` } : {};
}

export type SecretCheck = 'valid' | 'invalid' | 'empty' | 'error';

/** Ask the server whether this bearer token matches RUN_SECRET. */
export async function checkSecret(value: string): Promise<SecretCheck> {
  const clean = cleanSecret(value);
  if (!clean) return 'empty';
  try {
    const res = await fetch('/api/secret', { method: 'POST', headers: authHeaders(clean) });
    if (res.ok) return 'valid';
    if (res.status === 401) return 'invalid';
    return 'error';
  } catch {
    return 'error';
  }
}

/** Hide the field only after the server accepts the secret. A 401 calls reveal(). */
export function useRunSecret() {
  const [secret, setSecretState] = useState('');
  const [hidden, setHidden] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const stored = getSecret();
    setSecretState(stored);
    if (!stored) return;
    let cancelled = false;
    checkSecret(stored).then((status) => {
      if (cancelled) return;
      if (status === 'valid') setHidden(true);
      if (status === 'invalid') setInvalid(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function commit(): Promise<{ value: string; status: SecretCheck }> {
    const clean = cleanSecret(secret);
    setSecretState(clean);
    if (!clean) {
      setHidden(false);
      setInvalid(false);
      return { value: '', status: 'empty' };
    }
    const status = await checkSecret(clean);
    if (status === 'valid') setSecret(clean);
    else if (status === 'invalid' && getSecret() === clean) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        // ignore
      }
    }
    setHidden(status === 'valid');
    setInvalid(status === 'invalid');
    return { value: clean, status };
  }

  return {
    secret,
    invalid,
    show: !hidden,
    update: (value: string) => {
      setSecretState(value);
      setInvalid(false);
    },
    commit,
    reveal: () => {
      setHidden(false);
      setInvalid(true);
    }
  };
}
