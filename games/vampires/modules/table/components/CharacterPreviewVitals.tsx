'use client'

import { tableHumanity } from '../system-runtime'
import type { CharacterHumanity, NormalizedHealth, NormalizedWillpower } from '../types'

type VitalCellStatus = 'empty' | 'superficial' | 'aggravated' | 'hunger-filled' | 'humanity-filled' | 'stain'

type CharacterPreviewVitalsProps = {
  usesVampireResources: boolean
  sheetFixed: boolean
  canRoll: boolean
  hunger: number
  health: NormalizedHealth
  willpower: NormalizedWillpower
  humanity: CharacterHumanity
  bloodPotency: number
  freeExp: number
  isActiveCharacter: boolean
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  onSetHungerLevel: (level: number) => void
  onCycleHealthCell: (index: number) => void
  onCycleWillpowerCell: (index: number) => void
  onAddHumanityStain: () => void
  onRemoveHumanityStain: () => void
  onRollRouseCheck: () => void
  onAddExperience?: () => void
}

function VitalTrackCell({
  status,
  label,
  symbol = '',
  disabled,
  onClick,
}: {
  status: VitalCellStatus
  label: string
  symbol?: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className={`preview-vital-cell ${status}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {symbol}
    </button>
  )
}

export function CharacterPreviewVitals({
  usesVampireResources,
  sheetFixed,
  canRoll,
  hunger,
  health,
  willpower,
  humanity,
  bloodPotency,
  freeExp,
  isActiveCharacter,
  t,
  tf,
  onSetHungerLevel,
  onCycleHealthCell,
  onCycleWillpowerCell,
  onAddHumanityStain,
  onRemoveHumanityStain,
  onRollRouseCheck,
  onAddExperience,
}: CharacterPreviewVitalsProps) {
  const humanityWarning = usesVampireResources ? tableHumanity().getHumanityWarning(humanity) : null
  const maxStains = Math.max(0, 10 - humanity.value)

  return (
    <div className="character-preview-vitals" aria-label={t('Витальные треки')}>
      {usesVampireResources ? (
        <div className="preview-vital-group hunger">
          <div className="preview-vital-heading">
            <span>{t('Голод')}</span>
            <b>{hunger} / 5</b>
          </div>
          <div className="preview-vital-track">
            {Array.from({ length: 5 }, (_, index) => {
              const cell = index + 1
              const filled = cell <= hunger
              return (
                <VitalTrackCell
                  key={`hunger-${cell}`}
                  status={filled ? 'hunger-filled' : 'empty'}
                  label={filled
                    ? tf('Голод {cell} — убавить', { cell })
                    : tf('Голод {cell} — установить', { cell })}
                  disabled={!sheetFixed || !canRoll}
                  onClick={() => onSetHungerLevel(cell)}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="preview-vital-group">
        <div className="preview-vital-heading">
          <span>{t('Здоровье')}</span>
          <b>{health.current} / {health.max}</b>
        </div>
        <div className="preview-vital-track">
          {Array.from({ length: health.max }, (_, index) => {
            const cell = index + 1
            const status = cell <= health.aggravated
              ? 'aggravated'
              : cell <= health.aggravated + health.superficial
                ? 'superficial'
                : 'empty'
            return (
              <VitalTrackCell
                key={`health-${cell}`}
                status={status}
                symbol={status === 'aggravated' ? 'X' : status === 'superficial' ? '/' : ''}
                label={t('Здоровье: пусто → лёгкий (/) → тяжёлый (X) → пусто')}
                disabled={!sheetFixed || !canRoll}
                onClick={() => onCycleHealthCell(cell)}
              />
            )
          })}
        </div>
      </div>

      <div className="preview-vital-group">
        <div className="preview-vital-heading">
          <span>{t('Воля')}</span>
          <b>{willpower.current} / {willpower.max}</b>
        </div>
        <div className="preview-vital-track">
          {Array.from({ length: willpower.max }, (_, index) => {
            const cell = index + 1
            const status = cell <= willpower.aggravated
              ? 'aggravated'
              : cell <= willpower.aggravated + willpower.superficial
                ? 'superficial'
                : 'empty'
            return (
              <VitalTrackCell
                key={`willpower-${cell}`}
                status={status}
                symbol={status === 'aggravated' ? 'X' : status === 'superficial' ? '/' : ''}
                label={t('Воля: пусто → лёгкий (/) → тяжёлый (X) → пусто')}
                disabled={!sheetFixed || !canRoll}
                onClick={() => onCycleWillpowerCell(cell)}
              />
            )
          })}
        </div>
      </div>

      {usesVampireResources ? (
        <div className="preview-vital-group humanity">
          <div className="preview-vital-heading">
            <span>{t('Человечность')}</span>
            <b>{tf('{value} · сомн. {stains}', { value: humanity.value, stains: humanity.stains })}</b>
          </div>
          <div className="preview-vital-track humanity">
            {Array.from({ length: 10 }, (_, index) => {
              const cell = index + 1
              const status = cell <= humanity.value
                ? 'humanity-filled'
                : cell <= humanity.value + humanity.stains
                  ? 'stain'
                  : 'empty'
              const isStain = status === 'stain'
              const canAddStain = status === 'empty' && cell > humanity.value && humanity.stains < maxStains
              return (
                <VitalTrackCell
                  key={`humanity-${cell}`}
                  status={status}
                  label={isStain
                    ? t('Убрать Сомнение')
                    : canAddStain
                      ? t('Добавить Сомнение')
                      : t('Человечность меняется только Муками совести')}
                  disabled={!sheetFixed || !canRoll || (!isStain && !canAddStain)}
                  onClick={() => {
                    if (isStain) onRemoveHumanityStain()
                    else if (canAddStain) onAddHumanityStain()
                  }}
                />
              )
            })}
          </div>
          {humanityWarning ? (
            <p className={`preview-vital-notice ${humanity.status === 'lost_to_beast' ? 'danger' : 'warning'}`}>
              {t(humanityWarning)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="preview-vital-spacer" aria-hidden="true" />

      <div className="preview-vital-meta">
        <span className="preview-vital-meta-line">
          {usesVampireResources ? (
            <>
              {t('Сила Крови')} <b>{bloodPotency}</b>
              {' · '}
            </>
          ) : null}
          {t('Опыт')} <b>{freeExp ?? 0}</b>
        </span>
        <div className="preview-vital-meta-actions">
          {characterHasExperienceButton(isActiveCharacter, onAddExperience) ? (
            <button type="button" className="preview-vital-ghost" onClick={onAddExperience}>
              + {t('опыт')}
            </button>
          ) : null}
          {usesVampireResources && sheetFixed ? (
            <button type="button" className="preview-vital-blood" onClick={onRollRouseCheck} disabled={!canRoll}>
              {t('Испытание Крови')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function characterHasExperienceButton(
  isActiveCharacter: boolean,
  onAddExperience?: () => void,
) {
  return Boolean(isActiveCharacter && onAddExperience)
}