'use client'

import { useMemo } from 'react'
import {
  createClassSpellcastingEntry,
  isSpellAvailable,
} from '../../rules/spells/calculate-spellcasting'
import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2CharacterState,
  Pathfinder2RulesCatalog,
  Pathfinder2SpellcastingEntry,
} from '../../types'
import type { UpdatePathfinder2V4 } from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

function traditionLabel(value: Pathfinder2SpellcastingEntry['tradition']) {
  return {
    arcane: 'Мистическая',
    divine: 'Божественная',
    occult: 'Оккультная',
    primal: 'Первородная',
  }[value]
}

export default function SpellcastingEditor({
  draft,
  catalog,
  state,
  updateV4,
}: {
  draft: Pathfinder2CharacterDraftV4
  catalog: Pathfinder2RulesCatalog
  state: Pathfinder2CharacterState
  updateV4: UpdatePathfinder2V4
}) {
  const calculated = state.spellcasting.entries[0]
  const entry = calculated?.entry
  const slotRanks = useMemo(
    () => entry ? [0, ...Object.keys(entry.spellSlots).map(Number)] : [],
    [entry],
  )
  const spellsByRank = useMemo(() => {
    if (!entry) return new Map<number, typeof catalog.spells>()
    return new Map(slotRanks.map(rank => {
      const source = rank === 0 ? catalog.cantrips : catalog.spells
      return [rank, source.filter(spell => (
        isSpellAvailable(spell, entry.tradition, Math.max(1, rank))
      ))]
    }))
  }, [catalog.cantrips, catalog.spells, entry, slotRanks])

  if (!state.spellcasting.expected) return null

  const initialize = () => {
    const nextEntry = createClassSpellcastingEntry(draft, catalog)
    if (!nextEntry) return
    updateV4(current => ({
      ...current,
      spellcasting: { entries: [nextEntry] },
    }), { immediate: true })
  }

  const setSpell = (rank: number, index: number, spellId: string) => {
    if (!entry) return
    updateV4(current => ({
      ...current,
      spellcasting: {
        entries: current.spellcasting.entries.map(candidate => {
          if (candidate.id !== entry.id) return candidate
          const spontaneous = candidate.mode === 'spontaneous'
            || candidate.mode === 'bounded'
          if (spontaneous) {
            const selected = [...(candidate.repertoireSpellIds[rank] ?? [])]
            selected[index] = spellId
            return {
              ...candidate,
              repertoireSpellIds: {
                ...candidate.repertoireSpellIds,
                [rank]: selected.filter(Boolean),
              },
            }
          }
          const selected = [...(candidate.preparedSpellIds[rank] ?? [])]
          selected[index] = spellId || null
          return {
            ...candidate,
            preparedSpellIds: {
              ...candidate.preparedSpellIds,
              [rank]: selected,
            },
            spellbookSpellIds: candidate.mode === 'spellbook-prepared' && spellId
              ? Array.from(new Set([...candidate.spellbookSpellIds, spellId]))
              : candidate.spellbookSpellIds,
          }
        }),
      },
    }), { immediate: true })
  }

  return (
    <section className={styles.rulesSection}>
      <header>
        <div>
          <span className={styles.choiceKicker}>Подэтап заклинателя</span>
          <h3>Заклинания</h3>
        </div>
        <span className={calculated ? styles.rulesStatusRequired : styles.rulesStatusError}>
          {calculated ? calculated.entry.mode : 'не инициализировано'}
        </span>
      </header>
      {!entry ? (
        <>
          <p>
            {state.spellcasting.canInitialize
              ? 'Традиция, характеристика и режим определены классом.'
              : state.spellcasting.issues[0]?.message}
          </p>
          <button
            type="button"
            className={styles.nextButton}
            disabled={!state.spellcasting.canInitialize}
            onClick={initialize}
          >
            Инициализировать заклинательство
          </button>
        </>
      ) : entry.mode === 'focus-only' ? (
        <p className={styles.ruleChangeNotice}>
          Фокусный пул создан ({entry.focusPoints}). Автоматический выбор
          фокусных заклинаний заблокирован: текущий каталог не содержит
          структурированной связи заклинания с классом или особенностью.
        </p>
      ) : (
        <>
          <p>
            {traditionLabel(entry.tradition)} традиция · атака заклинанием {
              calculated.spellAttack >= 0 ? '+' : ''
            }{calculated.spellAttack} · СЛ {calculated.spellDc}
          </p>
          {slotRanks.map(rank => {
            const count = rank === 0
              ? entry.cantripSlots
              : entry.spellSlots[rank] ?? 0
            const spontaneous = entry.mode === 'spontaneous' || entry.mode === 'bounded'
            const selected = spontaneous
              ? entry.repertoireSpellIds[rank] ?? []
              : entry.preparedSpellIds[rank] ?? []
            return (
              <div className={styles.fieldGrid} key={rank}>
                <strong className={styles.fieldWide}>
                  {rank === 0 ? 'Фокусы' : `${rank}-й круг`} · {count}
                </strong>
                {Array.from({ length: count }, (_, index) => (
                  <label className={styles.field} key={`${rank}:${index}`}>
                    <span className={styles.fieldLabel}>Слот {index + 1}</span>
                    <select
                      value={selected[index] ?? ''}
                      onChange={event => setSpell(rank, index, event.target.value)}
                    >
                      <option value="">Выберите заклинание</option>
                      {(spellsByRank.get(rank) ?? []).map(spell => (
                        <option key={spell.id} value={spell.id}>
                          {spell.name} · ур. {spell.level}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}
