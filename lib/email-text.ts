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

/** Insert an approved sentence before the meeting ask and sign-off when omitted. */
export function ensureSentenceBeforeClose(body: string, sentence: string): string {
  if (body.includes(sentence)) return body;
  const paragraphs = body.trim().split(/\n\s*\n/);
  const insertAt = Math.max(1, paragraphs.length - 2);
  paragraphs.splice(insertAt, 0, sentence);
  return paragraphs.join('\n\n');
}
