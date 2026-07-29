'use client'

import { useMemo, useState } from 'react'
import {
  purchaseEquipment,
  refundEquipment,
} from '../../rules/equipment/calculate-inventory'
import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2CurrencyAmount,
  Pathfinder2EquipmentItem,
  Pathfinder2RulesCatalog,
} from '../../types'
import type { UpdatePathfinder2V4 } from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

function currencyLabel(value: Pathfinder2CurrencyAmount) {
  const parts = [
    value.pp ? `${value.pp} пм` : '',
    value.gp ? `${value.gp} зм` : '',
    value.sp ? `${value.sp} см` : '',
    value.cp ? `${value.cp} мм` : '',
  ].filter(Boolean)
  return parts.join(' ') || 'бесплатно'
}

function priceLabel(item: Pathfinder2EquipmentItem) {
  return currencyLabel(item.price)
}

function allEquipment(catalog: Pathfinder2RulesCatalog) {
  return Array.from(new Map([
    ...catalog.equipment,
    ...catalog.weapons,
    ...catalog.armor,
    ...catalog.shields,
  ].map(item => [item.id, item])).values())
}

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
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<'all' | 'equipment' | 'weapon' | 'armor' | 'shield'>('all')
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState('')
  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru')
    return allEquipment(catalog)
      .filter(item => {
        if (group === 'equipment' && ['weapon', 'armor', 'shield'].includes(item.category)) {
          return false
        }
        if (group !== 'all' && group !== 'equipment' && item.category !== group) return false
        return !normalizedQuery || [
          item.name,
          item.id,
          item.sourceBook,
          ...item.traits,
        ].some(value => value.toLocaleLowerCase('ru').includes(normalizedQuery))
      })
      .sort((left, right) => (
        left.level - right.level || left.name.localeCompare(right.name, 'ru')
      ))
  }, [catalog, group, query])
  const visibleItems = items.slice(0, 80)

  const buy = (item: Pathfinder2EquipmentItem) => {
    const result = purchaseEquipment({
      entries: draft.inventory.entries,
      currency: draft.inventory.currency,
      item,
      quantity,
      entryId: globalThis.crypto?.randomUUID?.()
        ?? `inventory:${item.id}:${Date.now()}`,
    })
    if (!result.ok) {
      setNotice(result.reason === 'insufficient-funds'
        ? 'Недостаточно средств для покупки.'
        : 'Количество должно быть не меньше одного.')
      return
    }
    updateV4(current => ({
      ...current,
      inventory: {
        entries: result.entries,
        currency: result.currency,
      },
    }), { immediate: true })
    setNotice(`${item.name}: добавлено в инвентарь.`)
  }

  const refund = (entryId: string) => {
    const result = refundEquipment(
      draft.inventory.entries,
      draft.inventory.currency,
      entryId,
    )
    updateV4(current => ({
      ...current,
      inventory: {
        entries: result.entries,
        currency: result.currency,
      },
    }), { immediate: true })
    setNotice('Покупка отменена, стоимость возвращена.')
  }

  const toggleEquipped = (entryId: string, equipped: boolean) => {
    const target = draft.inventory.entries.find(entry => entry.id === entryId)
    if (!target) return
    const targetIsArmor = catalog.armor.some(item => item.id === target.itemId)
    const targetIsShield = catalog.shields.some(item => item.id === target.itemId)
    updateV4(current => ({
      ...current,
      inventory: {
        ...current.inventory,
        entries: current.inventory.entries.map(entry => {
          if (entry.id === entryId) return { ...entry, equipped }
          if (!equipped) return entry
          if (
            targetIsArmor
            && catalog.armor.some(item => item.id === entry.itemId)
          ) return { ...entry, equipped: false }
          if (
            targetIsShield
            && catalog.shields.some(item => item.id === entry.itemId)
          ) return { ...entry, equipped: false }
          return entry
        }),
      },
    }), { immediate: true })
  }

  return (
    <div className={styles.formStack}>
      <div className={styles.levelCard}>
        <div>
          <strong>Стартовый бюджет</strong>
          <p>Целочисленная валюта schema v4; покупки не используют floating point.</p>
        </div>
        <strong>{currencyLabel(draft.inventory.currency)}</strong>
      </div>
      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Структурированный магазин</span>
            <h3>Каталог снаряжения</h3>
          </div>
          <span className={
            availability?.status === 'connected'
              ? styles.rulesStatusOk
              : styles.rulesStatusError
          }>
            {allEquipment(catalog).length} позиций
          </span>
        </header>
        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Поиск по названию, ID, источнику или черте</span>
            <input
              type="search"
              value={query}
              placeholder="Например, арбалет или алхимия"
              onChange={event => setQuery(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Раздел</span>
            <select value={group} onChange={event => setGroup(event.target.value as typeof group)}>
              <option value="all">Все</option>
              <option value="equipment">Обычное снаряжение</option>
              <option value="weapon">Оружие</option>
              <option value="armor">Броня</option>
              <option value="shield">Щиты</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Количество</span>
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={event => setQuantity(Math.max(1, Math.round(Number(event.target.value) || 1)))}
            />
          </label>
        </div>
        <p className={styles.galleryCount}>
          Найдено <strong>{items.length}</strong>; показано {visibleItems.length}.
        </p>
        <div className={styles.catalogShopGrid}>
          {visibleItems.map(item => (
            <article className={styles.catalogShopCard} key={`${item.category}:${item.id}`}>
              <span className={styles.choiceKicker}>{item.category} · {item.level} ур.</span>
              <h4>{item.name}</h4>
              <p>{priceLabel(item)} · Bulk {item.bulk === 'light' ? 'L' : item.bulk}</p>
              <small>{item.traits.slice(0, 4).join(' · ') || item.sourceBook}</small>
              <button type="button" className={styles.textButton} onClick={() => buy(item)}>
                Купить
              </button>
            </article>
          ))}
        </div>
        {!visibleItems.length ? <p>По выбранным фильтрам ничего не найдено.</p> : null}
      </section>
      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Покупки и экипировка</span>
            <h3>Инвентарь</h3>
          </div>
          <span>{draft.inventory.entries.length} записей</span>
        </header>
        {notice ? <p className={styles.ruleChangeNotice} role="status">{notice}</p> : null}
        <div className={styles.inventoryList}>
          {draft.inventory.entries.map(entry => {
            const item = allEquipment(catalog).find(candidate => candidate.id === entry.itemId)
            const isShield = catalog.shields.some(candidate => candidate.id === entry.itemId)
            return (
              <article className={styles.inventoryRow} key={entry.id}>
                <div>
                  <strong>{entry.customName || item?.name || entry.itemId}</strong>
                  <small>{entry.quantity} шт. · {item ? priceLabel(item) : 'нет в каталоге'}</small>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={entry.equipped}
                    onChange={event => toggleEquipped(entry.id, event.target.checked)}
                  />
                  {isShield ? 'Щит поднят' : 'Экипировано'}
                </label>
                <button type="button" className={styles.textButton} onClick={() => refund(entry.id)}>
                  Вернуть
                </button>
              </article>
            )
          })}
          {!draft.inventory.entries.length ? <p>Покупок пока нет.</p> : null}
        </div>
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
