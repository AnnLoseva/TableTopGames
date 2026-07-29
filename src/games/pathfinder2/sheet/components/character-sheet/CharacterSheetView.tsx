'use client'

import { useState } from 'react'
import {
  PATHFINDER2_ATTRIBUTES,
  PATHFINDER2_SKILLS,
} from '../../data'
import {
  ATTRIBUTE_LABELS,
  PROFICIENCY_LABELS,
  getAncestryById,
  getBackgroundById,
  getClassById,
  getFeatById,
  getHeritageById,
  getSubclassById,
  getVersatileHeritageById,
} from '../../data/selectors'
import { signedModifier } from '../../rules/derived-character-values'
import type {
  Pathfinder2CharacterBuild,
  Pathfinder2CharacterDraft,
  Pathfinder2CharacterDraftV4,
  Pathfinder2CharacterState,
  Pathfinder2DerivedValues,
  Pathfinder2RulesCatalog,
  Pathfinder2SheetTab,
} from '../../types'
import type {
  OpenPathfinder2Choice,
  UpdatePathfinder2Field,
  UpdatePathfinder2V4,
} from '../component-types'
import LevelUpPanel from './LevelUpPanel'
import styles from '../Pathfinder2SheetPage.module.css'

type CharacterSheetViewProps = {
  draft: Pathfinder2CharacterDraft
  v4Draft: Pathfinder2CharacterDraftV4
  catalog: Pathfinder2RulesCatalog
  build: Pathfinder2CharacterBuild
  state: Pathfinder2CharacterState
  derived: Pathfinder2DerivedValues
  updateField: UpdatePathfinder2Field
  updateV4: UpdatePathfinder2V4
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
  v4Draft,
  catalog,
  build,
  state,
  derived,
  updateField,
  updateV4,
  openChoice,
  onOpenBuilder,
}: CharacterSheetViewProps) {
  const [activeTab, setActiveTab] = useState<Pathfinder2SheetTab>('overview')
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const heritage = getHeritageById(catalog, draft.ancestryId, draft.heritageId)
  const versatileHeritage = getVersatileHeritageById(catalog, draft.versatileHeritageId)
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const subclass = getSubclassById(catalog, draft.classId, draft.subclassId)
  const feats = state.grantedFeatIds.map(id => getFeatById(catalog, id)).filter(Boolean)

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
          <button
            type="button"
            className={styles.nextButton}
            disabled={draft.level >= 20}
            onClick={() => setLevelUpOpen(value => !value)}
          >
            Повысить уровень
          </button>
        </div>
      </section>

      {levelUpOpen ? (
        <LevelUpPanel
          key={draft.level}
          draft={v4Draft}
          catalog={catalog}
          state={state}
          updateV4={updateV4}
          onClose={() => setLevelUpOpen(false)}
        />
      ) : null}

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

      {!build.isReady ? (
        <div className={styles.sheetInlineNotice} role="status">
          <div>
            <span className={styles.choiceKicker}>Лист ещё не готов</span>
            <strong>Есть незавершённые или конфликтующие решения</strong>
            <p>Откройте режим создания: ручное изменение итоговых характеристик и рангов отключено.</p>
          </div>
          <button type="button" className={styles.textButton} onClick={onOpenBuilder}>
            Проверить билд
          </button>
        </div>
      ) : null}

      <nav className={styles.sheetTabs} aria-label="Разделы листа">
        {TABS.filter(tab => tab.id !== 'spells' || state.spellcasting.expected).map(tab => (
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
                title={heritage?.name || versatileHeritage?.name || 'Не выбрано'}
                copy={heritage?.description || versatileHeritage?.description || 'Выберите одно наследие после народа.'}
                onDetails={heritage
                  ? trigger => openChoice('heritage', { readOnly: true }, trigger)
                  : versatileHeritage
                    ? trigger => openChoice('versatileHeritage', { readOnly: true }, trigger)
                    : undefined}
                onEdit={trigger => openChoice(
                  versatileHeritage ? 'versatileHeritage' : 'heritage',
                  {},
                  trigger,
                )}
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
            <div className={styles.sheetSplit}>
              <section>
                <span className={styles.choiceKicker}>Характеристики</span>
                <div className={styles.sheetAttributes}>
                  {PATHFINDER2_ATTRIBUTES.map(attribute => (
                    <div key={attribute.key}>
                      <span>{attribute.shortLabel}</span>
                      <strong>{signedModifier(build.attributes.modifiers[attribute.key])}</strong>
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
              <span>{build.skills.trainedCount} обучено</span>
            </header>
            <div className={styles.skillTable}>
              {PATHFINDER2_SKILLS.map(skill => {
                const calculated = build.skills.skills[skill.id]
                const trained = calculated.rank !== 'untrained'
                return (
                  <div key={skill.id} className={styles.skillReadOnly} data-trained={trained}>
                    <span className={styles.checkMark}>{trained ? '✓' : ''}</span>
                    <strong>{skill.label}</strong>
                    <div className={styles.skillReadOnlyFormula}>
                      <small>
                        {ATTRIBUTE_LABELS[calculated.attribute]} {signedModifier(calculated.attributeModifier)}
                      </small>
                      <small>
                        {PROFICIENCY_LABELS[calculated.rank]} {signedModifier(calculated.proficiencyBonus)}
                      </small>
                    </div>
                    <b>= {signedModifier(calculated.modifier)}</b>
                  </div>
                )
              })}
            </div>
            <div className={styles.selectedChips}>
              {state.loreEntries.map(lore => (
                <span key={lore.id}>{lore.name} · {lore.rank}</span>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'feats' ? (
          <div className={styles.sheetListPage}>
            <header className={styles.sheetSectionHeading}>
              <div><span className={styles.choiceKicker}>Способности</span><h2>Таланты героя</h2></div>
              <span>Только granted/slot selections</span>
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
              <div className={styles.emptyState}><span>✦</span><strong>Нет проверенных черт</strong><p>Черты появляются только из структурированных слотов и автоматических grants.</p></div>
            )}
          </div>
        ) : null}

        {activeTab === 'equipment' ? (
          <div className={styles.sheetListPage}>
            <header className={styles.sheetSectionHeading}>
              <div><span className={styles.choiceKicker}>Инвентарь</span><h2>Снаряжение и Bulk</h2></div>
              <span>Bulk {state.inventory.bulk} / {state.inventory.safeBulk}</span>
            </header>
            <div className={styles.sheetRuleCards}>
              {state.inventory.entries.map(entry => (
                <article key={entry.id}>
                  <span>{entry.quantity} шт.</span>
                  <h3>{entry.customName || entry.item?.name || entry.itemId}</h3>
                  <p>{entry.equipped ? 'Экипировано' : 'В инвентаре'} · Bulk {entry.bulk}</p>
                </article>
              ))}
            </div>
            {!state.inventory.entries.length ? (
              <div className={styles.emptyState}>
                <span>⌁</span>
                <strong>Нет структурированных покупок</strong>
                <p>Описательные legacy notes не влияют на деньги, КБ и вес.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'spells' ? (
          <div className={styles.sheetListPage}>
            <header className={styles.sheetSectionHeading}>
              <div><span className={styles.choiceKicker}>Заклинания</span><h2>Магическая подготовка</h2></div>
            </header>
            {state.spellcasting.entries.map(calculated => (
              <article className={styles.selectedChoice} key={calculated.entry.id}>
                <span className={styles.choiceKicker}>
                  {calculated.entry.tradition} · {calculated.entry.mode}
                </span>
                <h3>Атака +{calculated.spellAttack} · СЛ {calculated.spellDc}</h3>
                <p>{calculated.selectedSpellIds.length} выбранных заклинаний</p>
              </article>
            ))}
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
