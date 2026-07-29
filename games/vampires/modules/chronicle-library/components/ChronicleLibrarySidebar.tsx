import type { ReferenceHeading } from '@/games/vampires/modules/reference/utils/markdown'
import type { ChronicleDocument, LibraryChronicle } from '../types'

type ChronicleLibrarySidebarProps = {
  chronicles: LibraryChronicle[]
  activeChronicle: LibraryChronicle | null
  documents: ChronicleDocument[]
  activeDocument: ChronicleDocument | null
  headings: ReferenceHeading[]
  onSelectChronicle: (chronicleId: string) => void
  onSelectDocument: (sourceName: string) => void
  labels: {
    chronicles: string
    shortChronicle: string
    fullText: string
    headings: string
    noShortChronicle: string
    noFullText: string
  }
}

export default function ChronicleLibrarySidebar({
  chronicles,
  activeChronicle,
  documents,
  activeDocument,
  headings,
  onSelectChronicle,
  onSelectDocument,
  labels,
}: ChronicleLibrarySidebarProps) {
  const isFullText = (document: ChronicleDocument) => (
    document.kind === 'clean_transcript'
    || /полный обработанный текст\s*$/iu.test(document.title)
  )
  const fullTextDocuments = documents.filter(isFullText)
  const shortChronicleDocuments = documents.filter(document => !isFullText(document))

  const documentLinks = (items: ChronicleDocument[], emptyLabel: string) => (
    <nav className="chronicle-doc-nav">
      {items.length === 0 ? <small>{emptyLabel}</small> : null}
      {items.map(document => (
        <button
          type="button"
          className={`chronicle-doc-link ${activeDocument?.sourceName === document.sourceName ? 'active' : ''}`}
          key={document.sourceName}
          onClick={() => onSelectDocument(document.sourceName)}
        >
          <strong>{document.title}</strong>
          <small>{document.downloadName || document.sourceName}</small>
        </button>
      ))}
    </nav>
  )

  return (
    <aside className="chronicle-sidebar" aria-label={labels.chronicles}>
      <div className="chronicle-sidebar-inner">
        <section className="chronicle-sidebar-section">
          <span>{labels.chronicles}</span>
          <nav className="chronicle-doc-nav">
            {chronicles.map(chronicle => (
              <button
                type="button"
                className={`chronicle-doc-link ${activeChronicle?.id === chronicle.id ? 'active' : ''}`}
                key={chronicle.id}
                onClick={() => onSelectChronicle(chronicle.id)}
              >
                <strong>{chronicle.title}</strong>
              </button>
            ))}
          </nav>
        </section>

        {activeChronicle ? (
          <section className="chronicle-sidebar-section">
            <span>{labels.shortChronicle}</span>
            {documentLinks(shortChronicleDocuments, labels.noShortChronicle)}
          </section>
        ) : null}

        {activeChronicle ? (
          <section className="chronicle-sidebar-section">
            <span>{labels.fullText}</span>
            {documentLinks(fullTextDocuments, labels.noFullText)}
          </section>
        ) : null}

        {headings.length > 0 ? (
          <section className="chronicle-sidebar-section">
            <span>{labels.headings}</span>
            <nav className="chronicle-heading-nav">
              {headings.map(heading => (
                <a className={`level-${heading.level}`} href={`#${heading.id}`} key={heading.id}>
                  {heading.title}
                </a>
              ))}
            </nav>
          </section>
        ) : null}
      </div>
    </aside>
  )
}
