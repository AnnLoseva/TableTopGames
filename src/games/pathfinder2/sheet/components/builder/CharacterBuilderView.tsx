'use client'

import { useMemo, useState } from 'react'
import {
  PATHFINDER2_ATTRIBUTES,
  PATHFINDER2_SKILLS,
  PATHFINDER2_STEPS,
} from '../../data'
import {
  displayAttribute,
  getAncestryById,
  getBackgroundById,
  getClassById,
  getFeatById,
  getHeritageById,
  getSubclassById,
  getVersatileHeritageById,
} from '../../data/selectors'
import {
  getBuilderCompletion,
  getBuilderStepState,
} from '../../rules/builder-progress'
import { signedModifier } from '../../rules/derived-character-values'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterDraft,
  Pathfinder2DerivedValues,
  Pathfinder2RulesCatalog,
  Pathfinder2StepId,
} from '../../types'
import type {
  OpenPathfinder2Choice,
  UpdatePathfinder2Character,
  UpdatePathfinder2Field,
} from '../component-types'
import CharacterSummary from '../shared/CharacterSummary'
import styles from '../Pathfinder2SheetPage.module.css'

type CharacterBuilderViewProps = {
  draft: Pathfinder2CharacterDraft
  catalog: Pathfinder2RulesCatalog
  derived: Pathfinder2DerivedValues
  activeStep: Pathfinder2StepId
  onStepChange: (step: Pathfinder2StepId) => void
  updateCharacter: UpdatePathfinder2Character
  updateField: UpdatePathfinder2Field
  openChoice: OpenPathfinder2Choice
  onFinish: () => void
}

function EmptyChoice({
  title,
  copy,
  action,
  onAction,
}: {
  title: string
  copy: string
  action: string
  onAction: (trigger: HTMLElement) => void
}) {
  return (
    <div className={styles.emptyState}>
      <span aria-hidden="true">✦</span>
      <strong>{title}</strong>
      <p>{copy}</p>
      <button
        type="button"
        className={styles.nextButton}
        onClick={event => onAction(event.currentTarget)}
      >
        {action}
      </button>
    </div>
  )
}

function SelectedChoice({
  eyebrow,
  title,
  description,
  facts,
  action = 'Изменить',
  onAction,
  onDetails,
}: {
  eyebrow: string
  title: string
  description: string
  facts?: string[]
  action?: string
  onAction: (trigger: HTMLElement) => void
  onDetails?: (trigger: HTMLElement) => void
}) {
  return (
    <article className={styles.selectedChoice}>
      <span className={styles.choiceKicker}>{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {facts?.length ? (
        <div className={styles.choiceTags}>
          {facts.map(value => <span key={value}>{value}</span>)}
        </div>
      ) : null}
      <div className={styles.choiceActions}>
        {onDetails ? (
          <button
            type="button"
            className={styles.previousButton}
            onClick={event => onDetails(event.currentTarget)}
          >
            Подробнее
          </button>
        ) : null}
        <button
          type="button"
          className={styles.nextButton}
          onClick={event => onAction(event.currentTarget)}
        >
          {action}
        </button>
      </div>
    </article>
  )
}

function EditorHeading({
  index,
  title,
  description,
}: {
  index: number
  title: string
  description: string
}) {
  return (
    <header className={styles.editorHeading}>
      <div>
        <span className={styles.breadcrumb}>Создание персонажа · шаг {index + 1}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <span className={styles.chapterNumber} aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
    </header>
  )
}

export default function CharacterBuilderView({
  draft,
  catalog,
  derived,
  activeStep,
  onStepChange,
  updateCharacter,
  updateField,
  openChoice,
  onFinish,
}: CharacterBuilderViewProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const stepIndex = PATHFINDER2_STEPS.findIndex(step => step.id === activeStep)
  const step = PATHFINDER2_STEPS[stepIndex]
  const completion = getBuilderCompletion(draft)
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const heritage = getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  const versatileHeritage = getVersatileHeritageById(catalog, draft.versatileHeritageId)
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const subclass = getSubclassById(catalog, draft.classId, draft.subclassId)
  const selectedGeneralFeats = draft.generalFeatIds
    .map(id => getFeatById(catalog, id))
    .filter(Boolean)
  const selectedSkillFeats = draft.skillFeatIds
    .map(id => getFeatById(catalog, id))
    .filter(Boolean)

  const attributesTotal = useMemo(
    () => Object.values(draft.attributes).reduce((sum, value) => sum + value, 0),
    [draft.attributes],
  )

  const adjustAttribute = (key: Pathfinder2AttributeKey, delta: number) => {
    updateCharacter(current => ({
      ...current,
      attributes: {
        ...current.attributes,
        [key]: Math.min(6, Math.max(-2, current.attributes[key] + delta)),
      },
    }), { immediate: true })
  }

  const toggleSkill = (skill: string) => {
    updateCharacter(current => ({
      ...current,
      trainedSkills: current.trainedSkills.includes(skill)
        ? current.trainedSkills.filter(value => value !== skill)
        : [...current.trainedSkills, skill],
    }), { immediate: true })
  }

  const removeFeat = (field: 'generalFeatIds' | 'skillFeatIds', id: string) => {
    updateCharacter(current => ({
      ...current,
      [field]: current[field].filter(value => value !== id),
    }), { immediate: true })
  }

  const renderStep = () => {
    if (activeStep === 'concept') {
      return (
        <div className={styles.formStack}>
          <div className={styles.introCard}>
            <span className={styles.introGlyph} aria-hidden="true">✦</span>
            <div>
              <strong>Начните с человеческой идеи</strong>
              <p>Механические решения легче принимать, когда у героя уже есть образ.</p>
            </div>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Имя персонажа</span>
              <input
                value={draft.name}
                placeholder="Например, Тарин"
                onChange={event => updateField('name', event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Игрок</span>
              <input
                value={draft.player}
                onChange={event => updateField('player', event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Местоимения</span>
              <input
                value={draft.pronouns}
                onChange={event => updateField('pronouns', event.target.value)}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Концепция</span>
              <textarea
                rows={4}
                value={draft.concept}
                placeholder="Кто этот герой и почему он отправился в путь?"
                onChange={event => updateField('concept', event.target.value)}
              />
            </label>
          </div>
          <div className={styles.levelCard}>
            <div>
              <strong>Уровень героя</strong>
              <p>Интерфейс хранит уровень от 1 до 20 и пересчитывает сводку.</p>
            </div>
            <div className={styles.levelControl}>
              <button
                type="button"
                aria-label="Уменьшить уровень"
                onClick={() => updateField('level', Math.max(1, draft.level - 1), { immediate: true })}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={20}
                aria-label="Уровень"
                value={draft.level}
                onChange={event => updateField(
                  'level',
                  Math.min(20, Math.max(1, Number(event.target.value) || 1)),
                  { immediate: true },
                )}
              />
              <button
                type="button"
                aria-label="Увеличить уровень"
                onClick={() => updateField('level', Math.min(20, draft.level + 1), { immediate: true })}
              >
                +
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (activeStep === 'ancestry') {
      return ancestry ? (
        <SelectedChoice
          eyebrow={`${ancestry.rarity} · ${ancestry.sourceBook}`}
          title={ancestry.name}
          description={ancestry.description}
          facts={[`${ancestry.hp} ОЗ`, `${ancestry.speed} фт.`, ancestry.size]}
          onDetails={trigger => openChoice('ancestry', { readOnly: true }, trigger)}
          onAction={trigger => openChoice('ancestry', {}, trigger)}
        />
      ) : (
        <EmptyChoice
          title="Народ ещё не выбран"
          copy={`В локальном справочнике доступно ${catalog.ancestries.length} народов.`}
          action="Открыть галерею народов"
          onAction={trigger => openChoice('ancestry', {}, trigger)}
        />
      )
    }

    if (activeStep === 'heritage') {
      return (
        <div className={styles.formStack}>
          {!ancestry ? (
            <EmptyChoice
              title="Сначала выберите народ"
              copy="Обычные наследия зависят от народа. Универсальное наследие можно добавить после этого."
              action="Перейти к выбору народа"
              onAction={() => onStepChange('ancestry')}
            />
          ) : heritage ? (
            <SelectedChoice
              eyebrow={`Наследие · ${ancestry.name}`}
              title={heritage.name}
              description={heritage.description}
              onDetails={trigger => openChoice('heritage', { readOnly: true }, trigger)}
              onAction={trigger => openChoice('heritage', {}, trigger)}
            />
          ) : (
            <EmptyChoice
              title={`Наследие для народа «${ancestry.name}»`}
              copy={`Доступно вариантов: ${ancestry.heritages.length}.`}
              action="Выбрать наследие"
              onAction={trigger => openChoice('heritage', {}, trigger)}
            />
          )}

          <section className={styles.optionalChoice}>
            <div>
              <span className={styles.choiceKicker}>Необязательный слой</span>
              <h3>Универсальное наследие</h3>
              <p>Хранится отдельно и не заменяет обычное наследие народа.</p>
            </div>
            {versatileHeritage ? (
              <SelectedChoice
                eyebrow="Универсальное наследие"
                title={versatileHeritage.name}
                description={versatileHeritage.description}
                action="Изменить"
                onDetails={trigger => openChoice('versatileHeritage', { readOnly: true }, trigger)}
                onAction={trigger => openChoice('versatileHeritage', {}, trigger)}
              />
            ) : (
              <button
                type="button"
                className={styles.previousButton}
                onClick={event => openChoice('versatileHeritage', {}, event.currentTarget)}
              >
                Добавить универсальное наследие
              </button>
            )}
            {versatileHeritage ? (
              <button
                type="button"
                className={styles.textButton}
                onClick={() => updateField('versatileHeritageId', '', { immediate: true })}
              >
                Удалить универсальное наследие
              </button>
            ) : null}
          </section>
        </div>
      )
    }

    if (activeStep === 'background') {
      return background ? (
        <SelectedChoice
          eyebrow={`${background.rarity} · ${background.tab}`}
          title={background.name}
          description={background.description}
          facts={[background.trainedSkills, background.trainedLore, background.skillFeat]}
          onDetails={trigger => openChoice('background', { readOnly: true }, trigger)}
          onAction={trigger => openChoice('background', {}, trigger)}
        />
      ) : (
        <EmptyChoice
          title="Предыстория ещё не выбрана"
          copy={`В локальном справочнике доступна ${catalog.backgrounds.length} предыстория.`}
          action="Открыть галерею предысторий"
          onAction={trigger => openChoice('background', {}, trigger)}
        />
      )
    }

    if (activeStep === 'class') {
      return (
        <div className={styles.formStack}>
          {characterClass ? (
            <SelectedChoice
              eyebrow={`${characterClass.rarity} · ${characterClass.sourceBook}`}
              title={characterClass.name}
              description={characterClass.description}
              facts={[`${characterClass.hp} ОЗ / уровень`, characterClass.role]}
              onDetails={trigger => openChoice('class', { readOnly: true }, trigger)}
              onAction={trigger => openChoice('class', {}, trigger)}
            />
          ) : (
            <EmptyChoice
              title="Класс ещё не выбран"
              copy={`В локальном справочнике доступно ${catalog.classes.length} классов.`}
              action="Открыть галерею классов"
              onAction={trigger => openChoice('class', {}, trigger)}
            />
          )}
          {characterClass ? (
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Ключевая характеристика</span>
                <select
                  value={draft.keyAbility}
                  onChange={event => updateField(
                    'keyAbility',
                    event.target.value as Pathfinder2AttributeKey,
                    { immediate: true },
                  )}
                >
                  {characterClass.keyAbilities.map(key => (
                    <option key={key} value={key}>{displayAttribute(key)}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Путь класса</span>
                <select
                  value={draft.subclassId}
                  onChange={event => updateField('subclassId', event.target.value, { immediate: true })}
                  disabled={characterClass.specializations.length === 0}
                >
                  <option value="">
                    {characterClass.specializations.length ? 'Выберите путь' : 'Не требуется'}
                  </option>
                  {characterClass.specializations.map(option => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </label>
              {subclass ? (
                <div className={`${styles.introCard} ${styles.fieldWide}`}>
                  <span className={styles.introGlyph} aria-hidden="true">✦</span>
                  <div><strong>{subclass.name}</strong><p>{subclass.description}</p></div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )
    }

    if (activeStep === 'attributes') {
      return (
        <div className={styles.formStack}>
          <div className={styles.attributeLegend}>
            <span><i /> Сумма модификаторов: {signedModifier(attributesTotal)}</span>
            <span>Рабочий редактор, без автоматизации полного цикла повышений PF2</span>
          </div>
          <div className={styles.attributeGrid}>
            {PATHFINDER2_ATTRIBUTES.map(attribute => (
              <article
                key={attribute.key}
                className={[
                  styles.attributeCard,
                  derived.keyAbility === attribute.key ? styles.attributeCardKey : '',
                ].filter(Boolean).join(' ')}
              >
                <div className={styles.attributeCardTop}>
                  <span className={styles.attributeShort}>{attribute.shortLabel}</span>
                  {derived.keyAbility === attribute.key ? <small>Ключ</small> : null}
                </div>
                <strong>{attribute.label}</strong>
                <small>{attribute.description}</small>
                <div className={styles.attributeControl}>
                  <button type="button" aria-label={`Уменьшить ${attribute.label}`} onClick={() => adjustAttribute(attribute.key, -1)}>−</button>
                  <span>{signedModifier(draft.attributes[attribute.key])}</span>
                  <button type="button" aria-label={`Увеличить ${attribute.label}`} onClick={() => adjustAttribute(attribute.key, 1)}>+</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )
    }

    if (activeStep === 'skills') {
      return (
        <div className={styles.formStack}>
          <div className={styles.skillsHeading}>
            <div><h3>Обученные навыки</h3><p>Нажмите, чтобы изменить состояние.</p></div>
            <span className={styles.skillsCount}><strong>{draft.trainedSkills.length}</strong><small>выбрано</small></span>
          </div>
          <div className={styles.skillsGrid}>
            {PATHFINDER2_SKILLS.map(skill => {
              const selected = draft.trainedSkills.includes(skill)
              return (
                <button
                  key={skill}
                  type="button"
                  className={[
                    styles.skillButton,
                    selected ? styles.skillButtonSelected : '',
                  ].filter(Boolean).join(' ')}
                  aria-pressed={selected}
                  onClick={() => toggleSkill(skill)}
                >
                  <span className={styles.checkMark}>{selected ? '✓' : ''}</span>
                  <span><strong>{skill}</strong><small>{selected ? 'Обучен' : 'Не обучен'}</small></span>
                </button>
              )
            })}
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Знания (Lore)</span>
            <input
              value={draft.lore}
              placeholder="Например, Знания моря"
              onChange={event => updateField('lore', event.target.value)}
            />
          </label>
        </div>
      )
    }

    if (activeStep === 'feats') {
      return (
        <div className={styles.formStack}>
          <section className={styles.featPicker}>
            <div>
              <span className={styles.choiceKicker}>Общие и мифические способности</span>
              <h3>{catalog.generalFeats.length + catalog.mythicFeats.length} вариантов</h3>
              <p>Выбор добавляется к уже отмеченным способностям.</p>
            </div>
            <button type="button" className={styles.nextButton} onClick={event => openChoice('generalFeat', {}, event.currentTarget)}>
              Открыть галерею
            </button>
            <div className={styles.selectedChips}>
              {selectedGeneralFeats.map(feat => feat ? (
                <button key={feat.id} type="button" onClick={() => removeFeat('generalFeatIds', feat.id)}>
                  {feat.name}<span aria-label="Удалить">×</span>
                </button>
              ) : null)}
            </div>
          </section>
          <section className={styles.featPicker}>
            <div>
              <span className={styles.choiceKicker}>Способности навыков</span>
              <h3>{catalog.skillFeats.length} вариантов</h3>
              <p>Фильтруйте каталог по навыку и уровню.</p>
            </div>
            <button type="button" className={styles.nextButton} onClick={event => openChoice('skillFeat', {}, event.currentTarget)}>
              Открыть галерею
            </button>
            <div className={styles.selectedChips}>
              {selectedSkillFeats.map(feat => feat ? (
                <button key={feat.id} type="button" onClick={() => removeFeat('skillFeatIds', feat.id)}>
                  {feat.name}<span aria-label="Удалить">×</span>
                </button>
              ) : null)}
            </div>
          </section>
        </div>
      )
    }

    if (activeStep === 'equipment') {
      return (
        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Языки</span>
            <textarea
              rows={3}
              value={draft.languages}
              placeholder="Общий, эльфийский…"
              onChange={event => updateField('languages', event.target.value)}
            />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Снаряжение</span>
            <textarea
              rows={9}
              value={draft.equipment}
              placeholder="Оружие, броня, инструменты, монеты и припасы…"
              onChange={event => updateField('equipment', event.target.value)}
            />
          </label>
        </div>
      )
    }

    return (
      <div className={styles.reviewGrid}>
        <section>
          <span className={styles.choiceKicker}>Личность</span>
          <h3>{draft.name || 'Имя не заполнено'}</h3>
          <p>{draft.concept || 'Концепция не заполнена.'}</p>
        </section>
        <section>
          <span className={styles.choiceKicker}>Происхождение</span>
          <h3>{ancestry?.name || 'Народ не выбран'}</h3>
          <p>{heritage?.name || 'Наследие не выбрано'}{versatileHeritage ? ` · ${versatileHeritage.name}` : ''}</p>
        </section>
        <section>
          <span className={styles.choiceKicker}>Путь</span>
          <h3>{characterClass?.name || 'Класс не выбран'}</h3>
          <p>{background?.name || 'Предыстория не выбрана'}{subclass ? ` · ${subclass.name}` : ''}</p>
        </section>
        <section>
          <span className={styles.choiceKicker}>Готовность</span>
          <h3>{completion}%</h3>
          <p>Можно вернуться к любому шагу или открыть рабочий лист.</p>
          <button type="button" className={styles.nextButton} onClick={onFinish}>
            Перейти к листу персонажа
          </button>
        </section>
      </div>
    )
  }

  return (
    <main
      className={[
        styles.builderWorkspace,
        leftCollapsed ? styles.builderLeftCollapsed : '',
        rightCollapsed ? styles.builderRightCollapsed : '',
      ].filter(Boolean).join(' ')}
    >
      <aside className={styles.stepsPanel}>
        <button
          type="button"
          className={styles.panelCollapse}
          aria-expanded={!leftCollapsed}
          aria-label={leftCollapsed ? 'Развернуть шаги' : 'Свернуть шаги'}
          onClick={() => setLeftCollapsed(value => !value)}
        >
          {leftCollapsed ? '›' : '‹'}
        </button>
        <div className={styles.collapsiblePanelContent}>
          <span className={styles.panelEyebrow}>Маршрут героя</span>
          <h2>Создание</h2>
          <p className={styles.panelIntro}>Десять независимых шагов, один общий черновик.</p>
          <nav className={styles.stepsNav} aria-label="Шаги создания персонажа">
            {PATHFINDER2_STEPS.map((item, index) => {
              const state = getBuilderStepState(draft, item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={[
                    styles.stepButton,
                    item.id === activeStep ? styles.stepButtonActive : '',
                  ].filter(Boolean).join(' ')}
                  data-state={state}
                  aria-current={item.id === activeStep ? 'step' : undefined}
                  onClick={() => onStepChange(item.id)}
                >
                  <span className={styles.stepNumber}>
                    {state === 'complete' ? '✓' : index + 1}
                  </span>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                </button>
              )
            })}
          </nav>
          <div className={styles.completionCard}>
            <span className={styles.completionValue}>{completion}%</span>
            <span><strong>Заполнено</strong><small>Прогресс локального черновика</small></span>
          </div>
        </div>
      </aside>

      <section className={styles.editor}>
        <EditorHeading
          index={stepIndex}
          title={step.label}
          description={step.description}
        />
        {renderStep()}
        <footer className={styles.editorFooter}>
          <button
            type="button"
            className={styles.previousButton}
            disabled={stepIndex === 0}
            onClick={() => onStepChange(PATHFINDER2_STEPS[stepIndex - 1].id)}
          >
            ← Назад
          </button>
          <span>Шаг {stepIndex + 1} из {PATHFINDER2_STEPS.length}</span>
          <button
            type="button"
            className={styles.nextButton}
            onClick={() => {
              if (stepIndex === PATHFINDER2_STEPS.length - 1) onFinish()
              else onStepChange(PATHFINDER2_STEPS[stepIndex + 1].id)
            }}
          >
            {stepIndex === PATHFINDER2_STEPS.length - 1 ? 'Открыть лист' : 'Далее →'}
          </button>
        </footer>
      </section>

      <aside className={styles.summaryPanel}>
        <button
          type="button"
          className={styles.panelCollapse}
          aria-expanded={!rightCollapsed}
          aria-label={rightCollapsed ? 'Развернуть сводку' : 'Свернуть сводку'}
          onClick={() => setRightCollapsed(value => !value)}
        >
          {rightCollapsed ? '‹' : '›'}
        </button>
        <div className={styles.collapsiblePanelContent}>
          <CharacterSummary draft={draft} catalog={catalog} derived={derived} />
        </div>
      </aside>
    </main>
  )
}
