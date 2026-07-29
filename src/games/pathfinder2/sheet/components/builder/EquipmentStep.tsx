'use client'

import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2RulesCatalog,
} from '../../types'
import type { UpdatePathfinder2V4 } from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

export default function EquipmentStep({
  draft,
  catalog,
  updateV4,
}: {
  draft: Pathfinder2CharacterDraftV4
  catalog: Pathfinder2RulesCatalog
  updateV4: UpdatePathfinder2V4
}) {
  const availability = catalog.dataAvailability.find(entry => entry.id === 'equipment')

  return (
    <div className={styles.formStack}>
      <div className={styles.levelCard}>
        <div>
          <strong>Стартовый бюджет</strong>
          <p>Целочисленная валюта schema v4; покупки не используют floating point.</p>
        </div>
        <strong>
          {draft.inventory.currency.gp} зм {draft.inventory.currency.sp} см
        </strong>
      </div>
      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Структурированный магазин</span>
            <h3>Каталог снаряжения</h3>
          </div>
          <span className={styles.rulesStatusError}>
            {availability?.status ?? 'missing'}
          </span>
        </header>
        <p>
          {availability?.issues[0]
            ?? 'Каталог с ценой, Bulk и боевыми полями пока не подключён.'}
        </p>
        <p className={styles.ruleChangeNotice}>
          Файлы с описаниями предметов не преобразуются в механику в браузере:
          цену и Bulk нельзя надёжно извлечь из произвольного текста.
        </p>
      </section>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Наследованные заметки о снаряжении</span>
        <textarea
          rows={6}
          value={draft.migration.legacyNotes.equipment}
          placeholder="Только заметки — не считаются покупками и не влияют на КБ или Bulk."
          onChange={event => updateV4(current => ({
            ...current,
            migration: {
              ...current.migration,
              legacyNotes: {
                ...current.migration.legacyNotes,
                equipment: event.target.value,
              },
            },
          }))}
        />
      </label>
    </div>
  )
}
