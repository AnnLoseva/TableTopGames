import { signedModifier } from '../../rules/derived-character-values'
import type { Pathfinder2CharacterState } from '../../types'
import styles from '../Pathfinder2SheetPage.module.css'

export default function CalculationsStep({
  state,
}: {
  state: Pathfinder2CharacterState
}) {
  const values = state.derived
  const rows = [
    ['Максимальные ПЗ', values.maxHp ?? '—'],
    ['Класс брони', values.armorClass],
    ['Внимание', signedModifier(values.perception)],
    ['Стойкость', signedModifier(values.fortitude)],
    ['Реакция', signedModifier(values.reflex)],
    ['Воля', signedModifier(values.will)],
    ['Классовая СЛ', values.classDc ?? '—'],
    ['Скорость', values.speed ? `${values.speed} фт.` : '—'],
  ]

  return (
    <div className={styles.formStack}>
      <div className={styles.introCard}>
        <span className={styles.introGlyph} aria-hidden="true">∑</span>
        <div>
          <strong>Все значения ниже только для чтения</strong>
          <p>Они пересчитываются из характеристик и структурированных владений.</p>
        </div>
      </div>
      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Производные параметры</span>
            <h3>Текущий расчёт</h3>
          </div>
        </header>
        <div className={styles.summaryRules}>
          {rows.map(([label, value]) => (
            <div key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
      </section>
    </div>
  )
}
