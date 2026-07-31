// Paragraph-level reconciliation for `bodyMarkdown` when two writers (the
// site and, eventually, the RenaCompanion iPad app) touched the same page
// concurrently. This is the canonical merge policy — port it exactly to
// whatever writes from the iPad app side, or every conflict on that path
// falls back to plain overwrite and silently drops the loser's text. See
// docs/ai/DECISIONS.md (2026-07-31, "paragraph merge") for the full spec and
// worked examples.
//
// Rules (as specified by the app owner), checked in this order for each pair
// of paragraphs occupying the same relative position:
// 1. Identical paragraph (ignoring surrounding/internal whitespace) -> kept
//    once.
// 2. One paragraph's text is fully contained in the other's (missing info,
//    not different info) -> the fuller one is kept, the partial one dropped.
// 3. The existing paragraph reappears verbatim further down in the incoming
//    text, or vice versa -> that's not a conflict, it's a paragraph that
//    moved (something was inserted/reordered around it); the paragraph at
//    this position is kept here and the other side's copy is left to match
//    up with it later in the walk, instead of being duplicated now.
// 4. The two paragraphs are still close (most of their words match — the
//    worked example is "differs by one word") -> both are kept, side by
//    side, since this function never guesses which wording is "right".
// 5. Otherwise the information fully diverges: the existing paragraph stays
//    where it is, and the incoming (site) paragraph is deferred to the very
//    end of the document, since there's no better position to infer for
//    genuinely unrelated new material.
// Nothing is ever silently dropped except a paragraph that is a strict
// subset of one already kept (rule 2). A full swap of two paragraphs'
// positions can still produce one duplicate line — that's an accepted,
// non-lossy failure mode (favor a duplicate a human deletes over losing a
// paragraph), not a bug to chase further.

const CLOSE_EDIT_WORD_OVERLAP = 0.6

function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
}

function normalize(paragraph: string): string {
  return paragraph.trim().replace(/\s+/g, ' ')
}

function words(paragraph: string): string[] {
  const normalized = normalize(paragraph)
  return normalized.length === 0 ? [] : normalized.split(' ')
}

/** Length of the longest common subsequence of two word arrays (DP, length only). */
function commonWordCount(a: string[], b: string[]): number {
  let prevRow = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const currentRow = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) {
      currentRow[j] = a[i - 1] === b[j - 1]
        ? prevRow[j - 1] + 1
        : Math.max(prevRow[j], currentRow[j - 1])
    }
    prevRow = currentRow
  }
  return prevRow[b.length]
}

/** Dice-coefficient-style word overlap: 1.0 = identical word sequence, 0 = nothing in common. */
function wordOverlapRatio(a: string, b: string): number {
  const wa = words(a)
  const wb = words(b)
  if (wa.length === 0 && wb.length === 0) return 1
  if (wa.length === 0 || wb.length === 0) return 0
  return (2 * commonWordCount(wa, wb)) / (wa.length + wb.length)
}

function isCloseEdit(a: string, b: string): boolean {
  return wordOverlapRatio(a, b) >= CLOSE_EDIT_WORD_OVERLAP
}

/** 'existing' | 'incoming' if one paragraph's text fully contains the other's; null otherwise. */
function fullerOf(existing: string, incoming: string): 'existing' | 'incoming' | null {
  const ne = normalize(existing)
  const ni = normalize(incoming)
  if (ne === ni) return 'existing'
  if (ne.includes(ni)) return 'existing'
  if (ni.includes(ne)) return 'incoming'
  return null
}

/**
 * Merges `incoming` (the edit being saved) into `existing` (what's currently
 * persisted) so neither writer's unique content is lost. Both are full
 * `bodyMarkdown` documents; the result is a full document too.
 */
export function mergeJournalBody(existing: string, incoming: string): string {
  const existingParas = splitParagraphs(existing)
  const incomingParas = splitParagraphs(incoming)
  if (existingParas.length === 0) return incoming.trim()
  if (incomingParas.length === 0) return existing.trim()

  const output: string[] = []
  const deferred: string[] = []
  let ei = 0
  let ii = 0

  while (ei < existingParas.length || ii < incomingParas.length) {
    const existingParagraph = existingParas[ei]
    const incomingParagraph = incomingParas[ii]

    if (existingParagraph === undefined) {
      deferred.push(incomingParagraph)
      ii += 1
      continue
    }
    if (incomingParagraph === undefined) {
      output.push(existingParagraph)
      ei += 1
      continue
    }

    const fuller = fullerOf(existingParagraph, incomingParagraph)
    if (fuller === 'existing') {
      output.push(existingParagraph)
      ei += 1
      ii += 1
      continue
    }
    if (fuller === 'incoming') {
      output.push(incomingParagraph)
      ei += 1
      ii += 1
      continue
    }

    const existingReappearsLater = incomingParas
      .slice(ii + 1)
      .some(paragraph => normalize(paragraph) === normalize(existingParagraph))
    if (existingReappearsLater) {
      // `incoming` inserted/reordered content ahead of where `existingParagraph` now sits;
      // place the new paragraph here and let the later exact match consume `existingParagraph`.
      output.push(incomingParagraph)
      ii += 1
      continue
    }
    const incomingReappearsLater = existingParas
      .slice(ei + 1)
      .some(paragraph => normalize(paragraph) === normalize(incomingParagraph))
    if (incomingReappearsLater) {
      output.push(existingParagraph)
      ei += 1
      continue
    }

    if (isCloseEdit(existingParagraph, incomingParagraph)) {
      output.push(existingParagraph, incomingParagraph)
    } else {
      output.push(existingParagraph)
      deferred.push(incomingParagraph)
    }
    ei += 1
    ii += 1
  }

  output.push(...deferred)
  return output.join('\n\n').trim()
}
