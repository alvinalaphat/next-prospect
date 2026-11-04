/**
 * Em dashes read like marketing copy. A draft that still has one is rewritten
 * into a sentence break so the character never reaches Gmail.
 */
export function stripEmDashes(text: string): string {
  return text.replace(/[ \t]*—[ \t]*(\p{Ll})?/gu, (match, letter: string | undefined, offset: number, str: string) => {
    const after = str.slice(offset + match.length);
    if (letter) return `. ${letter.toLocaleUpperCase()}`;
    if (!after) return '.';
    if (/^[,.;:!?]/.test(after)) return '';
    return '. ';
  });
}

const questionOpeners = [
  /^(?:would|could|can|will|should)\s+(?:you|we|it|this|that|a|an|the|your|our)\b/i,
  /^(?:are|is|do|does|did)\s+(?:you|we|it|this|that|there|a|an|the|your|our)\b/i,
  /^(?:have|has)\s+(?:you|we|they|it|your|our)\b/i,
  /^open to\s+(?:a|an|exploring|seeing|comparing|discussing|chatting|talking)\b/i,
  /^any interest in\b/i
];
const questionTurn = /,\s*(?:would|could|can|should|will|is|are|do|does)\s+(?:you|it|we|your team|the team)\b/i;

/** Restore question marks when an otherwise clear question ends in a period. */
export function ensureQuestionPunctuation(text: string): string {
  return text.replace(
    /(^|(?<=[.!?])\s+|\n+)((?:[^.!?\n]|\.(?!\s|$))+)\.(?=\s|$)/g,
    (match, prefix: string, sentence: string) => {
      const content = sentence.trimStart();
      const startsAsQuestion = questionOpeners.some((pattern) => pattern.test(content));
      const containsQuestionTurn = questionTurn.test(content);
      return startsAsQuestion || containsQuestionTurn
        ? `${prefix}${sentence}?`
        : match;
    }
  );
}

/** Place an approved closing note after the ask and immediately before the sign-off. */
export function placeClosingNoteBeforeSignoff(body: string, note: string): string {
  const paragraphs = body
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replaceAll(note, '').trim())
    .filter(Boolean);
  const beforeName = Math.max(1, paragraphs.length - 1);
  const hasClosingSalutation = /^(?:best|thanks|regards|cheers),?$/i.test(paragraphs[beforeName - 1] ?? '');
  const insertAt = hasClosingSalutation ? Math.max(1, beforeName - 1) : beforeName;
  paragraphs.splice(insertAt, 0, note);
  return paragraphs.join('\n\n');
}
