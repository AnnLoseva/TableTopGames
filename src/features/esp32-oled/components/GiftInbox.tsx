'use client'

import { useState } from 'react'
import { updateGift } from '../lib/client'
import type { Esp32GiftInvite } from '../types'
import styles from './esp32.module.css'

export default function GiftInbox({ gifts, onChanged }: { gifts: Esp32GiftInvite[]; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const visible = gifts.filter(gift => gift.status !== 'cancelled')
  if (!visible.length) return null
  return <section className={styles.giftInbox}>
    <span className={styles.eyebrow}>A gift is waiting</span>
    {visible.map(gift => <article key={gift.id}>
      <div><h2>{gift.deviceName}</h2><p>{gift.status === 'pending' ? 'Someone prepared this little display for you. Accept it to make it yours—no PIN needed.' : 'Waiting for Wi-Fi. Plug in the display, scan the QR card, and choose your home network.'}</p></div>
      {gift.status === 'pending' ? <button className={styles.primaryButton} disabled={busyId === gift.id} onClick={() => {
        setBusyId(gift.id); setError(''); void updateGift(gift.id, 'accept').then(onChanged).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not accept the gift.')).finally(() => setBusyId(''))
      }}>Accept my gift</button> : <span className={styles.waitingBadge}>Waiting for Wi-Fi</span>}
    </article>)}
    {error && <p className={styles.error}>{error}</p>}
  </section>
}
