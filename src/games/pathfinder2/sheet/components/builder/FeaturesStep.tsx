'use client'

import { PROFICIENCY_LABELS } from '../../data/selectors'
import type {
  Pathfinder2CharacterBuild,
  Pathfinder2CharacterDraft,
  Pathfinder2CharacterDraftV4,
  Pathfinder2CharacterState,
  Pathfinder2RulesCatalog,
} from '../../types'
import type {
  UpdatePathfinder2Character,
  UpdatePathfinder2V4,
} from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'
import SkillRulesEditor from './SkillRulesEditor'
import SpellcastingEditor from './SpellcastingEditor'

export default function FeaturesStep({
  draft,
  v4Draft,
  catalog,
  build,
  state,
  updateCharacter,
  updateV4,
}: {
  draft: Pathfinder2CharacterDraft
  v4Draft: Pathfinder2CharacterDraftV4
  catalog: Pathfinder2RulesCatalog
  build: Pathfinder2CharacterBuild
  state: Pathfinder2CharacterState
  updateCharacter: UpdatePathfinder2Character
  updateV4: UpdatePathfinder2V4
}) {
  const blockers = state.validationIssues.filter(issue => (
    issue.step === 'features' && issue.severity === 'error'
  ))

  return (
    <div className={styles.formStack}>
      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Автоматически от класса</span>
            <h3>Начальные владения</h3>
          </div>
          <span className={styles.rulesStatusAuto}>{state.proficiencies.length} записей</span>
        </header>
        <div className={styles.selectedChips}>
          {state.proficiencies.map(proficiency => (
            <span key={`${proficiency.category}:${proficiency.targetId ?? ''}`}>
              {proficiency.category}{proficiency.targetId ? ` · ${proficiency.targetId}` : ''}
              {' · '}{PROFICIENCY_LABELS[proficiency.rank] ?? proficiency.rank}
              {' · '}+{proficiency.bonus}
            </span>
          ))}
          {!state.proficiencies.length ? <span>Сначала выберите класс.</span> : null}
        </div>
      </section>

      <SkillRulesEditor
        draft={draft}
        catalog={catalog}
        build={build}
        updateCharacter={updateCharacter}
      />

      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Не выбираются как черты</span>
            <h3>Классовые особенности</h3>
          </div>
          <span className={styles.rulesStatusAuto}>{state.features.length} получено</span>
        </header>
        {state.features.map(feature => (
          <article className={styles.selectedChoice} key={feature.id}>
            <span className={styles.choiceKicker}>Уровень {feature.source.level}</span>
            <h3>{feature.name}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Слоты решений</span>
            <h3>Черты и заклинания</h3>
          </div>
        </header>
        <p>
          Произвольное добавление черт отключено. Выбор появится только для слота,
          который выдаёт структурированная прогрессия.
        </p>
        {blockers.length ? (
          <div className={styles.validationList} role="alert">
            <strong>Нужны данные справочников</strong>
            <ul>{blockers.map(issue => <li key={issue.id}>{issue.message}</li>)}</ul>
          </div>
        ) : null}
      </section>

      <SpellcastingEditor
        draft={v4Draft}
        catalog={catalog}
        state={state}
        updateV4={updateV4}
      />
    </div>
  )
}
