'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_PATHFINDER2_DRAFT,
  PATHFINDER2_ANCESTRIES,
  PATHFINDER2_ATTRIBUTES,
  PATHFINDER2_BACKGROUNDS,
  PATHFINDER2_CLASSES,
  PATHFINDER2_DRAFT_STORAGE_KEY,
  PATHFINDER2_SKILLS,
  PATHFINDER2_STEPS,
} from '../data'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2StepId,
} from '../types'
import {
  getPf2RuSearchUrl,
  PATHFINDER2_RULE_GUIDES,
} from '../rules-source'
import styles from './Pathfinder2SheetPage.module.css'

const ATTRIBUTE_NAME_BY_KEY = Object.fromEntries(
  PATHFINDER2_ATTRIBUTES.map(attribute => [attribute.key, attribute.label]),
) as Record<Pathfinder2AttributeKey, string>

function signedModifier(value: number) {
  return value >= 0 ? `+${value}` : String(value)
}

function clampLevel(value: number) {
  return Math.min(20, Math.max(1, Math.round(value || 1)))
}

function parseStoredDraft(raw: string): Pathfinder2CharacterDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<Pathfinder2CharacterDraft>
    return {
      ...DEFAULT_PATHFINDER2_DRAFT,
      ...parsed,
      level: clampLevel(Number(parsed.level)),
      attributes: {
        ...DEFAULT_PATHFINDER2_DRAFT.attributes,
        ...(parsed.attributes ?? {}),
      },
      trainedSkills: Array.isArray(parsed.trainedSkills) ? parsed.trainedSkills : [],
    }
  } catch {
    return null
  }
}

function OptionMark({ label }: { label: string }) {
  return <span className={styles.optionMark}>{label.slice(0, 1)}</span>
}

export default function Pathfinder2SheetPage() {
  const [activeStep, setActiveStep] = useState<Pathfinder2StepId>('concept')
  const [draft, setDraft] = useState<Pathfinder2CharacterDraft>(DEFAULT_PATHFINDER2_DRAFT)
  const [hydrated, setHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Подготовка черновика')

  useEffect(() => {
    const stored = window.localStorage.getItem(PATHFINDER2_DRAFT_STORAGE_KEY)
    const parsed = stored ? parseStoredDraft(stored) : null
    if (parsed) setDraft(parsed)
    setHydrated(true)
    setSaveStatus(parsed ? 'Черновик восстановлен' : 'Новый локальный черновик')
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(PATHFINDER2_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    setSaveStatus('Сохранено локально')
  }, [draft, hydrated])

  const selectedAncestry = PATHFINDER2_ANCESTRIES.find(option => option.id === draft.ancestryId)
  const selectedBackground = PATHFINDER2_BACKGROUNDS.find(option => option.id === draft.backgroundId)
  const selectedClass = PATHFINDER2_CLASSES.find(option => option.id === draft.classId)

  const activeStepIndex = PATHFINDER2_STEPS.findIndex(step => step.id === activeStep)
  const activeStepInfo = PATHFINDER2_STEPS[activeStepIndex]
  const activeRuleGuides = PATHFINDER2_RULE_GUIDES.filter(guide => guide.step === activeStep)

  const stepCompletion = useMemo<Record<Pathfinder2StepId, boolean>>(() => ({
    concept: Boolean(draft.name.trim() && draft.concept.trim()),
    origin: Boolean(draft.ancestryId && draft.heritage && draft.backgroundId),
    class: Boolean(draft.classId && draft.keyAbility),
    attributes: Object.values(draft.attributes).some(value => value !== 0),
    skills: draft.trainedSkills.length > 0,
    equipment: Boolean(
      draft.languages.trim()
      || draft.generalFeat.trim()
      || draft.equipment.trim()
      || draft.notes.trim(),
    ),
  }), [draft])

  const completedSteps = Object.values(stepCompletion).filter(Boolean).length
  const completionPercent = Math.round((completedSteps / PATHFINDER2_STEPS.length) * 100)
  const keyAbility = draft.keyAbility || selectedClass?.keyAbilities[0] || ''
  const keyModifier = keyAbility ? draft.attributes[keyAbility] : 0
  const proficiency = draft.level + 2
  const maxHp = selectedAncestry && selectedClass
    ? Math.max(
      1,
      selectedAncestry.hp
        + draft.level * (selectedClass.hp + draft.attributes.constitution),
    )
    : null
  const armorClass = 10 + proficiency + draft.attributes.dexterity
  const perception = proficiency + draft.attributes.wisdom
  const classDc = selectedClass ? 10 + proficiency + keyModifier : null

  const updateDraft = <Key extends keyof Pathfinder2CharacterDraft>(
    key: Key,
    value: Pathfinder2CharacterDraft[Key],
  ) => {
    setSaveStatus('Сохраняю…')
    setDraft(current => ({ ...current, [key]: value }))
  }

  const updateAttribute = (key: Pathfinder2AttributeKey, value: number) => {
    const nextValue = Math.min(4, Math.max(-1, value))
    setSaveStatus('Сохраняю…')
    setDraft(current => ({
      ...current,
      attributes: {
        ...current.attributes,
        [key]: nextValue,
      },
    }))
  }

  const chooseAncestry = (ancestryId: string) => {
    const ancestry = PATHFINDER2_ANCESTRIES.find(option => option.id === ancestryId)
    setDraft(current => ({
      ...current,
      ancestryId,
      heritage: ancestry?.heritages[0] ?? '',
    }))
  }

  const chooseClass = (classId: string) => {
    const characterClass = PATHFINDER2_CLASSES.find(option => option.id === classId)
    setDraft(current => ({
      ...current,
      classId,
      keyAbility: characterClass?.keyAbilities[0] ?? '',
    }))
  }

  const toggleSkill = (skill: string) => {
    setDraft(current => ({
      ...current,
      trainedSkills: current.trainedSkills.includes(skill)
        ? current.trainedSkills.filter(item => item !== skill)
        : [...current.trainedSkills, skill],
    }))
  }

  const goToRelativeStep = (offset: number) => {
    const nextIndex = Math.min(
      PATHFINDER2_STEPS.length - 1,
      Math.max(0, activeStepIndex + offset),
    )
    setActiveStep(PATHFINDER2_STEPS[nextIndex].id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetDraft = () => {
    if (!window.confirm('Очистить локальный черновик Pathfinder 2?')) return
    setDraft(DEFAULT_PATHFINDER2_DRAFT)
    setActiveStep('concept')
    setSaveStatus('Создан новый черновик')
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandSeal} aria-hidden="true">
            <span>P2</span>
          </span>
          <span className={styles.brandText}>
            <strong>Pathfinder</strong>
            <small>мастерская персонажа · вторая редакция</small>
          </span>
        </div>

        <div className={styles.topbarActions}>
          <span className={styles.saveStatus}>
            <i aria-hidden="true" />
            {saveStatus}
          </span>
          <button className={styles.quietButton} type="button" onClick={resetDraft}>
            Новый черновик
          </button>
        </div>
      </header>

      <div className={styles.progressTrack} aria-label={`Готовность ${completionPercent}%`}>
        <span style={{ width: `${completionPercent}%` }} />
      </div>

      <div className={styles.workspace}>
        <aside className={styles.stepsPanel}>
          <div className={styles.panelEyebrow}>Маршрут героя</div>
          <h2>Создание</h2>
          <p className={styles.panelIntro}>
            Шесть опорных решений. Можно возвращаться к любому этапу.
          </p>

          <nav className={styles.stepsNav} aria-label="Этапы создания персонажа">
            {PATHFINDER2_STEPS.map((step, index) => {
              const isActive = activeStep === step.id
              const isComplete = stepCompletion[step.id]
              return (
                <button
                  className={`${styles.stepButton} ${isActive ? styles.stepButtonActive : ''}`}
                  type="button"
                  key={step.id}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => setActiveStep(step.id)}
                >
                  <span className={styles.stepNumber}>
                    {isComplete ? '✓' : String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <strong>{step.label}</strong>
                    <small>{step.description}</small>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className={styles.completionCard}>
            <span className={styles.completionValue}>{completionPercent}%</span>
            <span>
              <strong>{completedSteps} из {PATHFINDER2_STEPS.length}</strong>
              <small>этапов заполнено</small>
            </span>
          </div>
        </aside>

        <section className={styles.editor}>
          <div className={styles.editorHeading}>
            <div>
              <span className={styles.breadcrumb}>
                Этап {activeStepIndex + 1} · {activeStepInfo.shortLabel}
              </span>
              <h1>{activeStepInfo.label}</h1>
              <p>{activeStepInfo.description}</p>
            </div>
            <span className={styles.chapterNumber}>
              {String(activeStepIndex + 1).padStart(2, '0')}
            </span>
          </div>

          {activeStep === 'concept' ? (
            <div className={styles.formStack}>
              <div className={styles.introCard}>
                <span className={styles.introGlyph} aria-hidden="true">✦</span>
                <div>
                  <strong>Сначала — идея, потом цифры</strong>
                  <p>
                    Опишите героя одной ясной фразой. Она поможет выбирать происхождение,
                    класс и умения в следующих разделах.
                  </p>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.fieldLabel}>Имя персонажа</span>
                  <input
                    value={draft.name}
                    onChange={event => updateDraft('name', event.target.value)}
                    placeholder="Например, Мира Тихий След"
                    autoComplete="off"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Игрок</span>
                  <input
                    value={draft.player}
                    onChange={event => updateDraft('player', event.target.value)}
                    placeholder="Ваше имя"
                    autoComplete="off"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Обращение</span>
                  <input
                    value={draft.pronouns}
                    onChange={event => updateDraft('pronouns', event.target.value)}
                    placeholder="Она / её"
                    autoComplete="off"
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.fieldLabel}>
                    Концепция
                    <small>одна–две фразы</small>
                  </span>
                  <textarea
                    value={draft.concept}
                    onChange={event => updateDraft('concept', event.target.value)}
                    placeholder="Бывшая картографка, которая ищет исчезнувший город и боится снова вести людей в неизвестность."
                    rows={5}
                  />
                </label>
              </div>

              <div className={styles.levelCard}>
                <div>
                  <span className={styles.fieldLabel}>Стартовый уровень</span>
                  <p>Большинство приключений начинается с первого уровня.</p>
                </div>
                <div className={styles.levelControl}>
                  <button
                    type="button"
                    aria-label="Уменьшить уровень"
                    onClick={() => updateDraft('level', clampLevel(draft.level - 1))}
                  >
                    −
                  </button>
                  <input
                    aria-label="Уровень персонажа"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.level}
                    onChange={event => updateDraft('level', clampLevel(Number(event.target.value)))}
                  />
                  <button
                    type="button"
                    aria-label="Увеличить уровень"
                    onClick={() => updateDraft('level', clampLevel(draft.level + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === 'origin' ? (
            <div className={styles.formStack}>
              <div className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>
                  <span>01</span>
                  <div>
                    <h3>Народ</h3>
                    <p>Определяет базовое здоровье, скорость и доступные наследия.</p>
                  </div>
                </div>
                <div className={styles.optionGrid}>
                  {PATHFINDER2_ANCESTRIES.map(ancestry => (
                    <button
                      type="button"
                      key={ancestry.id}
                      className={`${styles.optionCard} ${
                        draft.ancestryId === ancestry.id ? styles.optionCardSelected : ''
                      }`}
                      onClick={() => chooseAncestry(ancestry.id)}
                    >
                      <OptionMark label={ancestry.name} />
                      <span className={styles.optionCopy}>
                        <strong>{ancestry.name}</strong>
                        <small>{ancestry.tagline}</small>
                      </span>
                      <span className={styles.optionMeta}>
                        {ancestry.hp} ОЗ · {ancestry.speed} фт
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.twoColumnBlock}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Наследие</span>
                  <select
                    value={draft.heritage}
                    disabled={!selectedAncestry}
                    onChange={event => updateDraft('heritage', event.target.value)}
                  >
                    <option value="">Сначала выберите народ</option>
                    {selectedAncestry?.heritages.map(heritage => (
                      <option key={heritage} value={heritage}>{heritage}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.ruleNote}>
                  <span aria-hidden="true">◇</span>
                  <p>
                    Здесь собран стартовый набор вариантов. Редкие народы и универсальные
                    наследия можно будет добавить в справочник позже.
                  </p>
                </div>
              </div>

              <div className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>
                  <span>02</span>
                  <div>
                    <h3>Предыстория</h3>
                    <p>Даёт повышения характеристик, навык и знание.</p>
                  </div>
                </div>
                <div className={styles.backgroundGrid}>
                  {PATHFINDER2_BACKGROUNDS.map(background => (
                    <button
                      type="button"
                      key={background.id}
                      className={`${styles.backgroundCard} ${
                        draft.backgroundId === background.id ? styles.backgroundCardSelected : ''
                      }`}
                      onClick={() => updateDraft('backgroundId', background.id)}
                    >
                      <span className={styles.radioMark} aria-hidden="true" />
                      <span>
                        <strong>{background.name}</strong>
                        <small>{background.detail}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === 'class' ? (
            <div className={styles.formStack}>
              <div className={styles.classGrid}>
                {PATHFINDER2_CLASSES.map(characterClass => (
                  <button
                    type="button"
                    key={characterClass.id}
                    className={`${styles.classCard} ${
                      draft.classId === characterClass.id ? styles.classCardSelected : ''
                    }`}
                    onClick={() => chooseClass(characterClass.id)}
                  >
                    <span className={styles.classAccent}>{characterClass.accent}</span>
                    <strong>{characterClass.name}</strong>
                    <p>{characterClass.role}</p>
                    <span className={styles.classMeta}>
                      {characterClass.hp} ОЗ / уровень
                    </span>
                  </button>
                ))}
              </div>

              {selectedClass ? (
                <div className={styles.classDetails}>
                  <div className={styles.sectionTitle}>
                    <span>КЛ</span>
                    <div>
                      <h3>Основа класса</h3>
                      <p>Зафиксируйте ключевой модификатор и первые особенности.</p>
                    </div>
                  </div>

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Ключевая характеристика</span>
                      <select
                        value={draft.keyAbility}
                        onChange={event => updateDraft(
                          'keyAbility',
                          event.target.value as Pathfinder2AttributeKey,
                        )}
                      >
                        {selectedClass.keyAbilities.map(ability => (
                          <option key={ability} value={ability}>
                            {ATTRIBUTE_NAME_BY_KEY[ability]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        Специализация
                        <small>доктрина, муза, школа, стиль</small>
                      </span>
                      <input
                        value={draft.specialization}
                        onChange={event => updateDraft('specialization', event.target.value)}
                        placeholder="Название пути"
                      />
                    </label>

                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      <span className={styles.fieldLabel}>Классовая способность 1-го уровня</span>
                      <input
                        value={draft.classFeat}
                        onChange={event => updateDraft('classFeat', event.target.value)}
                        placeholder="Название и короткая пометка об эффекте"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span aria-hidden="true">⌁</span>
                  <strong>Выберите класс</strong>
                  <p>После выбора появятся ключевая характеристика и поля специализации.</p>
                </div>
              )}
            </div>
          ) : null}

          {activeStep === 'attributes' ? (
            <div className={styles.formStack}>
              <div className={styles.introCard}>
                <span className={styles.introGlyph} aria-hidden="true">＋</span>
                <div>
                  <strong>Запишите итоговые модификаторы</strong>
                  <p>
                    Этот первый прототип не распределяет повышения автоматически: внесите
                    результат после выбора народа, предыстории, класса и свободных повышений.
                  </p>
                </div>
              </div>

              <div className={styles.attributeGrid}>
                {PATHFINDER2_ATTRIBUTES.map(attribute => {
                  const value = draft.attributes[attribute.key]
                  const isKey = keyAbility === attribute.key
                  return (
                    <article
                      className={`${styles.attributeCard} ${
                        isKey ? styles.attributeCardKey : ''
                      }`}
                      key={attribute.key}
                    >
                      <div className={styles.attributeCardTop}>
                        <span className={styles.attributeShort}>{attribute.shortLabel}</span>
                        {isKey ? <span className={styles.keyBadge}>Ключевая</span> : null}
                      </div>
                      <strong>{attribute.label}</strong>
                      <small>{attribute.description}</small>
                      <div className={styles.attributeControl}>
                        <button
                          type="button"
                          aria-label={`Уменьшить ${attribute.label}`}
                          onClick={() => updateAttribute(attribute.key, value - 1)}
                        >
                          −
                        </button>
                        <span>{signedModifier(value)}</span>
                        <button
                          type="button"
                          aria-label={`Увеличить ${attribute.label}`}
                          onClick={() => updateAttribute(attribute.key, value + 1)}
                        >
                          +
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className={styles.attributeLegend}>
                <span><i className={styles.dotLow} /> минимум −1</span>
                <span><i className={styles.dotBase} /> обычный +0</span>
                <span><i className={styles.dotHigh} /> стартовый максимум +4</span>
              </div>
            </div>
          ) : null}

          {activeStep === 'skills' ? (
            <div className={styles.formStack}>
              <div className={styles.skillsHeading}>
                <div>
                  <h3>Обученные навыки</h3>
                  <p>Отметьте навыки, полученные от класса, предыстории и Интеллекта.</p>
                </div>
                <span className={styles.skillsCount}>
                  {draft.trainedSkills.length}
                  <small>выбрано</small>
                </span>
              </div>

              <div className={styles.skillsGrid}>
                {PATHFINDER2_SKILLS.map(skill => {
                  const checked = draft.trainedSkills.includes(skill)
                  return (
                    <button
                      type="button"
                      key={skill}
                      className={`${styles.skillButton} ${
                        checked ? styles.skillButtonSelected : ''
                      }`}
                      aria-pressed={checked}
                      onClick={() => toggleSkill(skill)}
                    >
                      <span className={styles.checkMark}>{checked ? '✓' : ''}</span>
                      <strong>{skill}</strong>
                      <small>{checked ? `+${proficiency + (
                        skill === 'Атлетика'
                          ? draft.attributes.strength
                          : skill === 'Акробатика' || skill === 'Воровство' || skill === 'Скрытность'
                            ? draft.attributes.dexterity
                            : skill === 'Аркана' || skill === 'Общество' || skill === 'Ремесло'
                              ? draft.attributes.intelligence
                              : skill === 'Дипломатия' || skill === 'Запугивание' || skill === 'Обман' || skill === 'Исполнительство'
                                ? draft.attributes.charisma
                                : draft.attributes.wisdom
                      )}` : 'не обучен'}</small>
                    </button>
                  )
                })}
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Знания
                  <small>темы через запятую</small>
                </span>
                <input
                  value={draft.lore}
                  onChange={event => updateDraft('lore', event.target.value)}
                  placeholder="Знания мореходства, Знания нежити"
                />
              </label>
            </div>
          ) : null}

          {activeStep === 'equipment' ? (
            <div className={styles.formStack}>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Дополнительные языки</span>
                  <input
                    value={draft.languages}
                    onChange={event => updateDraft('languages', event.target.value)}
                    placeholder="Эльфийский, Дварфийский"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Общая способность</span>
                  <input
                    value={draft.generalFeat}
                    onChange={event => updateDraft('generalFeat', event.target.value)}
                    placeholder="Название способности"
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.fieldLabel}>
                    Снаряжение
                    <small>оружие, защита, наборы и монеты</small>
                  </span>
                  <textarea
                    value={draft.equipment}
                    onChange={event => updateDraft('equipment', event.target.value)}
                    placeholder={'Длинный меч\nКольчуга\nНабор путешественника\n8 зм'}
                    rows={7}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.fieldLabel}>Заметки перед игрой</span>
                  <textarea
                    value={draft.notes}
                    onChange={event => updateDraft('notes', event.target.value)}
                    placeholder="Заклинания, вопросы ведущему, связи с другими героями…"
                    rows={5}
                  />
                </label>
              </div>

              <div className={styles.finishCard}>
                <span className={styles.finishOrnament} aria-hidden="true">◆</span>
                <div>
                  <span className={styles.panelEyebrow}>Черновик готов к игре</span>
                  <h3>{draft.name.trim() || 'Ваш герой почти обрёл имя'}</h3>
                  <p>
                    Все поля сохраняются только в этом браузере. Следующим этапом можно
                    добавить правила повышения характеристик, способности, заклинания
                    и экспорт полноценного листа.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <section className={styles.rulesShelf} aria-labelledby="pathfinder2-rules-title">
            <div className={styles.rulesShelfHeading}>
              <div>
                <span className={styles.panelEyebrow}>Источник · pf2.ru</span>
                <h2 id="pathfinder2-rules-title">Правила для этого этапа</h2>
              </div>
              <a
                href={getPf2RuSearchUrl(activeStepInfo.label)}
                target="_blank"
                rel="noreferrer"
              >
                Открыть поиск
                <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className={styles.rulesGuideGrid}>
              {activeRuleGuides.map(guide => (
                <article className={styles.ruleGuideCard} key={guide.id}>
                  <span>{guide.category}</span>
                  <h3>{guide.title}</h3>
                  <p>{guide.summary}</p>
                  <a
                    href={getPf2RuSearchUrl(guide.searchTerm)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Читать на pf2.ru
                    <span aria-hidden="true">→</span>
                  </a>
                </article>
              ))}
            </div>
            <p className={styles.rulesAttribution}>
              В приложении хранится только краткая памятка. Полные тексты и актуальные
              варианты открываются на сайте источника.
            </p>
          </section>

          <footer className={styles.editorFooter}>
            <button
              className={styles.previousButton}
              type="button"
              disabled={activeStepIndex === 0}
              onClick={() => goToRelativeStep(-1)}
            >
              <span aria-hidden="true">←</span>
              Назад
            </button>
            <span>{activeStepIndex + 1} / {PATHFINDER2_STEPS.length}</span>
            <button
              className={styles.nextButton}
              type="button"
              disabled={activeStepIndex === PATHFINDER2_STEPS.length - 1}
              onClick={() => goToRelativeStep(1)}
            >
              Продолжить
              <span aria-hidden="true">→</span>
            </button>
          </footer>
        </section>

        <aside className={styles.summaryPanel}>
          <div className={styles.summaryHeader}>
            <span className={styles.panelEyebrow}>Паспорт героя</span>
            <span className={styles.levelPill}>ур. {draft.level}</span>
          </div>

          <div className={styles.portraitPlaceholder} aria-hidden="true">
            <span>{draft.name.trim().slice(0, 1).toUpperCase() || 'P'}</span>
            <i />
          </div>

          <div className={styles.identity}>
            <h2>{draft.name.trim() || 'Безымянный герой'}</h2>
            <p>{draft.concept.trim() || 'Концепция ещё не записана'}</p>
          </div>

          <dl className={styles.summaryFacts}>
            <div>
              <dt>Народ</dt>
              <dd>{selectedAncestry?.name || '—'}</dd>
            </div>
            <div>
              <dt>Наследие</dt>
              <dd>{draft.heritage || '—'}</dd>
            </div>
            <div>
              <dt>Предыстория</dt>
              <dd>{selectedBackground?.name || '—'}</dd>
            </div>
            <div>
              <dt>Класс</dt>
              <dd>{selectedClass?.name || '—'}</dd>
            </div>
          </dl>

          <div className={styles.combatStats}>
            <div>
              <span>ОЗ</span>
              <strong>{maxHp ?? '—'}</strong>
              <small>максимум</small>
            </div>
            <div>
              <span>КБ</span>
              <strong>{armorClass}</strong>
              <small>без брони</small>
            </div>
            <div>
              <span>ВОС</span>
              <strong>{signedModifier(perception)}</strong>
              <small>обучен</small>
            </div>
          </div>

          <div className={styles.miniAttributes}>
            {PATHFINDER2_ATTRIBUTES.map(attribute => (
              <div key={attribute.key}>
                <span>{attribute.shortLabel}</span>
                <strong>{signedModifier(draft.attributes[attribute.key])}</strong>
              </div>
            ))}
          </div>

          <div className={styles.summaryRules}>
            <div>
              <span>Скорость</span>
              <strong>{selectedAncestry ? `${selectedAncestry.speed} фт` : '—'}</strong>
            </div>
            <div>
              <span>КС класса</span>
              <strong>{classDc ?? '—'}</strong>
            </div>
            <div>
              <span>Ключ</span>
              <strong>{keyAbility ? ATTRIBUTE_NAME_BY_KEY[keyAbility] : '—'}</strong>
            </div>
          </div>

          <div className={styles.localNotice}>
            <span aria-hidden="true">⌂</span>
            <p>
              <strong>Локальный режим</strong>
              Черновик не отправляется на сервер и доступен только в этом браузере.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
