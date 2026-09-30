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
    localStorage.setItem(KEY, value);
  } catch {
    // storage unavailable — the caller still has the value for this request
  }
}

export function authHeaders(secret: string): HeadersInit {
  return secret ? { authorization: `Bearer ${secret}` } : {};
}
