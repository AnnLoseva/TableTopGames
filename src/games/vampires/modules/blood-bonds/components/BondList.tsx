'use client'

import type { KeyboardEvent } from 'react'
import type { BondListRow } from '../types'

type BondListProps = {
  rows: readonly BondListRow[]
  selectedBondId: string | null
  onSelect: (bondId: string) => void
}

export default function BondList({ rows, selectedBondId, onSelect }: BondListProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, bondId: string, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(bondId)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = event.key === 'ArrowDown' ? index + 1 : index - 1
      const target = rows[next]
      if (!target) return
      onSelect(target.bond.id)
      const el = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('tr[tabindex="0"]')[next]
      el?.focus()
    }
  }

  if (!rows.length) {
    return (
      <div className="bb-empty">
        Уз пока нет. Создайте thrall → regnant в правой панели.
      </div>
    )
  }

  return (
    <div className="bb-list" role="region" aria-label="Список уз крови">
      <table>
        <thead>
          <tr>
            <th scope="col">Thrall (actor)</th>
            <th scope="col">Regnant</th>
            <th scope="col">Level</th>
            <th scope="col">Last drink</th>
            <th scope="col">Warning</th>
            <th scope="col">Status</th>
            <th scope="col">Edit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.bond.id}
              tabIndex={0}
              data-selected={selectedBondId === row.bond.id ? 'true' : undefined}
              onClick={() => onSelect(row.bond.id)}
              onKeyDown={event => onKeyDown(event, row.bond.id, index)}
            >
              <td>{row.thrallName}</td>
              <td>{row.regnantName}</td>
              <td>{row.bond.level} · {row.levelTitle}</td>
              <td>{row.bond.lastDrinkAt ? new Date(row.bond.lastDrinkAt).toLocaleString() : '—'}</td>
              <td>{row.warning || '—'}</td>
              <td>{row.bond.status}</td>
              <td>
                <button
                  type="button"
                  className="bb-btn"
                  onClick={event => {
                    event.stopPropagation()
                    onSelect(row.bond.id)
                  }}
                >
                  edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
