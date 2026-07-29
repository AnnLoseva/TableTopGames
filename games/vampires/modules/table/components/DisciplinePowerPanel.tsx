'use client'

import type { ReactNode } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import type { DisciplineCost } from '@/games/vampires/core/vtm5/rules/disciplines/costs'
import type { DisciplinePowerInputField } from '@/games/vampires/core/vtm5/rules/disciplines/schema'
import {
  type DisciplinePowerEntry,
  type DisciplineRule,
  type PowerPoolChoice,
  getDisciplinePowerEntryKey,
} from '../utils/discipline-ui'
import { formatRuleValue, getDotDisplay } from '../utils/display'

type DisciplineManualPrompt = {
  label: string
  description: string
  message: string
}

export type DisciplinePowerPanelProps = {
  open: boolean
  disciplineName: string
  openedDisciplineDots: number
  disciplineRulesStatus: string | null | undefined
  disciplineRule: DisciplineRule | undefined
  disciplinePowers: DisciplinePowerEntry[]
  selectedPowerName: string
  onSelectPower: (powerKey: string) => void
  selectedPower: DisciplinePowerEntry | null
  selectedPowerRollSummary: string
  selectedPowerDifficultySummary: string
  selectedPowerCost: DisciplineCost
  selectedPowerCostLabel: string
  selectedPowerManualPrompts: DisciplineManualPrompt[]
  selectedPowerInputFields: DisciplinePowerInputField[]
  powerInputValues: Record<string, string>
  onPowerInputChange: (fieldId: string, value: string) => void
  hasMissingPowerInput: boolean
  powerDiceCount: number
  powerPoolChoices: PowerPoolChoice[]
  powerPoolSelections: string[]
  onPowerPoolSelectionChange: (index: number, value: string) => void
  powerModifier: number
  onPowerModifierChange: (value: number) => void
  selectedPowerIsActive: boolean
  selectedPowerIsActiveKind: boolean
  onDeactivatePower: () => void
  onRollPower: () => void
  canRoll: boolean
  rollModifierControls: ReactNode
  powerOpposition: string
  selectedPowerRollFormula: string
  resolvedPowerPool: string
  hasWillpowerImpairmentPenalty: boolean
  hasHealthImpairmentPenalty: boolean
  getPoolPartDots: (name: string) => number
  onClose: () => void
}

export function DisciplinePowerPanel({
  open,
  disciplineName,
  openedDisciplineDots,
  disciplineRulesStatus,
  disciplineRule,
  disciplinePowers,
  selectedPowerName,
  onSelectPower,
  selectedPower,
  selectedPowerRollSummary,
  selectedPowerDifficultySummary,
  selectedPowerCost,
  selectedPowerCostLabel,
  selectedPowerManualPrompts,
  selectedPowerInputFields,
  powerInputValues,
  onPowerInputChange,
  hasMissingPowerInput,
  powerDiceCount,
  powerPoolChoices,
  powerPoolSelections,
  onPowerPoolSelectionChange,
  powerModifier,
  onPowerModifierChange,
  selectedPowerIsActive,
  selectedPowerIsActiveKind,
  onDeactivatePower,
  onRollPower,
  canRoll,
  rollModifierControls,
  powerOpposition,
  selectedPowerRollFormula,
  resolvedPowerPool,
  hasWillpowerImpairmentPenalty,
  hasHealthImpairmentPenalty,
  getPoolPartDots,
  onClose,
}: DisciplinePowerPanelProps) {
  const { t, tf } = useLang()
  const d10 = (n: number) => tf('{n}к10', { n })

  if (!open) return null

  return (
    <div className="discipline-detail-backdrop" role="dialog" aria-modal="true" aria-label={tf('Дисциплина {name}', { name: disciplineName })} onMouseDown={onClose}>
      <section className="discipline-detail-modal" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <span>{tf('Дисциплина · {dots} точек', { dots: openedDisciplineDots })}</span>
            <strong>{disciplineName}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Закрыть описание дисциплины')}>×</button>
        </header>

        {disciplineRulesStatus ? (
          <div className="discipline-detail-status">{t(disciplineRulesStatus)}</div>
        ) : !disciplineRule ? (
          <div className="discipline-detail-status">{t('Описание этой дисциплины не найдено в правилах.')}</div>
        ) : (
          <div className="discipline-detail-layout">
            <aside className="discipline-detail-sidebar">
              <div className="discipline-description">
                <p>{disciplineRule.description || t('Описание отсутствует.')}</p>
                {disciplineRule.system ? (
                  <dl>
                    {Object.entries(disciplineRule.system).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key === 'type' ? t('Тип') : key === 'masquerade' ? t('Маскарад') : key === 'resonance' ? t('Резонанс') : key === 'limitations' ? t('Ограничения') : key}</dt>
                        <dd>{formatRuleValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
              <nav className="discipline-power-list" aria-label={t('Силы дисциплины')}>
                {disciplinePowers.length ? disciplinePowers.map(power => (
                  <button
                    type="button"
                    key={`${power.path || 'direct'}-${power.level}-${power.name}`}
                    className={selectedPowerName === getDisciplinePowerEntryKey(power) ? 'active' : ''}
                    onClick={() => onSelectPower(getDisciplinePowerEntryKey(power))}
                  >
                    <span>{power.path ? `${power.path} · ${tf('Уровень {level}', { level: power.level })}` : tf('Уровень {level}', { level: power.level })}</span>
                    <strong>{power.name}</strong>
                  </button>
                )) : (
                  <p>{t('Для текущего уровня нет выбранных сил.')}</p>
                )}
              </nav>
            </aside>

            <main className="discipline-power-detail">
              {selectedPower ? (
                <>
                  <div className="discipline-power-title">
                    <div><span>{selectedPower.path ? `${selectedPower.path} · ${tf('Уровень {level}', { level: selectedPower.level })}` : tf('Уровень {level}', { level: selectedPower.level })}</span><h3>{selectedPower.name}</h3></div>
                    <i>{getDotDisplay(selectedPower.level)}</i>
                  </div>
                  <p className="discipline-power-description">{selectedPower.rule.description || t('Описание отсутствует.')}</p>
                  <dl className="discipline-power-facts">
                    <div><dt>{t('Бросок')}</dt><dd>{selectedPowerRollSummary || '—'}</dd></div>
                    <div><dt>{t('Сложность')}</dt><dd>{selectedPowerDifficultySummary || '—'}</dd></div>
                    <div><dt>{t('Стоимость')}</dt><dd>{selectedPowerCostLabel}</dd></div>
                    {selectedPowerCost.willpowerSpend || selectedPowerCost.willpowerRatingReduction || selectedPowerCost.manualWillpower ? (
                      <div>
                        <dt>{t('Воля')}</dt>
                        <dd>
                          {selectedPowerCost.willpowerRatingReduction
                            ? tf('проверь снижение рейтинга: {rating}', { rating: selectedPowerCost.willpowerRatingReduction })
                            : selectedPowerCost.manualWillpower
                              ? t('добровольная трата')
                              : tf('{n} пункт', { n: selectedPowerCost.willpowerSpend })}
                        </dd>
                      </div>
                    ) : null}
                    {selectedPowerCost.bloodPoints || selectedPowerCost.manualBlood ? (
                      <div>
                        <dt>{t('Кровь')}</dt>
                        <dd>
                          {selectedPowerCost.variableBloodPoints
                            ? tf('до {n} пункт', { n: selectedPowerCost.bloodPoints || 1 })
                            : selectedPowerCost.bloodPoints
                              ? tf('{n} пункт', { n: selectedPowerCost.bloodPoints })
                              : t('ручная стоимость')}
                        </dd>
                      </div>
                    ) : null}
                    <div><dt>{t('Длительность')}</dt><dd>{selectedPower.rule.duration || '—'}</dd></div>
                  </dl>
                  {selectedPower.rule.effect ? (
                    <section className="discipline-power-effect">
                      <h4>{t('Эффект')}</h4>
                      <p>{selectedPower.rule.effect}</p>
                    </section>
                  ) : null}
                  {selectedPowerManualPrompts.length ? (
                    <section className="discipline-power-effect">
                      <h4>{t('Подсказка')}</h4>
                      {selectedPowerManualPrompts.map((prompt, index) => (
                        <p key={`${prompt.label || 'manual-prompt'}-${index}`}>
                          {prompt.label ? <strong>{t(prompt.label)}. </strong> : null}
                          {t(prompt.description || prompt.message)}
                        </p>
                      ))}
                    </section>
                  ) : null}
                  {selectedPowerInputFields.length ? (
                    <section className="discipline-power-inputs">
                      <h4>{t('Данные для эффекта')}</h4>
                      {selectedPowerInputFields.map(field => (
                        <label key={field.id}>
                          <span>
                            {field.label ? t(field.label) : field.id}
                            {field.required ? ' *' : ''}
                          </span>
                          {field.type === 'select' ? (
                            <select
                              value={powerInputValues[field.id] || ''}
                              onChange={event => onPowerInputChange(field.id, event.target.value)}
                            >
                              <option value="">{field.placeholder ? t(field.placeholder) : t('Выбери значение')}</option>
                              {(field.options || []).map(option => (
                                <option key={option.value} value={option.value}>
                                  {t(option.label)}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'textarea' ? (
                            <textarea
                              value={powerInputValues[field.id] || ''}
                              placeholder={field.placeholder ? t(field.placeholder) : undefined}
                              onChange={event => onPowerInputChange(field.id, event.target.value)}
                            />
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={powerInputValues[field.id] || ''}
                              placeholder={field.placeholder ? t(field.placeholder) : undefined}
                              onChange={event => onPowerInputChange(field.id, event.target.value)}
                            />
                          )}
                          {field.description ? <em>{t(field.description)}</em> : null}
                        </label>
                      ))}
                      {hasMissingPowerInput ? (
                        <p>{t('Заполни обязательные поля перед активацией силы.')}</p>
                      ) : null}
                    </section>
                  ) : null}

                  <section className="discipline-power-roll">
                    <div className="preview-section-heading">
                      <div><span>{t('По формуле силы')}</span><h3>{t('Бросок')}</h3></div>
                      <strong>{d10(powerDiceCount)}</strong>
                    </div>
                    {powerPoolChoices.length ? (
                      <>
                        <div className="discipline-power-roll-controls">
                          {powerPoolChoices.map((choice, index) => (
                            <label key={`${choice.source}-${index}`}>
                              <span>{tf('Часть пула {n}', { n: index + 1 })}</span>
                              <select
                                value={powerPoolSelections[index] || ''}
                                onChange={event => onPowerPoolSelectionChange(index, event.target.value)}
                              >
                                {choice.options.map(option => (
                                  <option key={option} value={option}>{option} · {getPoolPartDots(option)}</option>
                                ))}
                              </select>
                            </label>
                          ))}
                          <label>
                            <span>{t('Модификатор')}</span>
                            <input
                              type="number"
                              min="-20"
                              max="20"
                              value={powerModifier}
                              onChange={event => onPowerModifierChange(Math.max(-20, Math.min(20, Number(event.target.value) || 0)))}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={selectedPowerIsActive ? onDeactivatePower : onRollPower}
                            disabled={!canRoll || (
                              !selectedPowerIsActive
                              && powerDiceCount < 1
                            ) || (!selectedPowerIsActive && hasMissingPowerInput)}
                          >
                            {selectedPowerIsActive
                              ? t('Отключить')
                              : selectedPowerIsActiveKind
                                ? t('Активировать')
                                : tf('Бросить {count}к10', { count: powerDiceCount })}
                          </button>
                        </div>
                        {rollModifierControls}
                        {powerOpposition ? <p className="discipline-roll-opposition">{tf('Сопротивление цели: {value}', { value: powerOpposition })}</p> : null}
                        {selectedPowerRollFormula !== resolvedPowerPool ? <p className="discipline-roll-opposition">{tf('Используется формула силы «{formula}».', { formula: selectedPowerRollFormula.replace(/^как\s+/i, '') })}</p> : null}
                        {hasWillpowerImpairmentPenalty ? <p className="discipline-roll-opposition">{t('Истощение Воли: -2к10 к этому пулу.')}</p> : null}
                        {hasHealthImpairmentPenalty ? <p className="discipline-roll-opposition">{t('Изнурение по здоровью: -2к10 к этому пулу.')}</p> : null}
                        {selectedPowerCost.warnings.map((warning, index) => <p className="discipline-roll-opposition" key={`wp-cost-warning-${index}`}>{t(warning)}</p>)}
                      </>
                    ) : (
                      selectedPowerIsActiveKind
                      || selectedPowerCost.rouseChecks > 0
                      || (selectedPowerCost.willpowerSpend > 0 && !selectedPowerCost.manualWillpower) ? (
                        <div className="discipline-activation-only">
                          <button
                            type="button"
                            onClick={selectedPowerIsActive ? onDeactivatePower : onRollPower}
                            disabled={!canRoll || (!selectedPowerIsActive && hasMissingPowerInput)}
                          >
                            {selectedPowerIsActive
                              ? t('Отключить')
                              : t('Активировать')}
                          </button>
                          <p className="discipline-no-roll">
                            {selectedPowerIsActive
                              ? t('Сила активна и сохранена в эффектах персонажа.')
                              : tf('У силы нет автоматического пула, но есть цена: {cost}.', { cost: selectedPowerCostLabel })}
                          </p>
                        </div>
                      ) : (
                        <p className="discipline-no-roll">{t('Для этой силы отдельный автоматический бросок не требуется или его пул зависит от ситуации. При необходимости используй конструктор броска в кратком листе.')}</p>
                      )
                    )}
                    {!canRoll ? <p className="discipline-roll-opposition">{t('Бросать может мастер или владелец активного персонажа.')}</p> : null}
                  </section>
                </>
              ) : (
                <div className="discipline-detail-status">{t('Выбери силу слева.')}</div>
              )}
            </main>
          </div>
        )}
      </section>
    </div>
  )
}