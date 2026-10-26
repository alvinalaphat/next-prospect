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
