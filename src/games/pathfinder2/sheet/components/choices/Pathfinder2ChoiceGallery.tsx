'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BACKGROUND_CATEGORY_LABELS,
  displayAttribute,
  displayRarity,
  displaySense,
  displaySize,
  displayTrait,
  includesSearch,
  splitRuleParagraphs,
  uniqueSorted,
} from '../../data/selectors'
import type {
  Pathfinder2AncestryRule,
  Pathfinder2BackgroundRule,
  Pathfinder2CharacterDraft,
  Pathfinder2ChoiceKind,
  Pathfinder2ClassRule,
  Pathfinder2FeatRule,
  Pathfinder2HeritageRule,
  Pathfinder2RulesCatalog,
  Pathfinder2VersatileHeritageRule,
} from '../../types'
import ChoiceGalleryDialog from './ChoiceGalleryDialog'
import styles from '../Pathfinder2SheetPage.module.css'

type GalleryItem =
  | Pathfinder2AncestryRule
  | Pathfinder2HeritageRule
  | Pathfinder2VersatileHeritageRule
  | Pathfinder2BackgroundRule
  | Pathfinder2ClassRule
  | Pathfinder2FeatRule

type Pathfinder2ChoiceGalleryProps = {
  open: boolean
  kind: Pathfinder2ChoiceKind
  readOnly?: boolean
  draft: Pathfinder2CharacterDraft
  catalog: Pathfinder2RulesCatalog
  onConfirm: (kind: Pathfinder2ChoiceKind, id: string) => void
  onClose: () => void
}

const CHOICE_COPY: Record<
  Pathfinder2ChoiceKind,
  { title: string; description: string; empty: string }
> = {
  ancestry: {
    title: 'Выбор народа',
    description: 'Сравните корни, параметры, особенности и доступные наследия.',
    empty: 'Попробуйте очистить поиск или изменить фильтры народа.',
  },
  heritage: {
    title: 'Наследие народа',
    description: 'Наследие уточняет, как именно проявляется выбранный народ.',
    empty: 'Сначала выберите народ или очистите поисковый запрос.',
  },
  versatileHeritage: {
    title: 'Универсальное наследие',
    description: 'Отдельный необязательный слой происхождения для любого народа.',
    empty: 'Попробуйте очистить поисковый запрос.',
  },
  background: {
    title: 'Выбор предыстории',
    description: 'Прошлое героя задаёт обучение, знание и тематическую способность.',
    empty: 'Попробуйте другую категорию, навык, редкость или источник.',
  },
  class: {
    title: 'Выбор класса',
    description: 'Сравните роль, здоровье, ключевые характеристики и развитие.',
    empty: 'Попробуйте очистить поиск или изменить источник.',
  },
  generalFeat: {
    title: 'Общие и мифические способности',
    description: 'Каталог общих и мифических способностей с уровнем, требованиями и чертами.',
    empty: 'Попробуйте изменить уровень, источник или поисковый запрос.',
  },
  skillFeat: {
    title: 'Способности навыков',
    description: 'Каталог способностей навыков с требованиями и связанной областью.',
    empty: 'Попробуйте изменить навык, уровень или поисковый запрос.',
  },
}

function ChoiceTags({ values }: { values: string[] }) {
  if (values.length === 0) return null
  return (
    <div className={styles.choiceTags}>
      {values.map(value => <span key={value}>{value}</span>)}
    </div>
  )
}

function RuleParagraphs({ value }: { value: string }) {
  return (
    <>
      {splitRuleParagraphs(value).map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 28)}-${index}`}>{paragraph}</p>
      ))}
    </>
  )
}

function DetailSection({
  title,
  children,
  open = false,
}: {
  title: string
  children: React.ReactNode
  open?: boolean
}) {
  return (
    <details className={styles.choiceDetailSection} open={open}>
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  )
}

function AncestryDetails({ item }: { item: Pathfinder2AncestryRule }) {
  return (
    <article className={styles.choiceDetails}>
      <span className={styles.choiceKicker}>
        {displayRarity(item.rarity)} · {item.sourceBook}
      </span>
      <h3>{item.name}</h3>
      <p className={styles.choiceLead}>{item.tagline}</p>
      <ChoiceTags values={item.traits.map(displayTrait)} />
      <div className={styles.choiceVitalGrid}>
        <span><small>ОЗ народа</small><strong>{item.hp}</strong></span>
        <span><small>Скорость</small><strong>{item.speed}</strong></span>
        <span><small>Размер</small><strong>{displaySize(item.size)}</strong></span>
      </div>
      <RuleParagraphs value={item.description} />
      <DetailSection title="Параметры" open>
        <dl className={styles.choiceFacts}>
          <div><dt>Повышения</dt><dd>{item.abilityBoosts.map(displayAttribute).join(', ')}</dd></div>
          <div><dt>Снижение</dt><dd>{item.abilityFlaw ? displayAttribute(item.abilityFlaw) : 'Нет'}</dd></div>
          <div><dt>Языки</dt><dd>{item.languages.join(', ') || 'Не указаны'}</dd></div>
          <div><dt>Доп. языки</dt><dd>{item.bonusLanguages || 'Не указаны'}</dd></div>
          <div><dt>Чувства</dt><dd>{item.senses.map(displaySense).join(', ') || 'Обычные'}</dd></div>
        </dl>
      </DetailSection>
      <DetailSection title={`Особенности (${item.specialAbilities.length})`}>
        <div className={styles.choiceRuleList}>
          {item.specialAbilities.map(ability => (
            <section key={ability.name}>
              <strong>{ability.name}</strong>
              <p>{ability.description}</p>
            </section>
          ))}
        </div>
      </DetailSection>
      <DetailSection title={`Наследия (${item.heritages.length})`}>
        <div className={styles.choiceRuleList}>
          {item.heritages.map(heritage => (
            <section key={heritage.id}>
              <strong>{heritage.name}</strong>
              <p>{heritage.description}</p>
            </section>
          ))}
        </div>
      </DetailSection>
      <DetailSection title="Как выглядит герой">
        <strong>Вы можете…</strong>
        <ul>{item.youMight.map(value => <li key={value}>{value}</li>)}</ul>
        <strong>Другие, вероятно…</strong>
        <ul>{item.othersProbably.map(value => <li key={value}>{value}</li>)}</ul>
      </DetailSection>
      <DetailSection title="Обычаи и имена">
        <strong>Популярные эдикты</strong>
        <ul>{item.popularEdicts.map(value => <li key={value}>{value}</li>)}</ul>
        <strong>Популярные анафемы</strong>
        <ul>{item.popularAnathema.map(value => <li key={value}>{value}</li>)}</ul>
        <p><strong>Примеры имён:</strong> {item.sampleNames || 'Не указаны'}</p>
      </DetailSection>
    </article>
  )
}

function HeritageDetails({
  item,
}: {
  item: Pathfinder2HeritageRule | Pathfinder2VersatileHeritageRule
}) {
  const versatile = 'mechanics' in item
  return (
    <article className={styles.choiceDetails}>
      <span className={styles.choiceKicker}>
        {versatile ? 'Универсальное наследие' : item.ancestryName}
      </span>
      <h3>{item.name}</h3>
      {versatile && item.altName ? <p className={styles.choiceLead}>{item.altName}</p> : null}
      <ChoiceTags values={item.traits.map(displayTrait)} />
      <RuleParagraphs value={item.description} />
      {versatile ? (
        <>
          {item.tagline ? <p className={styles.choiceCallout}>{item.tagline}</p> : null}
          <DetailSection title="Механика" open>
            <RuleParagraphs value={item.mechanics} />
          </DetailSection>
          <dl className={styles.choiceFacts}>
            <div><dt>Чувства</dt><dd>{item.senses.map(displaySense).join(', ') || 'Без изменений'}</dd></div>
            <div><dt>Источник</dt><dd>{item.sourceBook}</dd></div>
            <div><dt>Отрицательное исцеление</dt><dd>{item.negativeHealing ? 'Да' : 'Нет'}</dd></div>
          </dl>
        </>
      ) : null}
    </article>
  )
}

function BackgroundDetails({ item }: { item: Pathfinder2BackgroundRule }) {
  return (
    <article className={styles.choiceDetails}>
      <span className={styles.choiceKicker}>
        {displayRarity(item.rarity)} · {BACKGROUND_CATEGORY_LABELS[item.tab] ?? item.tab}
      </span>
      <h3>{item.name}</h3>
      <RuleParagraphs value={item.description} />
      <dl className={styles.choiceFacts}>
        <div><dt>Повышения</dt><dd>{item.abilityBoosts}</dd></div>
        <div><dt>Навык</dt><dd>{item.trainedSkills}</dd></div>
        <div><dt>Знание</dt><dd>{item.trainedLore}</dd></div>
        <div><dt>Способность</dt><dd>{item.skillFeat}</dd></div>
        <div><dt>Источник</dt><dd>{item.sourceBook}</dd></div>
        {item.region ? <div><dt>Регион</dt><dd>{item.region}</dd></div> : null}
      </dl>
    </article>
  )
}

function ClassDetails({ item }: { item: Pathfinder2ClassRule }) {
  return (
    <article className={styles.choiceDetails}>
      <span className={styles.choiceKicker}>
        {displayRarity(item.rarity)} · {item.sourceBook}
      </span>
      <h3>{item.name}</h3>
      <p className={styles.choiceLead}>{item.role}</p>
      <RuleParagraphs value={item.description} />
      <div className={styles.choiceVitalGrid}>
        <span><small>ОЗ / уровень</small><strong>{item.hp}</strong></span>
        <span><small>Ключ</small><strong>{item.keyAbilities.map(displayAttribute).join(' / ')}</strong></span>
      </div>
      <DetailSection title="Начальная подготовка" open>
        <dl className={styles.choiceFacts}>
          <div><dt>Восприятие</dt><dd>{item.perception}</dd></div>
          <div><dt>Стойкость</dt><dd>{item.fortitude}</dd></div>
          <div><dt>Рефлекс</dt><dd>{item.reflex}</dd></div>
          <div><dt>Воля</dt><dd>{item.will}</dd></div>
          <div><dt>Навыки</dt><dd>{item.skills}</dd></div>
          <div><dt>Атаки</dt><dd>{item.attacks}</dd></div>
          <div><dt>Защита</dt><dd>{item.defenses}</dd></div>
          <div><dt>КС класса</dt><dd>{item.classDc}</dd></div>
          {item.spellTradition ? <div><dt>Традиция</dt><dd>{item.spellTradition}</dd></div> : null}
        </dl>
      </DetailSection>
      <DetailSection title={`Особенности класса (${item.features.length})`}>
        <div className={styles.choiceRuleList}>
          {item.features.map(feature => (
            <section key={feature.id}>
              <strong>{feature.level ? `${feature.level} ур. · ` : ''}{feature.name}</strong>
              <p>{feature.description}</p>
            </section>
          ))}
        </div>
      </DetailSection>
      <DetailSection title={`Пути класса (${item.specializations.length})`}>
        <div className={styles.choiceRuleList}>
          {item.specializations.map(option => (
            <section key={option.id}>
              <strong>{option.name}</strong>
              <p>{option.description}</p>
            </section>
          ))}
        </div>
      </DetailSection>
      <DetailSection title="В игре">
        <dl className={styles.choiceFacts}>
          <div><dt>Бой</dt><dd>{item.roleplaying.combat}</dd></div>
          <div><dt>Общение</dt><dd>{item.roleplaying.social}</dd></div>
          <div><dt>Исследование</dt><dd>{item.roleplaying.exploration}</dd></div>
          <div><dt>Отдых</dt><dd>{item.roleplaying.downtime}</dd></div>
        </dl>
        <strong>Вы можете…</strong>
        <ul>{item.roleplaying.youMight.map(value => <li key={value}>{value}</li>)}</ul>
        <strong>Другие, вероятно…</strong>
        <ul>{item.roleplaying.othersProbably.map(value => <li key={value}>{value}</li>)}</ul>
      </DetailSection>
      {item.spellSlots ? (
        <DetailSection title="Заклинания">
          <dl className={styles.choiceFacts}>
            {Object.entries(item.spellSlots).map(([rank, slots]) => (
              <div key={rank}>
                <dt>{rank}</dt>
                <dd>{slots.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      ) : null}
      <DetailSection title={`Ключевые термины (${item.keyTerms.length})`}>
        <div className={styles.choiceRuleList}>
          {item.keyTerms.map(term => (
            <section key={term.id}>
              <strong>{term.name}</strong>
              <p>{term.description}</p>
            </section>
          ))}
        </div>
      </DetailSection>
    </article>
  )
}

function FeatDetails({ item }: { item: Pathfinder2FeatRule }) {
  return (
    <article className={styles.choiceDetails}>
      <span className={styles.choiceKicker}>
        {item.level} уровень{item.skill ? ` · ${item.skill}` : ''}
      </span>
      <h3>{item.name}</h3>
      <ChoiceTags values={item.traits.map(displayTrait)} />
      <RuleParagraphs value={item.description} />
      <dl className={styles.choiceFacts}>
        <div><dt>Требования</dt><dd>{item.prerequisites || 'Нет'}</dd></div>
        <div><dt>Источник</dt><dd>{item.sourceBook || 'Локальный справочник'}</dd></div>
      </dl>
    </article>
  )
}

function selectedIdForKind(
  kind: Pathfinder2ChoiceKind,
  draft: Pathfinder2CharacterDraft,
) {
  if (kind === 'ancestry') return draft.ancestryId
  if (kind === 'heritage') return draft.heritageId
  if (kind === 'versatileHeritage') return draft.versatileHeritageId
  if (kind === 'background') return draft.backgroundId
  if (kind === 'class') return draft.classId
  if (kind === 'generalFeat') return draft.generalFeatIds[0] ?? ''
  return draft.skillFeatIds[0] ?? ''
}

function selectedIdsForKind(
  kind: Pathfinder2ChoiceKind,
  draft: Pathfinder2CharacterDraft,
) {
  if (kind === 'generalFeat') return draft.generalFeatIds
  if (kind === 'skillFeat') return draft.skillFeatIds
  const selectedId = selectedIdForKind(kind, draft)
  return selectedId ? [selectedId] : []
}

export default function Pathfinder2ChoiceGallery({
  open,
  kind,
  readOnly = false,
  draft,
  catalog,
  onConfirm,
  onClose,
}: Pathfinder2ChoiceGalleryProps) {
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState('')
  const [size, setSize] = useState('')
  const [source, setSource] = useState('')
  const [category, setCategory] = useState('')
  const [skill, setSkill] = useState('')
  const [level, setLevel] = useState('')
  const [sort, setSort] = useState<'name' | 'source' | 'level'>('name')
  const selectedId = selectedIdForKind(kind, draft)
  const selectedIds = selectedIdsForKind(kind, draft)
  const [previewId, setPreviewId] = useState(selectedId)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setRarity('')
    setSize('')
    setSource('')
    setCategory('')
    setSkill('')
    setLevel('')
    setSort('name')
    setPreviewId(selectedId)
  }, [kind, open, selectedId])

  const rawItems = useMemo<GalleryItem[]>(() => {
    if (kind === 'ancestry') return catalog.ancestries
    if (kind === 'heritage') {
      return catalog.ancestries
        .find(ancestry => ancestry.id === draft.ancestryId)?.heritages ?? []
    }
    if (kind === 'versatileHeritage') return catalog.versatileHeritages
    if (kind === 'background') return catalog.backgrounds
    if (kind === 'class') return catalog.classes
    if (kind === 'generalFeat') return [...catalog.generalFeats, ...catalog.mythicFeats]
    return catalog.skillFeats
  }, [catalog, draft.ancestryId, kind])

  const sourceOptions = useMemo(() => uniqueSorted(rawItems.map(item => (
    'sourceBook' in item ? item.sourceBook : null
  ))), [rawItems])

  const items = useMemo(() => {
    const filtered = rawItems.filter(item => {
      const itemSource = 'sourceBook' in item ? item.sourceBook : ''
      const itemRarity = 'rarity' in item ? item.rarity : ''
      if (source && itemSource !== source) return false
      if (rarity && itemRarity !== rarity) return false
      if (kind === 'ancestry' && size && (item as Pathfinder2AncestryRule).size !== size) {
        return false
      }
      if (kind === 'background') {
        const background = item as Pathfinder2BackgroundRule
        if (category && background.tab !== category) return false
        if (
          skill
          && !background.trainedSkills.includes(skill)
          && !background.trainedLore.includes(skill)
        ) return false
      }
      if ((kind === 'generalFeat' || kind === 'skillFeat') && level) {
        if ((item as Pathfinder2FeatRule).level !== Number(level)) return false
      }

      if ('tagline' in item) {
        return includesSearch(query, [item.name, item.description, item.tagline, item.traits])
      }
      if ('trainedSkills' in item) {
        return includesSearch(query, [
          item.name,
          item.description,
          item.trainedSkills,
          item.trainedLore,
          item.skillFeat,
        ])
      }
      if ('role' in item) {
        return includesSearch(query, [item.name, item.description, item.role])
      }
      if ('level' in item) {
        return includesSearch(query, [
          item.name,
          item.description,
          item.prerequisites,
          item.traits,
          item.skill ?? null,
        ])
      }
      return includesSearch(query, [item.name, item.description, item.traits])
    })

    return [...filtered].sort((left, right) => {
      if (sort === 'level' && 'level' in left && 'level' in right) {
        return left.level - right.level || left.name.localeCompare(right.name, 'ru')
      }
      if (sort === 'source') {
        const leftSource = ('sourceBook' in left ? left.sourceBook : '') ?? ''
        const rightSource = ('sourceBook' in right ? right.sourceBook : '') ?? ''
        return leftSource.localeCompare(rightSource, 'ru')
          || left.name.localeCompare(right.name, 'ru')
      }
      return left.name.localeCompare(right.name, 'ru')
    })
  }, [category, kind, level, query, rarity, rawItems, size, skill, sort, source])

  useEffect(() => {
    if (!open || items.length === 0) return
    if (!items.some(item => item.id === previewId)) {
      setPreviewId(items.find(item => item.id === selectedId)?.id ?? items[0].id)
    }
  }, [items, open, previewId, selectedId])

  const controls = (
    <>
      <label className={styles.gallerySearch}>
        <span>Поиск</span>
        <input
          type="search"
          value={query}
          placeholder="Название, описание, черта…"
          onChange={event => setQuery(event.target.value)}
        />
      </label>
      {kind === 'ancestry' || kind === 'background' ? (
        <label>
          <span>Редкость</span>
          <select value={rarity} onChange={event => setRarity(event.target.value)}>
            <option value="">Любая</option>
            <option value="common">Обычная</option>
            <option value="uncommon">Необычная</option>
            <option value="rare">Редкая</option>
            <option value="unique">Уникальная</option>
          </select>
        </label>
      ) : null}
      {kind === 'ancestry' ? (
        <label>
          <span>Размер</span>
          <select value={size} onChange={event => setSize(event.target.value)}>
            <option value="">Любой</option>
            {uniqueSorted(catalog.ancestries.map(item => item.size)).map(value => (
              <option key={value} value={value}>{displaySize(value)}</option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === 'background' ? (
        <>
          <label>
            <span>Категория</span>
            <select value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">Любая</option>
              {uniqueSorted(catalog.backgrounds.map(item => item.tab)).map(value => (
                <option key={value} value={value}>
                  {BACKGROUND_CATEGORY_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Навык</span>
            <select value={skill} onChange={event => setSkill(event.target.value)}>
              <option value="">Любой</option>
              {uniqueSorted(catalog.backgrounds.map(item => item.trainedSkills)).map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      {kind === 'generalFeat' || kind === 'skillFeat' ? (
        <label>
          <span>Уровень</span>
          <select value={level} onChange={event => setLevel(event.target.value)}>
            <option value="">Любой</option>
            {uniqueSorted(rawItems.map(item => String((item as Pathfinder2FeatRule).level)))
              .sort((left, right) => Number(left) - Number(right))
              .map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      ) : null}
      {sourceOptions.length > 1 ? (
        <label>
          <span>Источник</span>
          <select value={source} onChange={event => setSource(event.target.value)}>
            <option value="">Любой</option>
            {sourceOptions.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      ) : null}
      <label>
        <span>Сортировка</span>
        <select
          value={sort}
          onChange={event => setSort(event.target.value as typeof sort)}
        >
          <option value="name">По названию</option>
          <option value="source">По источнику</option>
          {kind === 'generalFeat' || kind === 'skillFeat'
            ? <option value="level">По уровню</option>
            : null}
        </select>
      </label>
    </>
  )

  return (
    <ChoiceGalleryDialog
      open={open}
      title={CHOICE_COPY[kind].title}
      description={CHOICE_COPY[kind].description}
      items={items}
      selectedIds={selectedIds}
      previewId={previewId}
      readOnly={readOnly}
      controls={controls}
      emptyMessage={CHOICE_COPY[kind].empty}
      onPreview={setPreviewId}
      onConfirm={id => onConfirm(kind, id)}
      onClose={onClose}
      renderCard={(item, state) => {
        let meta = ''
        if ('hp' in item && 'size' in item) {
          meta = `${item.hp} ОЗ · ${displaySize(item.size)} · ${item.speed} фт.`
        } else if ('trainedSkills' in item) {
          meta = item.trainedSkills
        } else if ('role' in item) {
          meta = `${item.hp} ОЗ · ${item.role}`
        } else if ('level' in item) {
          meta = `${item.level} уровень${item.skill ? ` · ${item.skill}` : ''}`
        } else if ('ancestryName' in item) {
          meta = item.ancestryName
        } else if ('mechanics' in item) {
          meta = item.tagline
        }
        return (
          <>
            <span className={styles.galleryCardMark} aria-hidden="true">
              {item.name.slice(0, 1)}
            </span>
            <span className={styles.galleryCardCopy}>
              <strong>{item.name}</strong>
              <small>{meta || item.description.slice(0, 90)}</small>
            </span>
            <span className={styles.galleryCardState}>
              {state.selected ? 'Выбрано' : state.previewed ? 'Предпросмотр' : 'Открыть'}
            </span>
          </>
        )
      }}
      renderDetails={item => {
        if (kind === 'ancestry') {
          return <AncestryDetails item={item as Pathfinder2AncestryRule} />
        }
        if (kind === 'heritage' || kind === 'versatileHeritage') {
          return (
            <HeritageDetails
              item={item as Pathfinder2HeritageRule | Pathfinder2VersatileHeritageRule}
            />
          )
        }
        if (kind === 'background') {
          return <BackgroundDetails item={item as Pathfinder2BackgroundRule} />
        }
        if (kind === 'class') return <ClassDetails item={item as Pathfinder2ClassRule} />
        return <FeatDetails item={item as Pathfinder2FeatRule} />
      }}
    />
  )
}
