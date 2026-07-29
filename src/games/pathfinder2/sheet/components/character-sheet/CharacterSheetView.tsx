'use client'

import { useState } from 'react'
import {
  PATHFINDER2_ATTRIBUTES,
  PATHFINDER2_SKILLS,
} from '../../data'
import {
  ATTRIBUTE_LABELS,
  getAncestryById,
  getBackgroundById,
  getClassById,
  getFeatById,
  getHeritageById,
  getSubclassById,
  getVersatileHeritageById,
} from '../../data/selectors'
import {
  getSkillModifier,
  signedModifier,
} from '../../rules/derived-character-values'
import type {
  Pathfinder2CharacterDraft,
  Pathfinder2DerivedValues,
  Pathfinder2RulesCatalog,
  Pathfinder2SheetTab,
} from '../../types'
import type {
  OpenPathfinder2Choice,
  UpdatePathfinder2Character,
  UpdatePathfinder2Field,
} from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

type CharacterSheetViewProps = {
  draft: Pathfinder2CharacterDraft
  catalog: Pathfinder2RulesCatalog
  derived: Pathfinder2DerivedValues
  updateCharacter: UpdatePathfinder2Character
  updateField: UpdatePathfinder2Field
  openChoice: OpenPathfinder2Choice
  onOpenBuilder: () => void
}

const TABS: Array<{ id: Pathfinder2SheetTab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'skills', label: 'Навыки' },
  { id: 'feats', label: 'Способности' },
  { id: 'equipment', label: 'Снаряжение' },
  { id: 'spells', label: 'Заклинания' },
  { id: 'notes', label: 'Заметки' },
]

function FactCard({
  label,
  title,
  copy,
  onDetails,
  onEdit,
}: {
  label: string
  title: string
  copy: string
  onDetails?: (trigger: HTMLElement) => void
  onEdit: (trigger: HTMLElement) => void
}) {
  return (
    <article className={styles.sheetFactCard}>
      <span className={styles.choiceKicker}>{label}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <div className={styles.choiceActions}>
        {onDetails ? (
          <button
            type="button"
            className={styles.textButton}
            onClick={event => onDetails(event.currentTarget)}
          >
            Подробнее
          </button>
        ) : null}
        <button
          type="button"
          className={styles.textButton}
          onClick={event => onEdit(event.currentTarget)}
        >
          Изменить
        </button>
      </div>
    </article>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={event => onChange(Math.max(0, Number(event.target.value) || 0))}
      />
    </label>
  )
}

export default function CharacterSheetView({
  draft,
  catalog,
  derived,
  updateCharacter,
  updateField,
  openChoice,
  onOpenBuilder,
}: CharacterSheetViewProps) {
  const [activeTab, setActiveTab] = useState<Pathfinder2SheetTab>('overview')
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const heritage = getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  const versatileHeritage = getVersatileHeritageById(catalog, draft.versatileHeritageId)
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const subclass = getSubclassById(catalog, draft.classId, draft.subclassId)
  const feats = [
    ...draft.generalFeatIds,
    ...draft.skillFeatIds,
    ...draft.classFeatIds,
    ...draft.ancestryFeatIds,
  ].map(id => getFeatById(catalog, id)).filter(Boolean)

  const toggleSkill = (skill: string) => {
    updateCharacter(current => ({
      ...current,
      trainedSkills: current.trainedSkills.includes(skill)
        ? current.trainedSkills.filter(value => value !== skill)
        : [...current.trainedSkills, skill],
    }), { immediate: true })
  }

  return (
    <main className={styles.characterSheet}>
      <section className={styles.sheetHero}>
        <div className={styles.sheetPortrait} aria-hidden="true">
          {draft.name.trim().slice(0, 1).toUpperCase() || '✦'}
        </div>
        <div className={styles.sheetIdentity}>
          <span className={styles.panelEyebrow}>Лист персонажа · уровень {draft.level}</span>
          <h1>{draft.name || 'Безымянный герой'}</h1>
          <p>{draft.concept || 'Добавьте концепцию героя в режиме создания.'}</p>
          <div className={styles.choiceTags}>
            <span>{ancestry?.name || 'Народ не выбран'}</span>
            <span>{characterClass?.name || 'Класс не выбран'}</span>
            {background ? <span>{background.name}</span> : null}
          </div>
        </div>
        <div className={styles.sheetHeroActions}>
          <button type="button" className={styles.previousButton} onClick={onOpenBuilder}>
            Открыть создание
          </button>
          <label className={styles.compactLevel}>
            <span>Уровень</span>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.level}
              onChange={event => updateField(
                'level',
                Math.min(20, Math.max(1, Number(event.target.value) || 1)),
                { immediate: true },
              )}
            />
          </label>
        </div>
      </section>

      <section className={styles.sheetVitals} aria-label="Главные показатели">
        <div className={styles.hpBlock}>
          <strong>Очки здоровья</strong>
          <div>
            <NumberField
              label="Текущие"
              value={draft.currentHp}
              onChange={value => updateField('currentHp', value)}
            />
            <span className={styles.hpMax}><small>Максимум</small><b>{derived.maxHp ?? '—'}</b></span>
            <NumberField
              label="Временные"
              value={draft.tempHp}
              onChange={value => updateField('tempHp', value)}
            />
          </div>
        </div>
        <div><span>КБ</span><strong>{derived.armorClass}</strong><small>класс брони</small></div>
        <div><span>Скорость</span><strong>{derived.speed ?? '—'}</strong><small>футов</small></div>
        <div><span>Восприятие</span><strong>{signedModifier(derived.perception)}</strong><small>модификатор</small></div>
        <div><span>КС класса</span><strong>{derived.classDc ?? '—'}</strong><small>сложность</small></div>
      </section>

      <nav className={styles.sheetTabs} aria-label="Разделы листа">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? styles.sheetTabActive : undefined}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className={styles.sheetPaper}>
        {activeTab === 'overview' ? (
          <div className={styles.sheetOverview}>
            <div className={styles.sheetFactGrid}>
              <FactCard
                label="Народ"
                title={ancestry?.name || 'Не выбран'}
                copy={ancestry?.tagline || 'Выберите происхождение героя.'}
                onDetails={ancestry ? trigger => openChoice('ancestry', { readOnly: true }, trigger) : undefined}
                onEdit={trigger => openChoice('ancestry', {}, trigger)}
              />
              <FactCard
                label="Наследие"
                title={heritage?.name || 'Не выбрано'}
                copy={heritage?.description || 'Выберите наследие после народа.'}
                onDetails={heritage ? trigger => openChoice('heritage', { readOnly: true }, trigger) : undefined}
                onEdit={trigger => openChoice('heritage', {}, trigger)}
              />
              <FactCard
                label="Предыстория"
                title={background?.name || 'Не выбрана'}
                copy={background?.description || 'Добавьте прошлое героя.'}
                onDetails={background ? trigger => openChoice('background', { readOnly: true }, trigger) : undefined}
                onEdit={trigger => openChoice('background', {}, trigger)}
              />
              <FactCard
                label="Класс"
                title={characterClass?.name || 'Не выбран'}
                copy={characterClass?.role || 'Выберите роль героя в группе.'}
                onDetails={characterClass ? trigger => openChoice('class', { readOnly: true }, trigger) : undefined}
                onEdit={trigger => openChoice('class', {}, trigger)}
              />
            </div>
            {versatileHeritage ? (
              <div className={styles.sheetInlineNotice}>
                <div>
                  <span className={styles.choiceKicker}>Универсальное наследие</span>
                  <strong>{versatileHeritage.name}</strong>
                  <p>{versatileHeritage.description}</p>
                </div>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={event => openChoice('versatileHeritage', { readOnly: true }, event.currentTarget)}
                >
                  Подробнее
                </button>
              </div>
            ) : null}
            <div className={styles.sheetSplit}>
              <section>
                <span className={styles.choiceKicker}>Характеристики</span>
                <div className={styles.sheetAttributes}>
                  {PATHFINDER2_ATTRIBUTES.map(attribute => (
                    <div key={attribute.key}>
                      <span>{attribute.shortLabel}</span>
                      <strong>{signedModifier(draft.attributes[attribute.key])}</strong>
                      <small>{attribute.label}</small>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <span className={styles.choiceKicker}>Спасброски</span>
                <dl className={styles.saveGrid}>
                  <div><dt>Стойкость</dt><dd>{signedModifier(derived.fortitude)}</dd></div>
                  <div><dt>Рефлекс</dt><dd>{signedModifier(derived.reflex)}</dd></div>
                  <div><dt>Воля</dt><dd>{signedModifier(derived.will)}</dd></div>
                </dl>
                {subclass ? <p className={styles.sheetCaption}>Путь класса: <strong>{subclass.name}</strong></p> : null}
              </section>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Игрок</span>
                <input value={draft.player} onChange={event => updateField('player', event.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Местоимения</span>
                <input value={draft.pronouns} onChange={event => updateField('pronouns', event.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.fieldLabel}>Портрет · URL или локальная ссылка</span>
                <input
                  value={draft.portrait}
                  placeholder="/images/portrait.webp"
                  onChange={event => updateField('portrait', event.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === 'skills' ? (
          <div className={styles.sheetSkills}>
            <header className={styles.sheetSectionHeading}>
              <div><span className={styles.choiceKicker}>Навыки</span><h2>Проверки и обучение</h2></div>
              <span>{draft.trainedSkills.length} обучено</span>
            </header>
            <div className={styles.skillTable}>
              {PATHFINDER2_SKILLS.map(skill => {
                const trained = draft.trainedSkills.includes(skill)
                return (
                  <button key={skill} type="button" aria-pressed={trained} onClick={() => toggleSkill(skill)}>
                    <span className={styles.checkMark}>{trained ? '✓' : ''}</span>
                    <strong>{skill}</strong>
                    <small>{ATTRIBUTE_LABELS[
                      ['Атлетика'].includes(skill)
                        ? 'strength'
                        : ['Акробатика', 'Воровство', 'Скрытность'].includes(skill)
                          ? 'dexterity'
                          : ['Аркана', 'Общество', 'Ремесло'].includes(skill)
                            ? 'intelligence'
                            : ['Дипломатия', 'Запугивание', 'Обман', 'Исполнительство'].includes(skill)
                              ? 'charisma'
                              : 'wisdom'
                    ]}</small>
                    <b>{signedModifier(getSkillModifier(draft, skill))}</b>
                  </button>
                )
              })}
            </div>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Знания (Lore)</span>
              <input value={draft.lore} onChange={event => updateField('lore', event.target.value)} />
            </label>
          </div>
        ) : null}

        {activeTab === 'feats' ? (
          <div className={styles.sheetListPage}>
            <header className={styles.sheetSectionHeading}>
              <div><span className={styles.choiceKicker}>Способности</span><h2>Таланты героя</h2></div>
              <div className={styles.choiceActions}>
                <button type="button" className={styles.previousButton} onClick={event => openChoice('generalFeat', {}, event.currentTarget)}>Добавить общую</button>
                <button type="button" className={styles.nextButton} onClick={event => openChoice('skillFeat', {}, event.currentTarget)}>Добавить навыка</button>
              </div>
            </header>
            {feats.length ? (
              <div className={styles.sheetRuleCards}>
                {feats.map(feat => feat ? (
                  <article key={feat.id}>
                    <span>{feat.level} уровень</span>
                    <h3>{feat.name}</h3>
                    <p>{feat.description}</p>
                  </article>
                ) : null)}
              </div>
            ) : (
              <div className={styles.emptyState}><span>✦</span><strong>Способности ещё не выбраны</strong><p>Добавьте общую способность или способность навыка.</p></div>
            )}
          </div>
        ) : null}

        {activeTab === 'equipment' ? (
          <div className={styles.sheetListPage}>
            <header className={styles.sheetSectionHeading}>
              <div><span className={styles.choiceKicker}>Инвентарь</span><h2>Снаряжение и языки</h2></div>
            </header>
            <div className={styles.fieldGrid}>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.fieldLabel}>Языки</span>
                <textarea rows={3} value={draft.languages} onChange={event => updateField('languages', event.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.fieldLabel}>Снаряжение</span>
                <textarea rows={12} value={draft.equipment} onChange={event => updateField('equipment', event.target.value)} />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === 'spells' ? (
          <div className={styles.sheetListPage}>
            <header className={styles.sheetSectionHeading}>
              <div><span className={styles.choiceKicker}>Заклинания</span><h2>Магическая подготовка</h2></div>
            </header>
            <div className={styles.emptyState}>
              <span>✧</span>
              <strong>{characterClass?.spellTradition ? `Традиция: ${characterClass.spellTradition}` : 'Нет выбранной традиции'}</strong>
              <p>Полная автоматизация заклинаний не входит в эту итерацию. Раздел сохранён как рабочая часть листа.</p>
            </div>
          </div>
        ) : null}

        {activeTab === 'notes' ? (
          <div className={styles.sheetListPage}>
            <header className={styles.sheetSectionHeading}>
              <div><span className={styles.choiceKicker}>Заметки</span><h2>История и напоминания</h2></div>
            </header>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Свободные заметки</span>
              <textarea rows={18} value={draft.notes} onChange={event => updateField('notes', event.target.value)} />
            </label>
          </div>
        ) : null}
      </section>
    </main>
  )
}
