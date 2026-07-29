'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState } from 'react'
import { getBackgroundSkills } from '../rules/derived-character-values'
import { calculateDerivedCharacterValues } from '../rules/derived-character-values'
import { getBuilderCompletion } from '../rules/builder-progress'
import {
  getAncestryById,
  getBackgroundById,
  getClassById,
} from '../data/selectors'
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
    hydrated,
    saveStatus,
    migrationWarnings,
    updateCharacter,
    updateField,
    resetCharacter,
    clearMigrationWarnings,
  } = usePathfinder2Character(rules)
  const derived = useMemo(
    () => calculateDerivedCharacterValues(draft, rules),
    [draft, rules],
  )
  const completion = useMemo(() => getBuilderCompletion(draft), [draft])

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
        const ancestry = getAncestryById(rules, id)
        const heritageRemainsValid = ancestry?.heritages.some(
          heritage => heritage.id === current.heritageId,
        )
        next = {
          ...current,
          ancestryId: id,
          heritageId: heritageRemainsValid ? current.heritageId : '',
        }
        if (current.heritageId && !heritageRemainsValid) {
          setNotice('Наследие очищено: оно не относится к новому народу.')
        }
      } else if (kind === 'heritage') {
        next = { ...current, heritageId: id }
      } else if (kind === 'versatileHeritage') {
        next = { ...current, versatileHeritageId: id }
      } else if (kind === 'background') {
        const background = getBackgroundById(rules, id)
        const backgroundSkills = background
          ? getBackgroundSkills(background.trainedSkills)
          : []
        const backgroundFeatName = background?.skillFeat
          .replace(/\s*\([^)]*\)\s*$/, '')
          .trim()
        const backgroundFeat = rules.skillFeats.find(
          feat => feat.name === backgroundFeatName,
        )
        next = {
          ...current,
          backgroundId: id,
          lore: background?.trainedLore || current.lore,
          trainedSkills: Array.from(new Set([
            ...current.trainedSkills,
            ...backgroundSkills,
          ])),
          skillFeatIds: backgroundFeat
            ? Array.from(new Set([...current.skillFeatIds, backgroundFeat.id]))
            : current.skillFeatIds,
        }
      } else if (kind === 'class') {
        const characterClass = getClassById(rules, id)
        const keyAbility = current.keyAbility
          && characterClass?.keyAbilities.includes(current.keyAbility)
          ? current.keyAbility
          : characterClass?.keyAbilities[0] ?? ''
        next = {
          ...current,
          classId: id,
          subclassId: '',
          classFeatIds: [],
          keyAbility,
        }
        if (current.classId && current.classId !== id) {
          setNotice('Путь и способности прежнего класса очищены.')
        }
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

      const nextDerived = calculateDerivedCharacterValues(next, rules)
      if (
        next.currentHp === 0
        && nextDerived.maxHp
        && (kind === 'ancestry' || kind === 'class')
      ) {
        next = { ...next, currentHp: nextDerived.maxHp }
      }
      return next
    }, { immediate: true })
    closeChoice()
  }

  const handleReset = () => {
    if (!window.confirm('Очистить локальный черновик Pathfinder 2?')) return
    resetCharacter()
    setActiveStep('concept')
    setMode('sheet')
    setNotice('Создан новый пустой локальный лист.')
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
            catalog={rules}
            derived={derived}
            updateCharacter={updateCharacter}
            updateField={updateField}
            openChoice={openChoice}
            onOpenBuilder={() => setMode('builder')}
          />
        ) : (
          <CharacterBuilderView
            draft={draft}
            catalog={rules}
            derived={derived}
            activeStep={activeStep}
            onStepChange={setActiveStep}
            updateCharacter={updateCharacter}
            updateField={updateField}
            openChoice={openChoice}
            onFinish={() => setMode('sheet')}
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
