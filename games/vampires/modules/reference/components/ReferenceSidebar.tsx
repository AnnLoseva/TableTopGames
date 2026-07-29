'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import {
  REFERENCE_DOCUMENTS,
  REFERENCE_GROUP_LABELS,
  type ReferenceDocGroup,
  type ReferenceDocument,
} from '../catalog'
import type { ReferenceHeading } from '../utils/markdown'

export type { ReferenceHeading }

type ReferenceSidebarProps = {
  activeDoc: ReferenceDocument
  headings: ReferenceHeading[]
  onSelectDoc: (slug: string) => void
}

const GROUP_ORDER: ReferenceDocGroup[] = ['navigator', 'chapters', 'handbooks']

export default function ReferenceSidebar({ activeDoc, headings, onSelectDoc }: ReferenceSidebarProps) {
  const { t } = useLang()

  return (
    <aside className="reference-sidebar" aria-label={t('Оглавление справочника')}>
      <div className="reference-sidebar-inner">
        <section className="reference-sidebar-section">
          <span>{t('Разделы')}</span>
          <nav className="reference-doc-nav">
            {GROUP_ORDER.map(group => {
              const docs = REFERENCE_DOCUMENTS.filter(doc => doc.group === group)
              if (docs.length === 0) return null
              return (
                <div className="reference-doc-group" key={group}>
                  <p className="reference-doc-group-label">{t(REFERENCE_GROUP_LABELS[group])}</p>
                  {docs.map(doc => (
                    <button
                      type="button"
                      className={`reference-doc-link${doc.slug === activeDoc.slug ? ' active' : ''}`}
                      key={doc.slug}
                      onClick={() => onSelectDoc(doc.slug)}
                      title={t(doc.description)}
                    >
                      <strong>{doc.shortTitle}</strong>
                      <small>{doc.title}</small>
                    </button>
                  ))}
                </div>
              )
            })}
          </nav>
        </section>

        <section className="reference-sidebar-section">
          <span>{t('На этой странице')}</span>
          <nav className="reference-heading-nav">
            {headings.length === 0 ? (
              <p>{t('Заголовки загружаются...')}</p>
            ) : headings.map(heading => (
              <a className={`level-${heading.level}`} href={`#${heading.id}`} key={`${heading.id}-${heading.title}`}>
                {heading.title}
              </a>
            ))}
          </nav>
        </section>
      </div>
    </aside>
  )
}