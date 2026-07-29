'use client'

import { PROFICIENCY_LABELS } from '../../data/selectors'
import {
  getFeatAvailability,
  getFeatsForSlot,
} from '../../rules/feats/requirements'
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
  const selectFeat = (slotId: string, featId: string) => {
    const slot = state.featSlots.find(entry => entry.id === slotId)
    if (!slot) return
    updateV4(current => {
      const selectedBySlot = { ...current.feats.selectedBySlot }
      if (featId) selectedBySlot[slot.id] = featId
      else delete selectedBySlot[slot.id]
      const selectedForType = state.featSlots
        .filter(entry => entry.level === slot.level && entry.type === slot.type)
        .map(entry => entry.id === slot.id ? featId : selectedBySlot[entry.id])
        .filter(Boolean)
      return {
        ...current,
        feats: {
          ...current.feats,
          selectedBySlot,
        },
        ancestry: slot.type === 'ancestry-feat'
          ? {
              ...current.ancestry,
              featChoicesByLevel: {
                ...current.ancestry.featChoicesByLevel,
                [slot.level]: selectedForType,
              },
            }
          : current.ancestry,
        class: slot.type === 'class-feat'
          ? {
              ...current.class,
              featChoicesByLevel: {
                ...current.class.featChoicesByLevel,
                [slot.level]: selectedForType,
              },
            }
          : current.class,
      }
    }, { immediate: true })
  }

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
          Доступные варианты отфильтрованы по типу слота, уровню, народу,
          классу и структурированным требованиям.
        </p>
        {state.featSlots.map(slot => {
          const selectedId = slot.selectedFeatId ?? ''
          const options = getFeatsForSlot(slot, catalog)
            .filter(feat => (
              feat.id === selectedId
              || getFeatAvailability(feat, slot, state).available
            ))
            .sort((left, right) => (
              left.level - right.level || left.name.localeCompare(right.name, 'ru')
            ))
          return (
            <label className={styles.field} key={slot.id}>
              <span className={styles.fieldLabel}>
                {slot.type} · {slot.level} уровень{slot.required ? ' · обязательно' : ''}
              </span>
              <select
                value={selectedId}
                onChange={event => selectFeat(slot.id, event.target.value)}
              >
                <option value="">{slot.required ? 'Выберите черту' : 'Не выбирать'}</option>
                {options.map(feat => (
                  <option key={feat.id} value={feat.id}>
                    {feat.name} · {feat.level} ур.{feat.sourceBook ? ` · ${feat.sourceBook}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
        {!state.featSlots.length ? (
          <p className={styles.ruleChangeNotice}>
            Для выбранного класса нет структурированных слотов черт.
          </p>
        ) : null}
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
