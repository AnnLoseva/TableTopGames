'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import type { CharacterDerivedStats } from '@/games/vampires/core/vtm5/rules/derived-stats'
import type { DisciplineRollEffectResult } from '@/games/vampires/core/vtm5/rules/disciplines/effects'
import type { DamageSeverity, HealthDamageOptions } from '@/games/vampires/core/vtm5/rules/health'
import { tableDisciplines, tableHealth } from '../system-runtime'
import { getAttributeDots, resolveSkillValue } from '@/games/vampires/lib/i18n/ruleNames'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { ATTRIBUTE_GROUPS, INVENTORY_CATEGORIES, SKILL_GROUPS, type InventoryCategory } from '../constants/roll-traits'
import type {
  CharacterHumanity,
  CharacterOption,
  InventoryItem,
  NormalizedHealth,
  NormalizedWillpower,
  RollMeta,
  RollMode,
} from '../types'
import { CharacterPreviewVitals } from './CharacterPreviewVitals'
import { CharacterPreviewRollDock } from './CharacterPreviewRollDock'
import {
  buildCharacterSubtitle,
  getAttributePoolSlot,
  getDisciplineDots,
  getDotDisplay,
  getSkillDots,
  getSkillSpecs,
} from './character-preview-helpers'

function getSelectedPowerNames(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map(power => {
      if (typeof power === 'string') return power
      if (!power || typeof power !== 'object') return ''
      const record = power as Record<string, unknown>
      return String(record.name || record['название'] || '')
    })
    .filter(Boolean)
}

function getSelectedPathPowerNames(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([pathName, powers]) => {
      const names = getSelectedPowerNames(powers)
      return names.length ? [[pathName, names]] : []
    }),
  ) as Record<string, string[]>
}

function getSelectedPathPowerLabels(value: unknown) {
  return Object.entries(getSelectedPathPowerNames(value))
    .flatMap(([pathName, powers]) => powers.map(power => `${pathName} / ${power}`))
}

function getPathPowerNameSet(value: unknown) {
  return new Set(Object.values(getSelectedPathPowerNames(value)).flat())
}

function getStandaloneSelectedPowerNames(selectedPowers: unknown, selectedPathPowers: unknown) {
  const pathPowerNames = getPathPowerNameSet(selectedPathPowers)
  return getSelectedPowerNames(selectedPowers).filter(name => !pathPowerNames.has(name))
}

function getSelectedDisciplinePowerLabels(selectedPowers: unknown, selectedPathPowers: unknown) {
  return [
    ...getStandaloneSelectedPowerNames(selectedPowers, selectedPathPowers),
    ...getSelectedPathPowerLabels(selectedPathPowers),
  ]
}

function getActiveEffectTitle(activeEffect: CharacterOption['activeEffects'][number]) {
  return activeEffect.effect.label || activeEffect.source.power || activeEffect.effect.type
}

function getPayloadValueLabel(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const payloadLabels: Record<string, string> = {
    commandText: 'команда',
    memoryGap: 'провал',
    falseMemory: 'ложная память',
    triggerText: 'триггер',
    groupTarget: 'группа',
    disguiseText: 'маскировка',
    objectText: 'объект',
    senseTarget: 'цель',
    questionText: 'вопрос',
    telepathyMessage: 'мысль',
    possessionTarget: 'носитель',
    areaText: 'место',
    famulusName: 'фамулус',
    animalSpecies: 'вид',
    animalCommand: 'приказ',
    swarmTarget: 'цель роя',
    frenzyTarget: 'цель ярости',
    feedingSource: 'питание',
    targetName: 'цель',
    bloodSample: 'образец крови',
    weaponName: 'оружие',
    deliveryMethod: 'способ',
    ritualTarget: 'цель ритуала',
    ritualComponents: 'компоненты',
    alchemyMethod: 'метод',
    alchemyFormula: 'формула',
    formulaTarget: 'цель формулы',
    alchemyResonance: 'резонанс',
    alchemyIngredients: 'ингредиенты',
    imitatedDiscipline: 'дисциплина',
    imitatedPower: 'сила',
  }
  const label = payloadLabels[key] || key
  return `${label}: ${String(value)}`
}

function getActiveEffectPayloadDescription(activeEffect: CharacterOption['activeEffects'][number]) {
  const payload = activeEffect.effect.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ''
  return Object.entries(payload)
    .map(([key, value]) => getPayloadValueLabel(key, value))
    .filter(Boolean)
    .join(' · ')
}

function getActiveEffectDescription(
  activeEffect: CharacterOption['activeEffects'][number],
  t: (ru: string) => string,
  tf: (ru: string, vars: Record<string, string | number>) => string,
) {
  return [
    activeEffect.effect.description,
    getActiveEffectPayloadDescription(activeEffect),
    activeEffect.source.path,
    activeEffect.source.level ? tf('уровень {level}', { level: activeEffect.source.level }) : '',
    tableDisciplines().getDisciplineDurationLabel(activeEffect.duration, t, tf),
  ].filter(Boolean).join(' · ')
}

type ContestedOpponentOption = { id: string; label: string }
type ViewMode = 'simple' | 'full'

export type CharacterPreviewModalState = {
  tab: 'mechanics' | 'inventory'
  roll: {
    attribute: string
    attributeTwo: string
    skill: string
    discipline: string
    modifier: number
    mode: RollMode
    contestedOpponentId: string
    useBloodSurge: boolean
  }
  inventory: {
    name: string
    category: InventoryCategory
    quantity: number
    status: string
    isBusy: boolean
  }
}

export type CharacterPreviewModalComputed = {
  usesVampireResources: boolean
  hunger: number
  health: NormalizedHealth
  willpower: NormalizedWillpower
  humanity: CharacterHumanity
  bloodPotency: number
  sheetFixed: boolean
  damageProfile: NonNullable<CharacterOption['damageProfile']>
  healthDerived?: CharacterDerivedStats['health']
  willpowerDerived?: CharacterDerivedStats['willpower']
  canRoll: boolean
  canEditInventory: boolean
  canEditActiveEffects: boolean
  extraAttributes: string[]
  extraSkills: string[]
  disciplineNames: string[]
  diceCount: number
  poolBeforeLimit: number
  bloodSurgeBonus: number
  bloodSurgeEnabled: boolean
  rollEffectResult: DisciplineRollEffectResult | null
  contestedOpponentOptions: ContestedOpponentOption[]
  selectedContestedOpponent: ContestedOpponentOption | null
  willpowerRecoveryPool: number
  playerLabel: string
}

export type CharacterPreviewModalActions = {
  onTabChange: (tab: 'mechanics' | 'inventory') => void
  onClose: () => void
  setRollAttribute: (value: string) => void
  setRollAttributeTwo: (value: string) => void
  setRollSkill: (value: string) => void
  setRollDiscipline: (value: string) => void
  setRollModifier: (value: number) => void
  setRollMode: (mode: RollMode) => void
  setContestedOpponentId: (id: string) => void
  setUseBloodSurge: (enabled: boolean) => void
  toggleRollAttribute: (name: string) => void
  rollPool: () => void
  rollQuickDice: (count: number, label: string) => void
  openDiscipline: (name: string) => void
  rollRouseCheck: () => void
  setHungerLevel: (level: number) => void
  cycleHealthCell: (index: number) => void
  cycleWillpowerCell: (index: number) => void
  addHumanityStains: (amount: number) => void
  removeHumanityStains: (amount: number) => void
  performRemorseCheck: () => void
  applyHealthDamage: (amount: number, severity: DamageSeverity, options?: HealthDamageOptions) => void
  promptHealthDamage: () => void
  recoverHealth: (
    amount: number,
    severity: DamageSeverity,
    reason: string,
    source: NonNullable<RollMeta['healing']>['type'],
  ) => void
  mendSuperficial: () => void
  mendAggravated: () => void
  recoverMortalHealth: () => void
  treatMortalHealth: () => void
  clearHealth: () => void
  markTorporOrComa: () => void
  spendWillpower: (amount: number, reason: string) => void
  rollWillpowerCheck: () => void
  recoverWillpower: (amount: number, severity: 'superficial' | 'aggravated', reason: string) => void
  confirmRecoverAggravatedWillpower: () => void
  adjustWillpowerStress: (severity: 'superficial' | 'aggravated', delta: number) => void
  removeActiveEffect: (effectId: string) => void
  setQuickInventoryName: (value: string) => void
  setQuickInventoryCategory: (value: InventoryCategory) => void
  setQuickInventoryQuantity: (value: number) => void
  addQuickInventoryItem: (event: FormEvent<HTMLFormElement>) => void
  showInventoryItemToMaster: (item: InventoryItem) => void
  onAddExperience?: () => void
  renderRollModifierControls: (result: DisciplineRollEffectResult | null | undefined) => ReactNode
}

export type CharacterPreviewModalProps = {
  character: CharacterOption
  state: CharacterPreviewModalState
  computed: CharacterPreviewModalComputed
  actions: CharacterPreviewModalActions
  isMaster: boolean
  isActiveCharacter: boolean
  characterSheetHref: string
}

export function CharacterPreviewModal({
  character,
  state,
  computed,
  actions,
  isMaster,
  isActiveCharacter,
  characterSheetHref,
}: CharacterPreviewModalProps) {
  const { t, tf } = useLang()
  const [viewMode, setViewMode] = useState<ViewMode>('simple')
  const { roll, inventory } = state
  const {
    usesVampireResources,
    hunger,
    health,
    willpower,
    humanity,
    bloodPotency,
    sheetFixed,
    damageProfile,
    healthDerived,
    willpowerDerived,
    canRoll,
    canEditInventory,
    canEditActiveEffects,
    extraAttributes,
    extraSkills,
    disciplineNames,
    diceCount,
    poolBeforeLimit,
    bloodSurgeBonus,
    bloodSurgeEnabled,
    rollEffectResult,
    contestedOpponentOptions,
    selectedContestedOpponent,
    willpowerRecoveryPool,
    playerLabel,
  } = computed
  const superficialMendAmount = tableHealth().getSuperficialMendAmount(bloodPotency)
  const subtitle = buildCharacterSubtitle(
    { clan: character.clan, generation: character.generation, predator: character.predator },
    t,
    tf,
  )

  const renderTraitButton = (
    name: string,
    label: ReactNode,
    dots: number,
    active: boolean,
    poolSlot: number,
    onClick: () => void,
    compact = false,
  ) => (
    <button
      type="button"
      key={name}
      className={`preview-trait-btn${active ? ' active' : ''}${compact ? ' compact' : ''}`}
      title={active ? t('Убрать из пула') : tf('В пул: {name} {dots}', { name, dots })}
      onClick={onClick}
    >
      <span className="preview-trait-btn-label">
        {label}
        {poolSlot ? <i className="preview-trait-pool-badge">{poolSlot}</i> : null}
      </span>
      <span className="preview-trait-btn-dots" aria-label={tf('{dots} из 5', { dots })}>
        <i>{getDotDisplay(dots).replace(/○/g, '')}</i>
        <i className="empty">{getDotDisplay(dots).replace(/●/g, '')}</i>
      </span>
    </button>
  )

  return (
    <div className="media-preview-backdrop" role="dialog" aria-modal="true" aria-label={t('Быстрый лист персонажа')} onMouseDown={actions.onClose}>
      <section className="character-preview-modal" onMouseDown={event => event.stopPropagation()}>
        <header className="character-preview-header">
          <div className="character-preview-clan-icon" aria-hidden="true">
            {character.image
              ? <img src={character.image} alt="" />
              : <span>{character.name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="character-preview-title-block">
            <div className="character-preview-title-row">
              <strong>{character.name}</strong>
              <span className="character-preview-player-badge">{tf('Игрок: {name}', { name: playerLabel })}</span>
            </div>
            <span className="character-preview-subtitle">{subtitle}</span>
          </div>
          <div className="character-preview-header-spacer" aria-hidden="true" />
          <div className="character-preview-header-controls">
            <div className="character-preview-mode-toggle" role="group" aria-label={t('Режим листа')}>
              <button
                type="button"
                className={viewMode === 'simple' ? 'active' : ''}
                aria-pressed={viewMode === 'simple'}
                onClick={() => setViewMode('simple')}
              >
                {t('Простой')}
              </button>
              <button
                type="button"
                className={viewMode === 'full' ? 'active' : ''}
                aria-pressed={viewMode === 'full'}
                onClick={() => setViewMode('full')}
              >
                {t('Полный')}
              </button>
            </div>
            <a
              className="character-preview-sheet-link"
              href={characterSheetHref}
              target="_blank"
              rel="noreferrer"
              title={t('Открыть полный лист')}
              aria-label={t('Открыть полный лист')}
            >
              ↗
            </a>
            <button type="button" className="character-preview-close" onClick={actions.onClose} aria-label={t('Закрыть')}>✕</button>
          </div>
        </header>

        <CharacterPreviewVitals
          usesVampireResources={usesVampireResources}
          sheetFixed={sheetFixed}
          canRoll={canRoll}
          hunger={hunger}
          health={health}
          willpower={willpower}
          humanity={humanity}
          bloodPotency={bloodPotency}
          freeExp={character.freeExp ?? 0}
          isActiveCharacter={isActiveCharacter}
          t={t}
          tf={tf}
          onSetHungerLevel={actions.setHungerLevel}
          onCycleHealthCell={actions.cycleHealthCell}
          onCycleWillpowerCell={actions.cycleWillpowerCell}
          onAddHumanityStain={() => actions.addHumanityStains(1)}
          onRemoveHumanityStain={() => actions.removeHumanityStains(1)}
          onRollRouseCheck={actions.rollRouseCheck}
          onAddExperience={actions.onAddExperience}
        />

        <div className="character-preview-body">
          {viewMode === 'simple' ? (
            <div className="character-preview-simple">
              <p className="character-preview-hint">
                {t('Коснись характеристики и навыка — пул соберётся внизу сам. Повторное касание убирает выбор. Клетки треков наверху тоже нажимаются.')}
              </p>

              <section className="preview-trait-section">
                <div className="preview-section-heading">
                  <h3>{t('Характеристики')}</h3>
                  <span>{t('до двух в пул')}</span>
                </div>
                <div className="preview-trait-columns attributes">
                  {ATTRIBUTE_GROUPS.map(group => (
                    <div className="preview-trait-group" key={group.name}>
                      <h4>{t(group.name)}</h4>
                      {group.traits.map(name => {
                        const dots = getAttributeDots(character.attributes, name)
                        const poolSlot = getAttributePoolSlot(name, roll.attribute, roll.attributeTwo)
                        return renderTraitButton(
                          name,
                          t(name),
                          dots,
                          poolSlot > 0,
                          poolSlot,
                          () => actions.toggleRollAttribute(name),
                        )
                      })}
                    </div>
                  ))}
                  {extraAttributes.length ? (
                    <div className="preview-trait-group">
                      <h4>{t('Другие')}</h4>
                      {extraAttributes.map(name => {
                        const dots = getAttributeDots(character.attributes, name)
                        const poolSlot = getAttributePoolSlot(name, roll.attribute, roll.attributeTwo)
                        return renderTraitButton(name, name, dots, poolSlot > 0, poolSlot, () => actions.toggleRollAttribute(name))
                      })}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="preview-trait-section">
                <div className="preview-section-heading">
                  <h3>{t('Навыки')}</h3>
                  <span>{t('показаны только изученные — остальные в полном виде')}</span>
                </div>
                <div className="preview-trait-columns skills columns">
                  {SKILL_GROUPS.map(group => {
                    const learnedTraits = group.traits.filter(name => getSkillDots(resolveSkillValue(character.skills, name)) >= 1)
                    if (!learnedTraits.length) return null
                    return (
                      <div className="preview-trait-group" key={group.name}>
                        <h4>{t(group.name)}</h4>
                        {learnedTraits.map(name => {
                          const value = resolveSkillValue(character.skills, name)
                          const dots = getSkillDots(value)
                          const specs = getSkillSpecs(value)
                          return renderTraitButton(
                            name,
                            <>{t(name)}{specs.length ? <small>{specs.join(', ')}</small> : null}</>,
                            dots,
                            roll.skill === name,
                            0,
                            () => actions.setRollSkill(roll.skill === name ? '' : name),
                            true,
                          )
                        })}
                      </div>
                    )
                  })}
                  {extraSkills.some(name => getSkillDots(resolveSkillValue(character.skills, name)) >= 1) ? (
                    <div className="preview-trait-group">
                      <h4>{t('Другие')}</h4>
                      {extraSkills.map(name => {
                        const value = resolveSkillValue(character.skills, name)
                        const dots = getSkillDots(value)
                        if (dots < 1) return null
                        const specs = getSkillSpecs(value)
                        return renderTraitButton(
                          name,
                          <>{name}{specs.length ? <small>{specs.join(', ')}</small> : null}</>,
                          dots,
                          roll.skill === name,
                          0,
                          () => actions.setRollSkill(roll.skill === name ? '' : name),
                          true,
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="preview-trait-section">
                <div className="preview-section-heading">
                  <h3>{t('Дисциплины')}</h3>
                  <span>{t('добавляются в пул третьим слагаемым')}</span>
                </div>
                {disciplineNames.length === 0 ? (
                  <p className="character-preview-empty">{t('Дисциплины не сохранены.')}</p>
                ) : (
                  <div className="preview-discipline-list simple">
                    {disciplineNames.map(name => {
                      const dots = getDisciplineDots(character.disciplines[name] || {})
                      const powerLabels = getSelectedDisciplinePowerLabels(
                        character.selectedPowers[name],
                        character.selectedPathPowers[name],
                      )
                      const active = roll.discipline === name
                      return (
                        <article className={`preview-discipline-card${active ? ' active' : ''}`} key={name}>
                          <button
                            type="button"
                            className="preview-discipline-main"
                            onClick={() => actions.setRollDiscipline(active ? '' : name)}
                          >
                            <span>
                              <strong>{name}</strong>
                              <i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                            </span>
                            {powerLabels.length ? <p>{powerLabels.join(' · ')}</p> : null}
                          </button>
                          <button
                            type="button"
                            className="preview-discipline-open"
                            onClick={() => actions.openDiscipline(name)}
                          >
                            {t('Силы')} ↗
                          </button>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="character-preview-full">
              {!sheetFixed ? (
                <section className="preview-creation-vitals">
                  <div>
                    <span>{t('Лист ещё не зафиксирован')}</span>
                    <strong>{t('Стартовые значения')}</strong>
                  </div>
                  <dl>
                    <div><dt>{t('Здоровье')}</dt><dd>{health.max}</dd></div>
                    <div><dt>{t('Воля')}</dt><dd>{willpower.max}</dd></div>
                    {usesVampireResources ? <div><dt>{t('Человечность')}</dt><dd>{humanity.value}</dd></div> : null}
                    {usesVampireResources ? <div><dt>{t('Голод')}</dt><dd>{hunger}</dd></div> : null}
                    {usesVampireResources ? <div><dt>{t('Сила Крови')}</dt><dd>{bloodPotency}</dd></div> : null}
                  </dl>
                </section>
              ) : null}

              <section className="preview-trait-section">
                <div className="preview-section-heading">
                  <h3>{t('Характеристики')}</h3>
                  <span>{t('до двух в пул')}</span>
                </div>
                <div className="preview-trait-columns attributes">
                  {ATTRIBUTE_GROUPS.map(group => (
                    <div className="preview-trait-group" key={group.name}>
                      <h4>{t(group.name)}</h4>
                      {group.traits.map(name => {
                        const dots = getAttributeDots(character.attributes, name)
                        const poolSlot = getAttributePoolSlot(name, roll.attribute, roll.attributeTwo)
                        return renderTraitButton(
                          name,
                          t(name),
                          dots,
                          poolSlot > 0,
                          poolSlot,
                          () => actions.toggleRollAttribute(name),
                        )
                      })}
                    </div>
                  ))}
                  {extraAttributes.length ? (
                    <div className="preview-trait-group">
                      <h4>{t('Другие')}</h4>
                      {extraAttributes.map(name => {
                        const dots = getAttributeDots(character.attributes, name)
                        const poolSlot = getAttributePoolSlot(name, roll.attribute, roll.attributeTwo)
                        return renderTraitButton(name, name, dots, poolSlot > 0, poolSlot, () => actions.toggleRollAttribute(name))
                      })}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="preview-trait-section">
                <div className="preview-section-heading"><h3>{t('Навыки')}</h3><span>{t('все навыки листа')}</span></div>
                <div className="preview-trait-columns skills columns">
                  {SKILL_GROUPS.map(group => (
                    <div className="preview-trait-group" key={group.name}>
                      <h4>{t(group.name)}</h4>
                      {group.traits.map(name => {
                        const value = resolveSkillValue(character.skills, name)
                        const dots = getSkillDots(value)
                        const specs = getSkillSpecs(value)
                        return renderTraitButton(
                          name,
                          <>{t(name)}{specs.length ? <small>{specs.join(', ')}</small> : null}</>,
                          dots,
                          roll.skill === name,
                          0,
                          () => actions.setRollSkill(roll.skill === name ? '' : name),
                          true,
                        )
                      })}
                    </div>
                  ))}
                </div>
              </section>

              {sheetFixed ? (
                <>
                  {usesVampireResources ? (
                    <section className="preview-humanity-panel">
                      <div className="preview-section-heading">
                        <div><span>{t('Человечность')}</span><h3>{t('Сомнения и муки совести')}</h3></div>
                        <strong>{humanity.value} / 10</strong>
                      </div>
                      <div className="preview-humanity-actions">
                        <button type="button" onClick={() => actions.addHumanityStains(1)} disabled={!canRoll}>+ {t('Сомнение')}</button>
                        <button type="button" onClick={actions.performRemorseCheck} disabled={!canRoll || humanity.stains <= 0}>
                          {t('Проверка мук совести')}
                        </button>
                      </div>
                    </section>
                  ) : null}

                  <section className="preview-willpower-panel">
                    <div className="preview-section-heading">
                      <div><span>{t('Здоровье')}</span><h3>{t('Действия')}</h3></div>
                      <strong>{health.current} / {health.max}</strong>
                    </div>
                    {healthDerived ? (
                      <p className="preview-humanity-caption">
                        {t('Здоровье')}: {healthDerived.baseMax}
                        {healthDerived.legacyBonus > 0 ? ` + ${healthDerived.legacyBonus}` : ''}
                        {healthDerived.passiveBonus > 0 ? ` + ${healthDerived.passiveBonus} ${t('от Стойкости')}` : ''}
                        {' = '}{healthDerived.totalMax}
                      </p>
                    ) : null}
                    {health.impaired ? <p className="preview-roll-notice">{tableHealth().getHealthWarning(health, damageProfile, t)}</p> : null}
                    <div className="preview-willpower-actions preview-health-actions">
                      <button type="button" onClick={() => actions.applyHealthDamage(1, 'superficial', { source: 'manual', ignoreHalving: true })} disabled={!canRoll}>+ {t('лёгкий')}</button>
                      <button type="button" onClick={() => actions.applyHealthDamage(1, 'aggravated', { source: 'manual' })} disabled={!canRoll}>+ {t('тяжёлый')}</button>
                      <button type="button" onClick={actions.promptHealthDamage} disabled={!canRoll}>{t('+N урона')}</button>
                      <button type="button" onClick={() => actions.recoverHealth(1, 'superficial', 'Ручное лечение', 'manual')} disabled={!canRoll || health.superficial < 1}>- {t('лёгкий')}</button>
                      <button type="button" onClick={() => actions.recoverHealth(1, 'aggravated', 'Ручное лечение', 'manual')} disabled={!canRoll || health.aggravated < 1}>- {t('тяжёлый')}</button>
                      <button type="button" onClick={actions.mendSuperficial} disabled={!canRoll || health.superficial < 1 || !['vampire', 'thinblood'].includes(damageProfile)}>{t('Заживить лёгкий')}</button>
                      <button type="button" onClick={actions.mendAggravated} disabled={!canRoll || health.aggravated < 1 || !['vampire', 'thinblood'].includes(damageProfile)}>{t('Заживить тяжёлый')}</button>
                      <button type="button" onClick={actions.clearHealth} disabled={!canRoll || (!health.superficial && !health.aggravated)}>{t('Очистить')}</button>
                      <button type="button" onClick={actions.markTorporOrComa} disabled={!canRoll}>{t('Торпор/кома')}</button>
                    </div>
                    {usesVampireResources ? <p className="preview-roll-notice">{tf('Сила Крови {potency}: за Испытание Крови лечит {amount} лёгк.', { potency: bloodPotency, amount: superficialMendAmount })}</p> : null}
                  </section>

                  <section className="preview-willpower-panel">
                    <div className="preview-section-heading">
                      <div><span>{t('Воля')}</span><h3>{t('Действия')}</h3></div>
                      <strong>{willpower.current} / {willpower.max}</strong>
                    </div>
                    {willpowerDerived ? (
                      <p className="preview-humanity-caption">
                        {t('Воля')}: {willpowerDerived.baseMax}
                        {willpowerDerived.legacyBonus > 0 ? ` + ${willpowerDerived.legacyBonus}` : ''}
                        {willpowerDerived.passiveBonus > 0 ? ` + ${willpowerDerived.passiveBonus} ${t('от дисциплин')}` : ''}
                        {' = '}{willpowerDerived.totalMax}
                      </p>
                    ) : null}
                    <div className="preview-willpower-actions">
                      <button type="button" onClick={() => actions.spendWillpower(1, 'Воля: трата')} disabled={!canRoll || willpower.aggravated >= willpower.max}>{t('Потратить')}</button>
                      <button type="button" onClick={actions.rollWillpowerCheck} disabled={!canRoll || willpower.current < 1}>{t('Проверка Воли')}</button>
                      <button type="button" onClick={() => actions.recoverWillpower(willpowerRecoveryPool, 'superficial', 'Воля: начало встречи')} disabled={!canRoll || willpower.superficial < 1}>{t('Встреча')}</button>
                      <button type="button" onClick={actions.confirmRecoverAggravatedWillpower} disabled={!canRoll || willpower.aggravated < 1}>{t('Снять X')}</button>
                      <button type="button" onClick={() => actions.adjustWillpowerStress('superficial', 1)} disabled={!canRoll}>+ /</button>
                      <button type="button" onClick={() => actions.adjustWillpowerStress('superficial', -1)} disabled={!canRoll}>- /</button>
                      <button type="button" onClick={() => actions.adjustWillpowerStress('aggravated', 1)} disabled={!canRoll}>+ X</button>
                      <button type="button" onClick={() => actions.adjustWillpowerStress('aggravated', -1)} disabled={!canRoll}>- X</button>
                    </div>
                  </section>

                  <section className="preview-willpower-panel">
                    <div className="preview-section-heading">
                      <div><span>{t('Состояние')}</span><h3>{t('Активные эффекты')}</h3></div>
                      <strong>{character.activeEffects.length}</strong>
                    </div>
                    {character.activeEffects.length === 0 ? (
                      <p className="character-preview-empty">{t('Активных эффектов нет.')}</p>
                    ) : (
                      <div className="preview-inventory-list">
                        {character.activeEffects.map(activeEffect => (
                          <article key={activeEffect.id}>
                            <header>
                              <div>
                                <strong>{getActiveEffectTitle(activeEffect)}</strong>
                                <span>{activeEffect.source.discipline || t('Ручной эффект')}</span>
                              </div>
                              <b>{activeEffect.active ? t('активен') : t('выкл.')}</b>
                            </header>
                            {getActiveEffectDescription(activeEffect, t, tf) ? <p>{getActiveEffectDescription(activeEffect, t, tf)}</p> : null}
                            <footer>
                              <button type="button" onClick={() => actions.removeActiveEffect(activeEffect.id)} disabled={!canEditActiveEffects}>
                                {t('Отключить')}
                              </button>
                            </footer>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : null}

              <div className="character-inventory-sheet">
                <div className="preview-section-heading">
                  <div><span>{t('Снаряжение')}</span><h3>{t('Инвентарь')}</h3></div>
                  <strong>{character.inventory.length}</strong>
                </div>
                {canEditInventory ? (
                  <form className="quick-inventory-form" onSubmit={actions.addQuickInventoryItem}>
                    <label className="quick-inventory-name">
                      <span>{t('Новый предмет')}</span>
                      <input value={inventory.name} onChange={event => actions.setQuickInventoryName(event.target.value)} placeholder={t('Название')} maxLength={120} />
                    </label>
                    <label>
                      <span>{t('Категория')}</span>
                      <select value={inventory.category} onChange={event => actions.setQuickInventoryCategory(event.target.value as InventoryCategory)}>
                        {INVENTORY_CATEGORIES.map(category => <option value={category} key={category}>{t(category)}</option>)}
                      </select>
                    </label>
                    <label className="quick-inventory-quantity">
                      <span>{t('Количество')}</span>
                      <input type="number" min="0" max="999" value={inventory.quantity} onChange={event => actions.setQuickInventoryQuantity(Math.max(0, Math.min(999, Number(event.target.value) || 0)))} />
                    </label>
                    <button type="submit" disabled={!inventory.name.trim() || inventory.isBusy}>
                      {inventory.isBusy ? t('Сохраняю...') : t('Добавить')}
                    </button>
                  </form>
                ) : (
                  <p className="quick-inventory-readonly">{t('Добавлять предметы может владелец активного персонажа.')}</p>
                )}
                {inventory.status ? <p className="quick-inventory-status" role="status">{t(inventory.status)}</p> : null}
                {character.inventory.length === 0 ? (
                  <p className="character-preview-empty">{t('Инвентарь пуст.')}</p>
                ) : (
                  <div className="preview-inventory-list">
                    {character.inventory.map(item => (
                      <article key={item.id}>
                        <header>
                          <div><strong>{item.name || t('Без названия')}</strong><span>{t(item.category) || t('Без категории')}</span></div>
                          <b aria-label={tf('Количество: {quantity}', { quantity: item.quantity ?? 1 })}>×{item.quantity ?? 1}</b>
                        </header>
                        {item.description ? <p>{item.description}</p> : null}
                        {item.note ? <aside><span>{t('Заметка')}</span>{item.note}</aside> : null}
                        {canEditInventory && !isMaster ? (
                          <footer>
                            <button type="button" onClick={() => actions.showInventoryItemToMaster(item)}>{t('Показать мастеру')}</button>
                          </footer>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <CharacterPreviewRollDock
          character={character}
          roll={roll}
          usesVampireResources={usesVampireResources}
          canRoll={canRoll}
          diceCount={diceCount}
          poolBeforeLimit={poolBeforeLimit}
          bloodSurgeBonus={bloodSurgeBonus}
          bloodSurgeEnabled={bloodSurgeEnabled}
          hunger={hunger}
          rollEffectResult={rollEffectResult}
          contestedOpponentOptions={contestedOpponentOptions}
          selectedContestedOpponent={selectedContestedOpponent}
          t={t}
          tf={tf}
          setRollModifier={actions.setRollModifier}
          setRollMode={actions.setRollMode}
          setContestedOpponentId={actions.setContestedOpponentId}
          setUseBloodSurge={actions.setUseBloodSurge}
          setRollAttribute={actions.setRollAttribute}
          setRollAttributeTwo={actions.setRollAttributeTwo}
          setRollSkill={actions.setRollSkill}
          setRollDiscipline={actions.setRollDiscipline}
          rollPool={actions.rollPool}
          rollQuickDice={actions.rollQuickDice}
          renderRollModifierControls={actions.renderRollModifierControls}
          showAdvancedControls={viewMode === 'full'}
        />
      </section>
    </div>
  )
}