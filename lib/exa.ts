import Exa from 'exa-js';

let _exa: Exa | null = null;

/** Lazy so the rest of the pipeline runs (and research is skipped) without a key. */
export function exa(): Exa {
  if (!_exa) _exa = new Exa(process.env.EXA_API_KEY);
  return _exa;
}
