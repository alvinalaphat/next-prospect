'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { RUN_SECRET_STORAGE_KEY } from '@/lib/run-secret-key';

function setSecretPresence(stored: boolean) {
  if (typeof document === 'undefined') return;
  if (stored) document.documentElement.dataset.secret = 'stored';
  else delete document.documentElement.dataset.secret;
}

function getStoredSecret(): string {
  try {
    return localStorage.getItem(RUN_SECRET_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function persistSecret(value: string) {
  try {
    localStorage.setItem(RUN_SECRET_STORAGE_KEY, value);
  } catch {
    // Storage is optional; the in-memory value still authorizes this session.
  }
}

function removeStoredSecret(value: string) {
  if (getStoredSecret() !== value) return;
  try {
    localStorage.removeItem(RUN_SECRET_STORAGE_KEY);
  } catch {
    // Storage is optional.
  }
}

/** Mirrors the server cleanup so pasted env assignments and quotes still work. */
export function cleanSecret(value: string): string {
  return value
    .trim()
    .replace(/^RUN_SECRET\s*=\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function authHeaders(secret: string): HeadersInit {
  const value = cleanSecret(secret);
  return value ? { authorization: `Bearer ${value}` } : {};
}

export type SecretCheck = 'valid' | 'invalid' | 'empty' | 'error';

export function secretCheckMessage(status: SecretCheck): string | null {
  if (status === 'valid') return null;
  if (status === 'empty') return 'Enter the run secret.';
  if (status === 'invalid') return 'The run secret is invalid.';
  return 'The run secret could not be verified.';
}

async function checkSecret(value: string): Promise<SecretCheck> {
  const clean = cleanSecret(value);
  if (!clean) return 'empty';
  try {
    const response = await fetch('/api/secret', {
      method: 'POST',
      headers: authHeaders(clean)
    });
    if (response.ok) return 'valid';
    if (response.status === 401) return 'invalid';
    return 'error';
  } catch {
    return 'error';
  }
}

type RunSecretContextValue = {
  secret: string;
  invalid: boolean;
  show: boolean;
  update: (value: string) => void;
  commit: () => Promise<{ value: string; status: SecretCheck }>;
  reveal: () => void;
};

const RunSecretContext = createContext<RunSecretContextValue | null>(null);

/** One shared secret state and validation request for every protected control. */
export function RunSecretProvider({ children }: { children: React.ReactNode }) {
  const [secret, setSecret] = useState('');
  const [hidden, setHidden] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [validatedSecret, setValidatedSecret] = useState('');

  useEffect(() => {
    const stored = cleanSecret(getStoredSecret());
    setSecret(stored);
    if (!stored) {
      setSecretPresence(false);
      return;
    }

    let cancelled = false;
    void checkSecret(stored).then((status) => {
      if (cancelled) return;
      if (status === 'valid') {
        setValidatedSecret(stored);
        setHidden(true);
        setSecretPresence(true);
        return;
      }
      setSecretPresence(false);
      setHidden(false);
      setInvalid(status === 'invalid');
      if (status === 'invalid') removeStoredSecret(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((value: string) => {
    setSecret(value);
    setValidatedSecret('');
    setInvalid(false);
  }, []);

  const commit = useCallback(async () => {
    const clean = cleanSecret(secret);
    setSecret(clean);
    if (!clean) {
      setSecretPresence(false);
      setHidden(false);
      setInvalid(false);
      setValidatedSecret('');
      return { value: '', status: 'empty' as const };
    }

    if (clean === validatedSecret) {
      return { value: clean, status: 'valid' as const };
    }

    const status = await checkSecret(clean);
    if (status === 'valid') {
      persistSecret(clean);
      setValidatedSecret(clean);
      setSecretPresence(true);
      setHidden(true);
      setInvalid(false);
    } else {
      setSecretPresence(false);
      setHidden(false);
      setInvalid(status === 'invalid');
      setValidatedSecret('');
      if (status === 'invalid') removeStoredSecret(clean);
    }
    return { value: clean, status };
  }, [secret, validatedSecret]);

  const reveal = useCallback(() => {
    const clean = cleanSecret(secret);
    setSecretPresence(false);
    setHidden(false);
    setInvalid(true);
    setValidatedSecret('');
    removeStoredSecret(clean);
  }, [secret]);

  const value = useMemo<RunSecretContextValue>(() => ({
    secret,
    invalid,
    show: !hidden,
    update,
    commit,
    reveal
  }), [commit, hidden, invalid, reveal, secret, update]);

  return <RunSecretContext.Provider value={value}>{children}</RunSecretContext.Provider>;
}

export function useRunSecret(): RunSecretContextValue {
  const value = useContext(RunSecretContext);
  if (!value) throw new Error('useRunSecret must be used inside RunSecretProvider');
  return value;
}
