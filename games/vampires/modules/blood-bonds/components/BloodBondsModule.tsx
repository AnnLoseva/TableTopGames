'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MasterModuleProps } from '@/games/vampires/modules/master-console/types'
import { getMasterMembership } from '@/games/vampires/modules/master-console/api'
import { useBloodBonds } from '../hooks'
import BondGraph from './BondGraph'
import BondList from './BondList'
import BondDetail from './BondDetail'
import './blood-bonds.css'

export default function BloodBondsModule({ room, role, deepLinkParams }: MasterModuleProps) {
  const state = useBloodBonds(room)
  const [thrallId, setThrallId] = useState('')
  const [regnantId, setRegnantId] = useState('')

  const deepLinkBondId = deepLinkParams?.bond || deepLinkParams?.entity || null
  const [missingEntity, setMissingEntity] = useState<string | null>(null)

  useEffect(() => {
    if (!deepLinkBondId) {
      setMissingEntity(null)
      return
    }
    state.setSelectedBondId(deepLinkBondId)
  }, [deepLinkBondId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!deepLinkBondId || state.loading) return
    setMissingEntity(state.bonds.some(bond => bond.id === deepLinkBondId) ? null : deepLinkBondId)
  }, [deepLinkBondId, state.bonds, state.loading])

  const thrallName = state.selectedBond
    ? state.nameById.get(state.selectedBond.thrallActorId) || 'thrall'
    : ''
  const regnantName = state.selectedBond
    ? state.nameById.get(state.selectedBond.regnantActorId) || 'regnant'
    : ''

  const related = useMemo(() => {
    if (!state.selectedBond) return []
    const focus = state.selectedActorId
      || state.selectedBond.thrallActorId
    return state.bondsForActor(focus).map(bond => {
      const outbound = bond.thrallActorId === focus
      const otherId = outbound ? bond.regnantActorId : bond.thrallActorId
      return {
        bond,
        direction: outbound ? 'out' as const : 'in' as const,
        label: `${state.nameById.get(bond.thrallActorId) || '?'} → ${state.nameById.get(bond.regnantActorId) || '?'}`,
        otherId,
      }
    })
  }, [state])

  if (role === 'observer') {
    return (
      <section className="bb-module">
        <div className="bb-empty">Observer: узы крови master-only до отдельного reveal.</div>
      </section>
    )
  }

  return (
    <section className="bb-module" aria-label="Узы крови">
      <header className="bb-header">
        <div>
          <span className="bb-kicker">кто кому принадлежит</span>
          <h1>Узы крови</h1>
          <p className="bb-muted">
            thrall → regnant · правила уровней из VTM5 adapter · private by default
          </p>
        </div>
        <div className="bb-toolbar">
          <button
            type="button"
            data-active={state.viewMode === 'graph' ? 'true' : undefined}
            onClick={() => state.setViewMode('graph')}
          >
            граф
          </button>
          <button
            type="button"
            data-active={state.viewMode === 'list' ? 'true' : undefined}
            onClick={() => state.setViewMode('list')}
          >
            списком ▤
          </button>
          <span className="bb-muted">{state.source === 'local' ? 'local' : 'remote'} · {state.bonds.length} уз</span>
        </div>
      </header>

      {state.status ? <p className="bb-status">{state.status}</p> : null}
      {state.error || state.actorsError ? (
        <p className="bb-status" data-tone="error">{state.error || state.actorsError}</p>
      ) : null}
      {missingEntity ? (
        <p className="master-entity-missing" role="status">
          Узы не найдены или удалены: <code>{missingEntity}</code>
        </p>
      ) : null}

      <div className="bb-layout">
        <div className="bb-main">
          <div className="bb-main-head">
            <strong>{state.viewMode === 'graph' ? 'Граф' : 'Список'}</strong>
            <span className="bb-muted">
              {state.selectedActorId
                ? `подсветка: ${state.nameById.get(state.selectedActorId) || state.selectedActorId}`
                : 'клик по узлу — подсветка связей'}
            </span>
          </div>
          {state.loading || state.actorsLoading ? (
            <div className="bb-empty">Загрузка…</div>
          ) : state.viewMode === 'graph' ? (
            <BondGraph
              nodes={state.graph.nodes}
              edges={state.graph.edges}
              selectedBondId={state.selectedBondId}
              selectedActorId={state.selectedActorId}
              onSelectBond={id => {
                state.setSelectedBondId(id)
              }}
              onSelectActor={id => state.setSelectedActorId(id)}
            />
          ) : (
            <BondList
              rows={state.listRows}
              selectedBondId={state.selectedBondId}
              onSelect={id => state.setSelectedBondId(id)}
            />
          )}
        </div>

        <div style={{ display: 'grid', gap: 10, minHeight: 0, overflow: 'auto' }}>
          <div className="bb-create">
            <strong>+ новые узы</strong>
            <label>
              <span>Thrall (кто выпил)</span>
              <select value={thrallId} onChange={event => setThrallId(event.target.value)}>
                <option value="">—</option>
                {state.actors.map(actor => (
                  <option key={actor.id} value={actor.id}>
                    {state.nameById.get(actor.id) || actor.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Regnant (чья кровь)</span>
              <select value={regnantId} onChange={event => setRegnantId(event.target.value)}>
                <option value="">—</option>
                {state.actors.map(actor => (
                  <option key={actor.id} value={actor.id}>
                    {state.nameById.get(actor.id) || actor.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="bb-btn"
              data-primary="true"
              disabled={state.busy || !thrallId || !regnantId}
              onClick={() => {
                void (async () => {
                  if (!state.chronicleId) {
                    const m = await getMasterMembership(room).catch(() => null)
                    if (m) state.setChronicleId(m.chronicleId)
                  }
                  await state.createBond(thrallId, regnantId)
                })()
              }}
            >
              Создать / нормализовать
            </button>
          </div>

          <BondDetail
            bond={state.selectedBond}
            events={state.selectedEvents}
            thrallName={thrallName}
            regnantName={regnantName}
            related={related}
            adapter={state.adapter}
            busy={state.busy}
            onDrink={() => void state.drink()}
            onLevel={delta => void state.changeLevel(delta)}
            onBreak={() => void state.breakSelected()}
            onToggleActive={() => void state.deactivateSelected()}
            onNotes={notes => void state.saveNotes(notes)}
            onSelectBond={id => state.setSelectedBondId(id)}
          />
        </div>
      </div>
    </section>
  )
}
