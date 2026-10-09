'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAccount } from '@/platform/account/AccountProvider'
import { fetchDevices, fetchGifts, fetchServiceDiagnostics, pairDevice, renameDevice, sendCommand, unpairDevice, waitForCommand } from '../lib/client'
import type { Esp32CommandType } from '../constants'
import type { ButtonActionType, Esp32Device, Esp32GiftInvite } from '../types'
import GiftInbox from './GiftInbox'
import GiftWizard from './GiftWizard'
import OledPreview from './OledPreview'
import styles from './esp32.module.css'

const ConverterPanel = dynamic(() => import('./ConverterPanel'), {
  loading: () => <div className={styles.loading}>Loading converter…</div>,
})

function formatBytes(value: number) {
  if (!value) return 'unknown'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function englishAccountError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : ''
  const translations: Record<string, string> = {
    'Имя пользователя — минимум 3 символа.': 'Username must contain at least 3 characters.',
    'Пароль — минимум 6 символов.': 'Password must contain at least 6 characters.',
    'Такой пользователь уже существует.': 'That username already exists.',
    'Не удалось создать аккаунт.': 'Could not create the account.',
    'Аккаунт создан, но вход не выполнен. Попробуйте войти.': 'The account was created, but sign-in failed. Try signing in.',
    'Неверный логин или пароль.': 'The username or password is incorrect.',
    'Не удалось загрузить профиль аккаунта.': 'Could not load the account profile.',
  }
  return translations[message] || message || 'Could not sign in.'
}

function SignIn() {
  const { authenticate, isBusy } = useAccount()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  return (
    <section className={styles.authCard}>
      <span className={styles.eyebrow}>Your private space</span>
      <h1>Sign in to see your displays</h1>
      <p>Your ESP32 devices are linked to your shared TableTopGames account.</p>
      <label>Username<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primaryButton} disabled={isBusy} onClick={() => {
        setError('')
        void authenticate(mode, username, password).catch(caught => setError(englishAccountError(caught)))
      }}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
      <button className={styles.textButton} onClick={() => setMode(current => current === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'No account? Create one' : 'Already have an account? Sign in'}
      </button>
    </section>
  )
}

function PairForm({ onPaired, onCancel }: { onPaired: (device: Esp32Device) => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="pair-title">
        <span className={styles.eyebrow}>Physical confirmation</span>
        <h2 id="pair-title">Add an ESP32</h2>
        <p>Hold the button for 5–9 seconds and release it. The OLED shows a PIN only after the server confirms it. The code is valid for 120 seconds.</p>
        <label className={styles.pinLabel}>PIN
          <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" />
        </label>
        <label>Name<input maxLength={48} value={name} onChange={event => setName(event.target.value)} placeholder="Desk display" /></label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button className={styles.secondaryButton} onClick={onCancel}>Cancel</button>
          <button className={styles.primaryButton} disabled={busy || pin.length !== 4} onClick={() => {
            setBusy(true); setError('')
            void pairDevice(pin, name).then(onPaired).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not add the device.')).finally(() => setBusy(false))
          }}>Connect</button>
        </div>
      </section>
    </div>
  )
}

function DeviceCard({ device, selected, onSelect }: { device: Esp32Device; selected: boolean; onSelect: () => void }) {
  const active = device.manifest.find(slot => slot.slot === device.activeSlot)
  const percent = device.fsTotal ? Math.round(device.fsUsed / device.fsTotal * 100) : 0
  return (
    <button className={`${styles.deviceCard} ${selected ? styles.deviceCardSelected : ''}`} onClick={onSelect}>
      <OledPreview previewBase64={active?.previewBase64} label={active?.name || 'No active animation'} />
      <div className={styles.cardBody}>
        <div><strong>{device.name}</strong><span className={device.online ? styles.online : styles.offline}>{device.online ? 'online' : 'offline'}</span></div>
        <p>{active?.name || 'No animation selected'}</p>
        <div className={styles.storageBar}><span style={{ width: `${percent}%` }} /></div>
        <small>{formatBytes(device.fsUsed)} of {formatBytes(device.fsTotal)}</small>
      </div>
    </button>
  )
}

function DeviceControl({ device, refresh, onRemoved, onPrepareGift }: { device: Esp32Device; refresh: () => Promise<void>; onRemoved: () => void; onPrepareGift: () => void }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(device.name)
  const active = device.manifest.find(slot => slot.slot === device.activeSlot)
  useEffect(() => setName(device.name), [device.name])

  const execute = async (type: Exclude<Esp32CommandType, 'upload_asset'>, payload: Record<string, unknown> = {}) => {
    setBusy(true); setError(''); setStatus(device.online ? 'Command sent. Waiting for the ESP32…' : 'Device is offline. The command is queued.')
    try {
      const command = await sendCommand(device.id, type, payload)
      if (device.online) {
        await waitForCommand(command.id)
        setStatus('The ESP32 confirmed the command.')
        await refresh()
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The command failed.') }
    finally { setBusy(false) }
  }

  return (
    <div className={styles.controlStack}>
      <section className={styles.heroPanel}>
        <div>
          <button className={styles.backButton} onClick={onRemoved}>← All devices</button>
          <span className={styles.eyebrow}>ESP32-C3 SuperMini</span>
          <h1>{device.name}</h1>
          <p><span className={device.online ? styles.online : styles.offline}>{device.online ? 'online' : 'offline'}</span> · {active?.name || 'nothing playing'}</p>
        </div>
        <OledPreview previewBase64={active?.previewBase64} label={active?.name || 'Blank display'} />
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>LittleFS</span><h2>Library</h2></div><span className={styles.meta}>{formatBytes(device.fsUsed)} / {formatBytes(device.fsTotal)}</span></div>
        <div className={styles.slotGrid}>
          {Array.from({ length: 10 }, (_, slot) => {
            const item = device.manifest.find(entry => entry.slot === slot)
            return (
              <article className={`${styles.slotCard} ${device.activeSlot === slot ? styles.activeSlot : ''}`} key={slot}>
                <div className={styles.slotNumber}>{slot}</div>
                <OledPreview previewBase64={item?.previewBase64} label={item?.name || 'Empty slot'} />
                <strong>{item?.name || 'Available'}</strong>
                {item ? <small>{item.frameCount} frames · {formatBytes(item.size)}</small> : <small>Ready for an upload</small>}
                {item && <div className={styles.slotActions}>
                  <button disabled={busy || device.activeSlot === slot} onClick={() => void execute('set_active', { slot })}>Play</button>
                  <button disabled={busy} onClick={() => {
                    const next = window.prompt('New name', item.name)
                    if (next) void execute('rename_asset', { slot, name: next })
                  }}>Rename</button>
                  <button className={styles.dangerText} disabled={busy} onClick={() => {
                    if (window.confirm(`Delete “${item.name}” from the device?`)) void execute('delete_asset', { slot })
                  }}>Delete</button>
                  <label className={styles.compactSelect}>Button
                    <select value={item.buttonAction?.type || 'next'} onChange={event => {
                      const type = event.target.value as ButtonActionType
                      const buttonAction: { type: ButtonActionType; alternateSlot?: number; eventName?: string } = { type }
                      if (type === 'alternate') {
                        const target = Number(window.prompt('Which slot should play once?', String(item.buttonAction?.alternateSlot ?? 0)))
                        if (!Number.isInteger(target) || target < 0 || target > 9) { setError('Choose a slot from 0 to 9 for the alternate animation.'); return }
                        buttonAction.alternateSlot = target
                      }
                      if (type === 'custom') {
                        const eventName = window.prompt('Event name', item.buttonAction?.eventName || 'character.action')?.trim()
                        if (!eventName || !/^[a-zA-Z0-9_.:-]{1,64}$/.test(eventName)) { setError('Event names may contain letters, digits, periods, colons, underscores, and hyphens.'); return }
                        buttonAction.eventName = eventName
                      }
                      void execute('set_settings', { slot, buttonAction })
                    }}>
                      <option value="next">Next</option><option value="restart">Restart</option><option value="alternate">Alternate</option><option value="toggle_pause">Pause</option><option value="custom">Event</option>
                    </select>
                  </label>
                </div>}
              </article>
            )
          })}
        </div>
      </section>

      <ConverterPanel deviceId={device.id} defaultSlot={Array.from({ length: 10 }, (_, slot) => slot).find(slot => !device.manifest.some(entry => entry.slot === slot)) ?? 9} onComplete={refresh} />

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Device</span><h2>Settings</h2></div></div>
        <div className={styles.settingsGrid}>
          <label>Name<div className={styles.inlineField}><input value={name} maxLength={48} onChange={event => setName(event.target.value)} /><button onClick={() => void renameDevice(device.id, name).then(refresh)}>Save</button></div></label>
          <label>OLED brightness <b>{device.brightness}</b><input type="range" min="0" max="255" defaultValue={device.brightness} onPointerUp={event => void execute('set_settings', { brightness: Number((event.target as HTMLInputElement).value) })} /></label>
          <label>Speed<select value={device.speedMultiplier} onChange={event => void execute('set_settings', { speedMultiplier: Number(event.target.value) })}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label>
          <dl className={styles.diagnostics}>
            <div><dt>Device ID</dt><dd>{device.deviceUid}</dd></div><div><dt>Firmware</dt><dd>{device.firmwareVersion || '—'}</dd></div>
            <div><dt>Flash</dt><dd>{formatBytes(device.flashSize)}</dd></div><div><dt>LittleFS available</dt><dd>{formatBytes(Math.max(0, device.fsTotal - device.fsUsed))}</dd></div>
            <div><dt>Measured FPS</dt><dd>{device.actualFps ? device.actualFps.toFixed(1) : '—'}</dd></div><div><dt>Maximum frame gap</dt><dd>{device.maxFrameGapMs ? `${device.maxFrameGapMs} ms` : '—'}</dd></div>
            <div><dt>Connection state</dt><dd>{device.connectionState.replaceAll('_', ' ')}</dd></div><div><dt>Last backend status</dt><dd>{device.lastHttpStatus || 'OK'}</dd></div>
            <div><dt>Last seen</dt><dd>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('en-US') : 'never'}</dd></div>
          </dl>
        </div>
        <div className={styles.actions}>
          <button className={styles.primaryButton} disabled={busy} onClick={onPrepareGift}>Prepare as a gift</button>
          <button className={styles.secondaryButton} disabled={busy} onClick={() => { if (window.confirm('Restart the ESP32?')) void execute('reboot') }}>Restart</button>
          <button className={styles.secondaryButton} disabled={busy} onClick={() => { if (window.confirm('Reset Wi-Fi? The device will open its setup network.')) void execute('reset_wifi') }}>Set up Wi-Fi again</button>
          <button className={styles.dangerButton} disabled={busy} onClick={() => {
            if (!window.confirm('Unlink this device from your account? Remote control will be revoked.')) return
            setBusy(true)
            void unpairDevice(device.id).then(onRemoved).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not unlink the device.')).finally(() => setBusy(false))
          }}>Unlink</button>
        </div>
        {status && <p className={styles.success}>{status}</p>}{error && <p className={styles.error}>{error}</p>}
      </section>
    </div>
  )
}

export default function Esp32OledRoute() {
  const { account, isReady } = useAccount()
  const [devices, setDevices] = useState<Esp32Device[]>([])
  const [incomingGifts, setIncomingGifts] = useState<Esp32GiftInvite[]>([])
  const [outgoingGifts, setOutgoingGifts] = useState<Esp32GiftInvite[]>([])
  const [giftDevice, setGiftDevice] = useState<Esp32Device | null>(null)
  const [giftInvite, setGiftInvite] = useState<Esp32GiftInvite | undefined>()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const [error, setError] = useState('')
  const [configurationError, setConfigurationError] = useState('')
  const refresh = useCallback(async () => {
    if (!account) return
    try {
      const [nextDevices, gifts] = await Promise.all([fetchDevices(), fetchGifts()])
      setDevices(nextDevices); setIncomingGifts(gifts.incoming); setOutgoingGifts(gifts.outgoing); setError('')
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load devices.') }
  }, [account])
  useEffect(() => {
    void refresh()
    if (account) void fetchServiceDiagnostics().then(() => setConfigurationError('')).catch(caught => setConfigurationError(caught instanceof Error ? caught.message : 'The device service is not configured.'))
    const timer = window.setInterval(() => void refresh(), 10_000)
    return () => window.clearInterval(timer)
  }, [refresh])
  const selected = devices.find(device => device.id === selectedId) || null
  const openExistingGift = (gift: Esp32GiftInvite) => {
    const owned = devices.find(device => device.id === gift.deviceId)
    setGiftInvite(gift)
    setGiftDevice(owned || {
      id: gift.deviceId, deviceUid: '', name: gift.deviceName, firmwareVersion: null, lastSeenAt: null, online: false,
      activeSlot: null, flashSize: 0, fsTotal: 0, fsUsed: 0, brightness: 128, speedMultiplier: 1,
      actualFps: 0, maxFrameGapMs: 0, connectionState: 'wifi_unset', lastHttpStatus: null,
      setupApSsid: gift.setupApSsid, setupApPassword: gift.setupApPassword, manifest: [], createdAt: gift.createdAt,
    })
  }

  if (!isReady) return <main className={styles.page}><div className={styles.loading}>Connecting…</div></main>
  if (!account) return <main className={styles.page}><SignIn /></main>
  return (
    <main className={styles.page}>
      <header className={styles.topbar}><a href="/">TableTopGames</a><span>OLED garden</span><span>{account.username}</span></header>
      {selected ? <DeviceControl device={selected} refresh={refresh} onPrepareGift={() => { setGiftInvite(outgoingGifts.find(gift => gift.deviceId === selected.id && gift.status !== 'cancelled')); setGiftDevice(selected) }} onRemoved={() => { setSelectedId(null); void refresh() }} /> : (
        <div className={styles.dashboard}>
          <section className={styles.intro}><span className={styles.eyebrow}>Quiet little displays</span><h1>My ESP32 devices</h1><p>Upload pixel scenes, manage slots, and let each device keep playing even when the internet goes away.</p><button className={styles.primaryButton} onClick={() => setPairing(true)}>＋ Add ESP32</button></section>
          {configurationError && <p className={styles.error}><b>Administrator action required.</b> {configurationError}</p>}
          <GiftInbox gifts={incomingGifts} onChanged={refresh} />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.deviceGrid}>{devices.map(device => <DeviceCard key={device.id} device={device} selected={false} onSelect={() => setSelectedId(device.id)} />)}
            {!devices.length && <div className={styles.empty}><span>◌</span><h2>Nothing here yet</h2><p>Connect your first ESP32 using the PIN shown on its display.</p></div>}
          </div>
          {outgoingGifts.some(gift => gift.status !== 'cancelled') && <section className={styles.preparedGifts}><span className={styles.eyebrow}>Prepared gifts</span><div>{outgoingGifts.filter(gift => gift.status !== 'cancelled').map(gift => <button key={gift.id} onClick={() => openExistingGift(gift)}><strong>{gift.deviceName}</strong><span>For @{gift.recipientUsername} · {gift.status.replaceAll('_', ' ')}</span></button>)}</div></section>}
        </div>
      )}
      {pairing && <PairForm onCancel={() => setPairing(false)} onPaired={device => { setPairing(false); setDevices(current => [...current, device]); setSelectedId(device.id) }} />}
      {giftDevice && <GiftWizard device={giftDevice} initialGift={giftInvite} onChanged={refresh} onClose={() => { setGiftDevice(null); setGiftInvite(undefined) }} />}
    </main>
  )
}
