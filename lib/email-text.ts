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
