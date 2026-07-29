'use client'

import { useMemo } from 'react'
import type { Vtm5BloodBondAdapter } from '@/games/vampires/core/vtm5/adapters/blood-bonds'
import type { BloodBond, BloodBondEvent } from '../types'

type BondDetailProps = {
  bond: BloodBond | null
  events: readonly BloodBondEvent[]
  thrallName: string
  regnantName: string
  related: readonly { bond: BloodBond; label: string; direction: 'in' | 'out' }[]
  adapter: Vtm5BloodBondAdapter
  busy: boolean
  onDrink: () => void
  onLevel: (delta: number) => void
  onBreak: () => void
  onToggleActive: () => void
  onNotes: (notes: string) => void
  onSelectBond: (id: string) => void
}

export default function BondDetail({
  bond,
  events,
  thrallName,
  regnantName,
  related,
  adapter,
  busy,
  onDrink,
  onLevel,
  onBreak,
  onToggleActive,
  onNotes,
  onSelectBond,
}: BondDetailProps) {
  const effects = useMemo(
    () => (bond ? adapter.getLevelEffects(bond.level) : null),
    [adapter, bond],
  )
  const warnings = useMemo(
    () => (bond
      ? adapter.computeWarnings({
        level: bond.level,
        drinksCount: bond.drinksCount,
        status: bond.status,
        expiresAt: bond.expiresAt,
      })
      : []),
    [adapter, bond],
  )
  const risk = bond ? adapter.nextRisk(bond.level, bond.drinksCount) : ''

  if (!bond || !effects) {
    return (
      <aside className="bb-detail" aria-label="Детали уз">
        <h2>Детали</h2>
        <p className="bb-muted">Выберите узы на графе или в списке.</p>
        <div className="bb-memo">
          <strong>Уровни (VTM5 adapter)</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
            {adapter.getAllLevelEffects().map(level => (
              <li key={level.level}><b>{level.level}. {level.title}</b> — {level.summary}</li>
            ))}
          </ul>
        </div>
      </aside>
    )
  }

  return (
    <aside className="bb-detail" aria-label={`Узы ${thrallName} → ${regnantName}`}>
      <div>
        <span className="bb-kicker">thrall → regnant</span>
        <h2>{thrallName} → {regnantName}</h2>
        <p className="bb-muted">
          уровень {bond.level} · {effects.title} · {bond.status} · visibility {bond.visibility}
        </p>
      </div>

      <div className="bb-warn" data-severity={warnings.some(w => w.severity === 'critical') ? 'critical' : 'warn'}>
        <div><strong>Влияние:</strong> {effects.summary}</div>
        <div style={{ marginTop: 6 }}><strong>Следующий риск:</strong> {risk}</div>
        {warnings.map(warning => (
          <div key={warning.code + warning.message} style={{ marginTop: 4 }}>{warning.message}</div>
        ))}
      </div>

      <div className="bb-actions">
        <button type="button" className="bb-btn" data-primary="true" disabled={busy || bond.status !== 'active'} onClick={onDrink}>
          + глоток
        </button>
        <button type="button" className="bb-btn" disabled={busy || bond.level >= adapter.maxLevel} onClick={() => onLevel(1)}>
          + уровень
        </button>
        <button type="button" className="bb-btn" disabled={busy || bond.level <= adapter.minLevel} onClick={() => onLevel(-1)}>
          − уровень
        </button>
        <button type="button" className="bb-btn" disabled={busy} onClick={onToggleActive}>
          {bond.status === 'inactive' ? 'activate' : 'deactivate'}
        </button>
        <button type="button" className="bb-btn" data-danger="true" disabled={busy || bond.status === 'broken'} onClick={onBreak}>
          break
        </button>
      </div>

      <div>
        <h3>Все узы актёра (in/out)</h3>
        {related.length === 0 ? (
          <p className="bb-muted">Нет связанных уз.</p>
        ) : (
          related.map(item => (
            <div key={item.bond.id} className="bb-bond-line">
              <span>{item.direction === 'out' ? '→' : '←'} {item.label} · lvl {item.bond.level} · {item.bond.status}</span>
              <button type="button" className="bb-btn" onClick={() => onSelectBond(item.bond.id)}>open</button>
            </div>
          ))
        )}
      </div>

      <label className="bb-field">
        <h3>Notes</h3>
        <textarea
          rows={4}
          defaultValue={bond.notes}
          key={bond.id + bond.updatedAt}
          onBlur={event => {
            if (event.target.value !== bond.notes) onNotes(event.target.value)
          }}
        />
      </label>

      <div>
        <h3>История (append-only)</h3>
        <div className="bb-events">
          {events.length === 0 ? (
            <div className="bb-event">Событий пока нет</div>
          ) : (
            events.map(event => (
              <div key={event.id} className="bb-event">
                <strong>{event.eventType}</strong>
                {' · '}
                {event.previousLevel != null || event.newLevel != null
                  ? `${event.previousLevel ?? '—'} → ${event.newLevel ?? '—'}`
                  : ''}
                {event.note ? ` · ${event.note}` : ''}
                <div>{new Date(event.occurredAt).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bb-memo">
        <div>Глотков: {bond.drinksCount}</div>
        <div>Первый: {bond.firstDrinkAt ? new Date(bond.firstDrinkAt).toLocaleString() : '—'}</div>
        <div>Последний: {bond.lastDrinkAt ? new Date(bond.lastDrinkAt).toLocaleString() : '—'}</div>
        <div>Истекает: {bond.expiresAt ? new Date(bond.expiresAt).toLocaleString() : '—'}</div>
        <div style={{ marginTop: 6 }}>
          Разрыв не удаляет историю — только status=broken + event.
        </div>
      </div>
    </aside>
  )
}
