'use client'

import { useState } from 'react'
import {
  PATHFINDER2_STEPS,
} from '../../data'
import {
  displayAttribute,
  getAncestryById,
  getBackgroundById,
  getClassById,
  getHeritageById,
  getSubclassById,
  getVersatileHeritageById,
} from '../../data/selectors'
import {
  getBuilderCompletion,
  getBuilderStepState,
} from '../../rules/builder-progress'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2CharacterBuild,
  Pathfinder2CharacterDraft,
  Pathfinder2CharacterDraftV4,
  Pathfinder2CharacterState,
  Pathfinder2DerivedValues,
  Pathfinder2RulesCatalog,
  Pathfinder2StepId,
} from '../../types'
import type {
  OpenPathfinder2Choice,
  UpdatePathfinder2Character,
  UpdatePathfinder2Field,
  UpdatePathfinder2V4,
} from '../component-types'
import CharacterSummary from '../shared/CharacterSummary'
import AttributeRulesEditor from './AttributeRulesEditor'
import CalculationsStep from './CalculationsStep'
import DetailsStep from './DetailsStep'
import EquipmentStep from './EquipmentStep'
import FeaturesStep from './FeaturesStep'
import InitialAttributesStep from './InitialAttributesStep'
import ReviewAudit from './ReviewAudit'
import styles from '../Pathfinder2SheetPage.module.css'

type CharacterBuilderViewProps = {
  draft: Pathfinder2CharacterDraft
  v4Draft: Pathfinder2CharacterDraftV4
  catalog: Pathfinder2RulesCatalog
  build: Pathfinder2CharacterBuild
  state: Pathfinder2CharacterState
  derived: Pathfinder2DerivedValues
  activeStep: Pathfinder2StepId
  onStepChange: (step: Pathfinder2StepId) => void
  updateCharacter: UpdatePathfinder2Character
  updateV4: UpdatePathfinder2V4
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
  v4Draft,
  catalog,
  build,
  state,
  derived,
  activeStep,
  onStepChange,
  updateCharacter,
  updateV4,
  updateField,
  openChoice,
  onFinish,
}: CharacterBuilderViewProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [heritageCategory, setHeritageCategory] = useState<'ancestry' | 'versatile'>(
    draft.versatileHeritageId ? 'versatile' : 'ancestry',
  )
  const stepIndex = PATHFINDER2_STEPS.findIndex(step => step.id === activeStep)
  const step = PATHFINDER2_STEPS[stepIndex]
  const completion = getBuilderCompletion(draft, build.validationIssues)
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const heritage = getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  const versatileHeritage = getVersatileHeritageById(catalog, draft.versatileHeritageId)
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const subclass = getSubclassById(catalog, draft.classId, draft.subclassId)
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
              <strong>Сценарий создания</strong>
              <p>Высокоуровневый герой всё равно проходит решения каждого уровня последовательно.</p>
            </div>
            <div className={styles.modeSwitch} aria-label="Сценарий создания">
              <button
                type="button"
                aria-pressed={v4Draft.progression.creationMode === 'level-1'}
                onClick={() => updateV4(current => ({
                  ...current,
                  progression: {
                    ...current.progression,
                    level: 1,
                    targetLevel: 1,
                    creationMode: 'level-1',
                  },
                }), { immediate: true })}
              >
                1-й уровень
              </button>
              <button
                type="button"
                aria-pressed={v4Draft.progression.creationMode === 'high-level'}
                onClick={() => updateV4(current => ({
                  ...current,
                  progression: {
                    ...current.progression,
                    level: 1,
                    targetLevel: Math.max(2, current.progression.targetLevel),
                    creationMode: 'high-level',
                  },
                }), { immediate: true })}
              >
                Высокий уровень
              </button>
            </div>
          </div>
          {v4Draft.progression.creationMode === 'high-level' ? (
            <p className={styles.ruleChangeNotice}>
              Цель:{' '}
              <select
                aria-label="Целевой уровень"
                value={v4Draft.progression.targetLevel}
                onChange={event => updateV4(current => ({
                  ...current,
                  progression: {
                    ...current.progression,
                    targetLevel: Number(event.target.value),
                  },
                }), { immediate: true })}
              >
                {Array.from({ length: 19 }, (_, index) => index + 2).map(level => (
                  <option key={level} value={level}>{level}-й уровень</option>
                ))}
              </select>
              {' '}Текущий уровень повышается только после завершения очередного level-up шага.
            </p>
          ) : null}
        </div>
      )
    }

    if (activeStep === 'initial-attributes') {
      return (
        <InitialAttributesStep
          draft={draft}
          v4Draft={v4Draft}
          catalog={catalog}
          updateV4={updateV4}
        />
      )
    }

    if (activeStep === 'ancestry') {
      return (
        <div className={styles.formStack}>
          {ancestry ? (
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
          )}
          <div className={styles.modeSwitch} aria-label="Категория наследия">
            <button
              type="button"
              aria-pressed={heritageCategory === 'ancestry'}
              onClick={() => setHeritageCategory('ancestry')}
            >
              Наследия народа
            </button>
            <button
              type="button"
              aria-pressed={heritageCategory === 'versatile'}
              onClick={() => setHeritageCategory('versatile')}
            >
              Универсальные наследия
            </button>
          </div>
          {!ancestry ? (
            <EmptyChoice
              title="Сначала выберите народ"
              copy="Сначала нужен народ, затем выберите ровно одно обычное или универсальное наследие."
              action="Выбрать народ"
              onAction={trigger => openChoice('ancestry', {}, trigger)}
            />
          ) : heritageCategory === 'ancestry' && heritage ? (
            <SelectedChoice
              eyebrow={`Наследие · ${ancestry.name}`}
              title={heritage.name}
              description={heritage.description}
              onDetails={trigger => openChoice('heritage', { readOnly: true }, trigger)}
              onAction={trigger => openChoice('heritage', {}, trigger)}
            />
          ) : heritageCategory === 'ancestry' ? (
            <EmptyChoice
              title={`Наследие для народа «${ancestry.name}»`}
              copy={`Доступно вариантов: ${ancestry.heritages.length}. Выбор заменит универсальное наследие.`}
              action="Выбрать наследие"
              onAction={trigger => openChoice('heritage', {}, trigger)}
            />
          ) : versatileHeritage ? (
            <SelectedChoice
              eyebrow="Универсальное наследие · заменяет обычное"
              title={versatileHeritage.name}
              description={versatileHeritage.description}
              onDetails={trigger => openChoice('versatileHeritage', { readOnly: true }, trigger)}
              onAction={trigger => openChoice('versatileHeritage', {}, trigger)}
            />
          ) : (
            <EmptyChoice
              title="Универсальное наследие"
              copy={`Доступно вариантов: ${catalog.versatileHeritages.length}. Выбор очистит обычное наследие народа.`}
              action="Выбрать универсальное наследие"
              onAction={trigger => openChoice('versatileHeritage', {}, trigger)}
            />
          )}
          <p className={styles.ruleChangeNotice}>
            Активно только одно наследие: обычное или универсальное. Повышения
            народа и добровольные понижения настраиваются на этапе итоговых
            характеристик и сохраняются отдельными решениями.
          </p>
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
                  value={draft.attributeChoices.classKeyBoost ?? ''}
                  onChange={event => updateCharacter(current => ({
                    ...current,
                    attributeChoices: {
                      ...current.attributeChoices,
                      classKeyBoost: (event.target.value || null) as Pathfinder2AttributeKey | null,
                    },
                  }), { immediate: true })}
                >
                  {characterClass.keyAbilities.length > 1 ? (
                    <option value="">Выберите ключевую характеристику</option>
                  ) : null}
                  {characterClass.keyAbilities.map(key => (
                    <option key={key} value={key}>{displayAttribute(key)}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  {characterClass.choiceDefinitions[0]?.label ?? 'Классовая специализация'}
                </span>
                <select
                  value={draft.subclassId}
                  onChange={event => updateField('subclassId', event.target.value, { immediate: true })}
                  disabled={characterClass.specializations.length === 0}
                >
                  <option value="">
                    {characterClass.specializations.length ? 'Сделайте обязательный выбор' : 'Не требуется'}
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

    if (activeStep === 'final-attributes') {
      return (
        <AttributeRulesEditor
          draft={draft}
          catalog={catalog}
          build={build}
          updateCharacter={updateCharacter}
        />
      )
    }

    if (activeStep === 'features') {
      return (
        <FeaturesStep
          draft={draft}
          v4Draft={v4Draft}
          catalog={catalog}
          build={build}
          state={state}
          updateCharacter={updateCharacter}
          updateV4={updateV4}
        />
      )
    }

    if (activeStep === 'equipment') {
      return (
        <EquipmentStep draft={v4Draft} catalog={catalog} updateV4={updateV4} />
      )
    }

    if (activeStep === 'calculations') return <CalculationsStep state={state} />
    if (activeStep === 'details') {
      return (
        <DetailsStep
          draft={v4Draft}
          catalog={catalog}
          state={state}
          updateV4={updateV4}
        />
      )
    }

    return (
      <ReviewAudit
        draft={draft}
        catalog={catalog}
        build={build}
        state={state}
        onFinish={onFinish}
      />
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
          <p className={styles.panelIntro}>Одиннадцать последовательных шагов, один общий черновик.</p>
          <nav className={styles.stepsNav} aria-label="Шаги создания персонажа">
            {PATHFINDER2_STEPS.map((item, index) => {
              const state = getBuilderStepState(draft, item.id, build.validationIssues)
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
            disabled={
              (['final-attributes', 'features'].includes(activeStep)
                && build.validationIssues.some(issue => (
                  issue.step === activeStep && issue.severity === 'error'
                )))
              || (activeStep === 'review' && !build.isReady)
            }
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
          <CharacterSummary
            draft={draft}
            catalog={catalog}
            build={build}
            derived={derived}
          />
        </div>
      </aside>
    </main>
  )
}
