import { PATHFINDER2_ATTRIBUTES } from '../../data'
import {
  getAncestryById,
  getBackgroundById,
  getClassById,
  getHeritageById,
  getVersatileHeritageById,
} from '../../data/selectors'
import { signedModifier } from '../../rules/derived-character-values'
import type {
  Pathfinder2CharacterDraft,
  Pathfinder2CharacterBuild,
  Pathfinder2DerivedValues,
  Pathfinder2RulesCatalog,
} from '../../types'
import styles from '../Pathfinder2SheetPage.module.css'

type CharacterSummaryProps = {
  draft: Pathfinder2CharacterDraft
  catalog: Pathfinder2RulesCatalog
  build: Pathfinder2CharacterBuild
  derived: Pathfinder2DerivedValues
  compact?: boolean
}

export default function CharacterSummary({
  draft,
  catalog,
  build,
  derived,
  compact = false,
}: CharacterSummaryProps) {
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const heritage = getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  const versatileHeritage = getVersatileHeritageById(
    catalog,
    draft.versatileHeritageId,
  )
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)

  return (
    <>
      <div className={styles.summaryHeader}>
        <span className={styles.panelEyebrow}>Сводка героя</span>
        <span className={styles.levelPill}>{draft.level} уровень</span>
      </div>
      {!compact ? (
        <div className={styles.portraitPlaceholder} aria-hidden="true">
          <span>{draft.name.trim().slice(0, 1).toUpperCase() || '✦'}</span>
          <i />
        </div>
      ) : null}
      <div className={styles.identity}>
        <h2>{draft.name || 'Безымянный герой'}</h2>
        <p>{draft.concept || 'Концепция ещё не записана'}</p>
      </div>
      <dl className={styles.summaryFacts}>
        <div><dt>Народ</dt><dd>{ancestry?.name || 'Не выбран'}</dd></div>
        <div><dt>Наследие</dt><dd>{heritage?.name || versatileHeritage?.name || 'Не выбрано'}</dd></div>
        <div><dt>Предыстория</dt><dd>{background?.name || 'Не выбрана'}</dd></div>
        <div><dt>Класс</dt><dd>{characterClass?.name || 'Не выбран'}</dd></div>
        <div><dt>Игрок</dt><dd>{draft.player || 'Не указан'}</dd></div>
      </dl>
      <div className={styles.combatStats}>
        <div><span>ОЗ</span><strong>{derived.maxHp ?? '—'}</strong><small>максимум</small></div>
        <div><span>КБ</span><strong>{derived.armorClass}</strong><small>защита</small></div>
        <div><span>КС</span><strong>{derived.classDc ?? '—'}</strong><small>класса</small></div>
      </div>
      <div className={styles.miniAttributes}>
        {PATHFINDER2_ATTRIBUTES.map(attribute => (
          <div key={attribute.key}>
            <span>{attribute.shortLabel}</span>
            <strong>{signedModifier(build.attributes.modifiers[attribute.key])}</strong>
          </div>
        ))}
      </div>
      <div className={styles.summaryRules}>
        <div><span>Восприятие</span><strong>{signedModifier(derived.perception)}</strong></div>
        <div><span>Скорость</span><strong>{derived.speed ? `${derived.speed} фт.` : '—'}</strong></div>
        <div><span>Навыки</span><strong>{build.skills.trainedCount}</strong></div>
        <div><span>Способности</span><strong>{draft.generalFeatIds.length + draft.skillFeatIds.length}</strong></div>
      </div>
      <div className={styles.localNotice}>
        <span aria-hidden="true">⌁</span>
        <p>
          <strong>Локальный черновик</strong>
          Оба режима используют одну и ту же запись в этом браузере.
        </p>
      </div>
    </>
  )
}
