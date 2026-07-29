'use client'

import { PATHFINDER2_ATTRIBUTES } from '../../data'
import { getClassById } from '../../data/selectors'
import type {
  Pathfinder2CharacterDraft,
  Pathfinder2CharacterDraftV4,
  Pathfinder2RulesCatalog,
} from '../../types'
import type { UpdatePathfinder2V4 } from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

export default function InitialAttributesStep({
  draft,
  v4Draft,
  catalog,
  updateV4,
}: {
  draft: Pathfinder2CharacterDraft
  v4Draft: Pathfinder2CharacterDraftV4
  catalog: Pathfinder2RulesCatalog
  updateV4: UpdatePathfinder2V4
}) {
  const characterClass = getClassById(catalog, draft.classId)

  return (
    <div className={styles.formStack}>
      <div className={styles.introCard}>
        <span className={styles.introGlyph} aria-hidden="true">+0</span>
        <div>
          <strong>Все характеристики начинают с +0</strong>
          <p>Это этап планирования: отметки ниже не меняют числа и не участвуют в rules engine.</p>
        </div>
      </div>
      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Необязательная подсказка</span>
            <h3>Приоритеты героя</h3>
          </div>
          <span className={styles.rulesStatusAuto}>
            {v4Draft.attributes.priorities.length} отмечено
          </span>
        </header>
        {characterClass ? (
          <p>
            Ключевые характеристики класса «{characterClass.name}»: {
              characterClass.keyAbilities
                .map(key => PATHFINDER2_ATTRIBUTES.find(attribute => attribute.key === key)?.label)
                .join(' или ')
            }.
          </p>
        ) : (
          <p>После выбора класса здесь появится его рекомендация.</p>
        )}
        <div className={styles.ruleChoiceGrid}>
          {PATHFINDER2_ATTRIBUTES.map(attribute => {
            const selected = v4Draft.attributes.priorities.includes(attribute.key)
            return (
              <button
                key={attribute.key}
                type="button"
                aria-pressed={selected}
                className={selected ? styles.ruleChoiceSelected : undefined}
                onClick={() => updateV4(current => ({
                  ...current,
                  attributes: {
                    ...current.attributes,
                    priorities: selected
                      ? current.attributes.priorities.filter(key => key !== attribute.key)
                      : [...current.attributes.priorities, attribute.key],
                  },
                }), { immediate: true })}
              >
                <strong>{attribute.shortLabel}</strong>
                <span>{attribute.label} · +0</span>
                <small>{attribute.description}</small>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
