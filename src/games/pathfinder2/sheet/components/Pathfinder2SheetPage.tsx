'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState } from 'react'
import { getBuilderCompletion } from '../rules/builder-progress'
import { buildCharacterState } from '../rules/creation/build-character-state'
import { reconcileCharacterDecisions } from '../rules/creation/reconcile-character'
import { getClassById } from '../data/selectors'
import { usePathfinder2Character } from '../hooks/usePathfinder2Character'
import type {
  Pathfinder2ChoiceKind,
  Pathfinder2Mode,
  Pathfinder2RulesCatalog,
  Pathfinder2StepId,
} from '../types'
import CharacterBuilderView from './builder/CharacterBuilderView'
import CharacterSheetView from './character-sheet/CharacterSheetView'
import Pathfinder2Topbar from './shell/Pathfinder2Topbar'
import styles from './Pathfinder2SheetPage.module.css'

const Pathfinder2ChoiceGallery = dynamic(
  () => import('./choices/Pathfinder2ChoiceGallery'),
  { ssr: false },
)

type DialogState = {
  open: boolean
  kind: Pathfinder2ChoiceKind
  readOnly: boolean
}

export default function Pathfinder2SheetPage({
  rules,
}: {
  rules: Pathfinder2RulesCatalog
}) {
  const [mode, setMode] = useState<Pathfinder2Mode>('sheet')
  const [activeStep, setActiveStep] = useState<Pathfinder2StepId>('concept')
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    kind: 'ancestry',
    readOnly: false,
  })
  const [notice, setNotice] = useState('')
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const {
    draft,
    v4Draft,
    hydrated,
    saveStatus,
    migrationWarnings,
    updateCharacter,
    updateV4,
    updateField,
    resetCharacter,
    clearMigrationWarnings,
  } = usePathfinder2Character(rules)
  const characterState = useMemo(
    () => buildCharacterState(v4Draft, rules),
    [rules, v4Draft],
  )
  const build = useMemo(() => ({
    ...characterState.legacyBuild,
    validationIssues: characterState.validationIssues,
    isReady: characterState.isReady,
  }), [characterState])
  const derived = characterState.derived
  const completion = useMemo(
    () => getBuilderCompletion(draft, build.validationIssues),
    [build.validationIssues, draft],
  )

  const openChoice = (
    kind: Pathfinder2ChoiceKind,
    options: { readOnly?: boolean } = {},
    trigger: HTMLElement | null = null,
  ) => {
    returnFocusRef.current = trigger
    setDialog({ open: true, kind, readOnly: Boolean(options.readOnly) })
  }

  const closeChoice = () => {
    setDialog(current => ({ ...current, open: false }))
    requestAnimationFrame(() => returnFocusRef.current?.focus())
  }

  const confirmChoice = (kind: Pathfinder2ChoiceKind, id: string) => {
    updateCharacter(current => {
      let next = current

      if (kind === 'ancestry') {
        const reconciled = reconcileCharacterDecisions(current, {
          ...current,
          ancestryId: id,
        }, rules)
        next = reconciled.draft
        if (reconciled.changes.length) setNotice(reconciled.changes.join(' '))
      } else if (kind === 'heritage') {
        next = { ...current, heritageId: id, versatileHeritageId: '' }
        if (current.versatileHeritageId) {
          setNotice('Универсальное наследие заменено обычным наследием народа.')
        }
      } else if (kind === 'versatileHeritage') {
        next = { ...current, versatileHeritageId: id, heritageId: '' }
        if (current.heritageId) {
          setNotice('Обычное наследие заменено универсальным.')
        }
      } else if (kind === 'background') {
        const reconciled = reconcileCharacterDecisions(current, {
          ...current,
          backgroundId: id,
        }, rules)
        next = reconciled.draft
        if (reconciled.changes.length) setNotice(reconciled.changes.join(' '))
      } else if (kind === 'class') {
        const characterClass = getClassById(rules, id)
        const currentKeyAbility = current.attributeChoices.classKeyBoost
        const classKeyBoost = currentKeyAbility
          && characterClass?.keyAbilities.includes(currentKeyAbility)
          ? currentKeyAbility
          : characterClass?.keyAbilities.length === 1
            ? characterClass.keyAbilities[0]
            : null
        const reconciled = reconcileCharacterDecisions(current, {
          ...current,
          classId: id,
          subclassId: '',
          classFeatIds: [],
          attributeChoices: {
            ...current.attributeChoices,
            classKeyBoost,
          },
        }, rules)
        next = reconciled.draft
        const changes = current.classId && current.classId !== id
          ? ['Способности прежнего класса очищены.', ...reconciled.changes]
          : reconciled.changes
        if (changes.length) setNotice(changes.join(' '))
      } else if (kind === 'generalFeat') {
        next = {
          ...current,
          generalFeatIds: Array.from(new Set([...current.generalFeatIds, id])),
        }
      } else {
        next = {
          ...current,
          skillFeatIds: Array.from(new Set([...current.skillFeatIds, id])),
        }
      }

      const nextState = buildCharacterState(
        // The v4 adapter preserves details that are outside the transitional UI.
        // This provisional state is only used to initialize current HP.
        {
          ...v4Draft,
          identity: {
            ...v4Draft.identity,
            name: next.name,
            player: next.player,
            pronouns: next.pronouns,
            concept: next.concept,
            portrait: next.portrait,
          },
          ancestry: {
            ...v4Draft.ancestry,
            ancestryId: next.ancestryId,
            heritageId: next.heritageId || null,
            versatileHeritageId: next.versatileHeritageId || null,
          },
          background: {
            ...v4Draft.background,
            backgroundId: next.backgroundId,
          },
          class: {
            ...v4Draft.class,
            classId: next.classId,
            keyAbility: next.attributeChoices.classKeyBoost,
          },
        },
        rules,
      )
      if (
        next.currentHp === 0
        && nextState.derived.maxHp
        && (kind === 'ancestry' || kind === 'class')
      ) {
        next = { ...next, currentHp: nextState.derived.maxHp }
      } else if (
        nextState.derived.maxHp !== null
        && next.currentHp > nextState.derived.maxHp
      ) {
        next = { ...next, currentHp: nextState.derived.maxHp }
        setNotice('Текущие ПЗ ограничены новым максимумом после пересчёта.')
      }
      return next
    }, { immediate: true })
    if (kind === 'ancestry' && draft.ancestryId && draft.ancestryId !== id) {
      updateV4(current => ({
        ...current,
        ancestry: {
          ...current.ancestry,
          featChoicesByLevel: {},
        },
        feats: {
          ...current.feats,
          selectedBySlot: Object.fromEntries(
            Object.entries(current.feats.selectedBySlot).filter(([slotId]) => (
              !characterState.featSlots.some(slot => (
                slot.id === slotId && slot.type === 'ancestry-feat'
              ))
            )),
          ),
        },
      }), { immediate: true })
    }
    if (kind === 'class' && draft.classId && draft.classId !== id) {
      updateV4(current => ({
        ...current,
        class: {
          ...current.class,
          featChoicesByLevel: {},
        },
        feats: {
          ...current.feats,
          selectedBySlot: Object.fromEntries(
            Object.entries(current.feats.selectedBySlot).filter(([slotId]) => (
              !characterState.featSlots.some(slot => (
                slot.id === slotId && slot.type === 'class-feat'
              ))
            )),
          ),
        },
        spellcasting: { entries: [] },
      }), { immediate: true })
    }
    closeChoice()
  }

  const handleReset = () => {
    if (!window.confirm('Очистить локальный черновик Pathfinder 2?')) return
    resetCharacter()
    setActiveStep('concept')
    setMode('sheet')
    setNotice('Создан новый пустой локальный лист.')
  }

  const handleFinish = () => {
    if (characterState.isReady) {
      setMode('sheet')
      return
    }
    setActiveStep('review')
    setNotice('Создание нельзя завершить: исправьте ошибки, перечисленные в аудите.')
  }

  return (
    <div className={styles.page}>
      <Pathfinder2Topbar
        mode={mode}
        saveStatus={hydrated ? saveStatus : 'Загрузка черновика…'}
        onModeChange={setMode}
        onReset={handleReset}
      />
      {mode === 'builder' ? (
        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${completion}%` }} />
        </div>
      ) : null}

      {migrationWarnings.length > 0 || notice ? (
        <div className={styles.globalNotice} role="status">
          <span aria-hidden="true">!</span>
          <div>
            {notice ? <p>{notice}</p> : null}
            {migrationWarnings.map(warning => <p key={warning}>{warning}</p>)}
          </div>
          <button
            type="button"
            aria-label="Скрыть уведомление"
            onClick={() => {
              setNotice('')
              clearMigrationWarnings()
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {hydrated ? (
        mode === 'sheet' ? (
          <CharacterSheetView
            draft={draft}
            v4Draft={v4Draft}
            catalog={rules}
            build={build}
            state={characterState}
            derived={derived}
            updateField={updateField}
            updateV4={updateV4}
            openChoice={openChoice}
            onOpenBuilder={() => setMode('builder')}
          />
        ) : (
          <CharacterBuilderView
            draft={draft}
            v4Draft={v4Draft}
            catalog={rules}
            build={build}
            state={characterState}
            derived={derived}
            activeStep={activeStep}
            onStepChange={setActiveStep}
            updateCharacter={updateCharacter}
            updateV4={updateV4}
            updateField={updateField}
            openChoice={openChoice}
            onFinish={handleFinish}
          />
        )
      ) : (
        <main className={styles.loadingState}>
          <span aria-hidden="true">✦</span>
          <strong>Раскладываем лист на столе…</strong>
        </main>
      )}

      <Pathfinder2ChoiceGallery
        open={dialog.open}
        kind={dialog.kind}
        readOnly={dialog.readOnly}
        draft={draft}
        catalog={rules}
        onConfirm={confirmChoice}
        onClose={closeChoice}
      />
    </div>
  )
}
