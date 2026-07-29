'use client'

import Link from 'next/link'
import AccountBadge from '@/platform/account/AccountBadge'
import type { Pathfinder2Mode } from '../../types'
import styles from '../Pathfinder2SheetPage.module.css'

type Pathfinder2TopbarProps = {
  mode: Pathfinder2Mode
  saveStatus: string
  onModeChange: (mode: Pathfinder2Mode) => void
  onReset: () => void
}

export default function Pathfinder2Topbar({
  mode,
  saveStatus,
  onModeChange,
  onReset,
}: Pathfinder2TopbarProps) {
  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandSeal} aria-hidden="true">
            <span>PF2</span>
          </span>
          <span className={styles.brandText}>
            <strong>Pathfinder 2</strong>
            <small>Один герой · два режима работы</small>
          </span>
        </div>

        <div className={styles.modeSwitch} aria-label="Режим редактора">
          <button
            type="button"
            className={mode === 'sheet' ? styles.modeSwitchActive : undefined}
            aria-pressed={mode === 'sheet'}
            onClick={() => onModeChange('sheet')}
          >
            Лист персонажа
          </button>
          <button
            type="button"
            className={mode === 'builder' ? styles.modeSwitchActive : undefined}
            aria-pressed={mode === 'builder'}
            onClick={() => onModeChange('builder')}
          >
            Создание персонажа
          </button>
        </div>

        <div className={styles.topbarActions}>
          <Link href="/" className={styles.homeLink}>
            Все игры
          </Link>
          <span className={styles.saveStatus} aria-live="polite">
            <i aria-hidden="true" />
            {saveStatus}
          </span>
          <AccountBadge className={styles.accountBadge} />
          <button type="button" className={styles.quietButton} onClick={onReset}>
            Новый лист
          </button>
        </div>
      </header>
    </>
  )
}
