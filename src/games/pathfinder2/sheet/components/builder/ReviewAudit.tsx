import { PATHFINDER2_ATTRIBUTES, PATHFINDER2_SKILLS } from '../../data'
import {
  getAncestryById,
  getBackgroundById,
  getClassById,
  getHeritageById,
  getVersatileHeritageById,
} from '../../data/selectors'
import { signedModifier } from '../../rules/derived-character-values'
import { PATHFINDER2_STEP_LABELS } from '../../rules/creation/validation-messages'
import type {
  Pathfinder2CharacterBuild,
  Pathfinder2CharacterDraft,
  Pathfinder2CharacterState,
  Pathfinder2RulesCatalog,
} from '../../types'
import styles from '../Pathfinder2SheetPage.module.css'

type ReviewAuditProps = {
  draft: Pathfinder2CharacterDraft
  catalog: Pathfinder2RulesCatalog
  build: Pathfinder2CharacterBuild
  state: Pathfinder2CharacterState
  onFinish: () => void
}

export default function ReviewAudit({
  draft,
  catalog,
  build,
  state,
  onFinish,
}: ReviewAuditProps) {
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const heritage = getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  const versatileHeritage = getVersatileHeritageById(catalog, draft.versatileHeritageId)
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const errors = build.validationIssues.filter(issue => issue.severity === 'error')
  const warnings = build.validationIssues.filter(issue => issue.severity === 'warning')
  const activeHeritage = heritage?.name ?? versatileHeritage?.name ?? 'Не выбрано'

  return (
    <div className={styles.auditPage}>
      <section className={styles.auditStatus} data-ready={build.isReady}>
        <span aria-hidden="true">{build.isReady ? '✓' : '!'}</span>
        <div>
          <span className={styles.choiceKicker}>Статус проверки</span>
          <h3>{build.isReady ? 'Корректный персонаж' : 'Есть незавершённые решения'}</h3>
          <p>{build.isReady
            ? 'Все обязательные решения 1-го уровня прошли единый валидатор.'
            : `Блокирующих ошибок: ${errors.length}. Исправьте их перед завершением.`}</p>
        </div>
      </section>

      <div className={styles.reviewGrid}>
        <section>
          <span className={styles.choiceKicker}>Происхождение</span>
          <h3>{ancestry?.name ?? 'Народ не выбран'}</h3>
          <p>{activeHeritage} · {background?.name ?? 'Предыстория не выбрана'}</p>
        </section>
        <section>
          <span className={styles.choiceKicker}>Класс</span>
          <h3>{characterClass?.name ?? 'Класс не выбран'}</h3>
          <p>Ключевая характеристика: {draft.attributeChoices.classKeyBoost
            ? PATHFINDER2_ATTRIBUTES.find(value => value.key === draft.attributeChoices.classKeyBoost)?.label
            : 'не выбрана'}</p>
        </section>
      </div>

      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Характеристики</span><h3>Источники и итоги</h3></div>
        </header>
        <div className={styles.auditAttributeList}>
          {PATHFINDER2_ATTRIBUTES.map(attribute => (
            <article key={attribute.key}>
              <strong>{attribute.label} {signedModifier(build.attributes.modifiers[attribute.key])}</strong>
              <p>{build.attributes.breakdown[attribute.key].map(entry => (
                `${entry.sourceLabel} ${entry.partial ? '½' : signedModifier(entry.delta)}`
              )).join(' · ') || 'Базовое значение +0'}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Полный rules state</span><h3>Механические категории</h3></div>
        </header>
        <div className={styles.reviewGrid}>
          <section>
            <strong>Знания и способности</strong>
            <p>{state.loreEntries.length} Lore · {state.grantedFeatIds.length} granted/selected feats</p>
          </section>
          <section>
            <strong>Владения и особенности</strong>
            <p>{state.proficiencies.length} владений · {state.features.length} классовых особенностей</p>
          </section>
          <section>
            <strong>Снаряжение и Bulk</strong>
            <p>{state.inventory.entries.length} предметов · Bulk {state.inventory.bulk} / {state.inventory.safeBulk}</p>
          </section>
          <section>
            <strong>Боевые параметры</strong>
            <p>КБ {state.derived.armorClass} · {state.attacks.length} рассчитанных атак</p>
          </section>
          <section>
            <strong>Заклинания</strong>
            <p>{state.spellcasting.expected
              ? `${state.spellcasting.entries.length} источников · ${state.spellcasting.issues.length} проблем`
              : 'Класс не требует полноценного spellcasting entry'}</p>
          </section>
          <section>
            <strong>Языки и вера</strong>
            <p>
              {state.languages.grantedLanguageIds.length + state.languages.selectedLanguageIds.length} языков
              {' · '}{state.religion.deity?.name ?? 'без проверенного божества'}
            </p>
          </section>
        </div>
      </section>

      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Навыки</span><h3>Источники и лимиты</h3></div>
          <span className={styles.rulesStatusAuto}>{build.skills.trainedCount} обучено</span>
        </header>
        <p>
          Дополнительные класса: {draft.skillChoices.classFreeSkills.length} из {build.skills.classFreeLimit}.
          {' '}От Интеллекта: {draft.skillChoices.intelligenceSkills.length} из {build.skills.intelligenceLimit}.
          {' '}Замен дублей: {Object.keys(draft.skillChoices.replacementSkills).length} из {build.skills.replacementChoices.length}.
        </p>
        <div className={styles.selectedChips}>
          {PATHFINDER2_SKILLS.filter(skill => (
            build.skills.skills[skill.id].rank !== 'untrained'
          )).map(skill => (
            <span key={skill.id}>{skill.label} · {build.skills.skills[skill.id].rank}</span>
          ))}
        </div>
      </section>

      {catalog.dataAvailability.length ? (
        <section className={styles.validationList} aria-label="Готовность справочников">
          <strong>Справочники механик</strong>
          <ul>
            {catalog.dataAvailability.map(entry => (
              <li key={entry.id} data-severity={
                entry.status === 'missing' || entry.status === 'invalid'
                  ? 'error'
                  : entry.status === 'connected'
                    ? 'info'
                    : 'warning'
              }>
                {entry.label} · {
                  entry.status === 'connected'
                    ? `подключено (${entry.entryCount})`
                    : entry.status === 'missing'
                    ? 'отсутствует'
                    : entry.status === 'invalid'
                      ? 'ошибка данных'
                      : entry.status === 'available-not-connected'
                        ? 'файл есть, движок не подключён'
                        : 'подключено частично'
                }
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {build.validationIssues.length ? (
        <section className={styles.validationList} aria-label="Полный аудит персонажа">
          <strong>Аудит решений</strong>
          <ul>
            {errors.map(issue => (
              <li key={issue.id} data-severity="error">
                {PATHFINDER2_STEP_LABELS[issue.step]} · {issue.message}
              </li>
            ))}
            {warnings.map(issue => (
              <li key={issue.id} data-severity="warning">
                {PATHFINDER2_STEP_LABELS[issue.step]} · {issue.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <button
        type="button"
        className={styles.nextButton}
        disabled={!build.isReady}
        onClick={onFinish}
      >
        Завершить создание
      </button>
    </div>
  )
}
