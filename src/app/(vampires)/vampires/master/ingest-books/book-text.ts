const WRAPPED_WORD = /([A-Za-zА-Яа-яЁё])[-\u2010\u2011][ \t]*\n+[ \t]*([a-zа-яё])/g
const TYPOGRAPHIC_DASH = /[\u2010-\u2015\u2212]/g

/** Normalize extracted/OCR text before it becomes searchable book content. */
export function normalizeBookContent(value: string): string {
  const text = value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00ad/g, '')
    .replace(WRAPPED_WORD, '$1$2')
    .replace(TYPOGRAPHIC_DASH, '-')

  return text
    .split(/\n{2,}/)
    .map(paragraph => paragraph
      .replace(/[ \t]*\n[ \t]*/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+([,.;:!?…])/g, '$1')
      .replace(/([«(])\s+/g, '$1')
      .replace(/\s+([»)])/g, '$1')
      .trim())
    .filter(Boolean)
    .join('\n\n')
}
