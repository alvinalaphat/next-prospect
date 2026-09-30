'use client';

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
