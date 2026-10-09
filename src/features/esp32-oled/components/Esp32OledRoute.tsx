'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccount } from '@/platform/account/AccountProvider'
import { fetchDevices, pairDevice, renameDevice, sendCommand, unpairDevice, waitForCommand } from '../lib/client'
import type { ButtonActionType, Esp32CommandType, Esp32Device } from '../types'
import ConverterPanel from './ConverterPanel'
import OledPreview from './OledPreview'
import styles from './esp32.module.css'

function formatBytes(value: number) {
  if (!value) return 'неизвестно'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} КБ`
  return `${(value / 1024 / 1024).toFixed(1)} МБ`
}

function SignIn() {
  const { authenticate, isBusy } = useAccount()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  return (
    <section className={styles.authCard}>
      <span className={styles.eyebrow}>Личное пространство</span>
      <h1>Войдите, чтобы увидеть свои экраны</h1>
      <p>ESP32 привязываются к вашему общему аккаунту TableTopGames.</p>
      <label>Имя пользователя<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /></label>
      <label>Пароль<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primaryButton} disabled={isBusy} onClick={() => {
        setError('')
        void authenticate(mode, username, password).catch(caught => setError(caught instanceof Error ? caught.message : 'Не удалось войти.'))
      }}>{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
      <button className={styles.textButton} onClick={() => setMode(current => current === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
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
        <span className={styles.eyebrow}>Физическое подтверждение</span>
        <h2 id="pair-title">Добавить ESP32</h2>
        <p>Удерживайте кнопку 5 секунд и введите PIN с OLED. Код действует 120 секунд.</p>
        <label className={styles.pinLabel}>PIN
          <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" />
        </label>
        <label>Название<input maxLength={48} value={name} onChange={event => setName(event.target.value)} placeholder="Жабка" /></label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button className={styles.secondaryButton} onClick={onCancel}>Отмена</button>
          <button className={styles.primaryButton} disabled={busy || pin.length !== 4} onClick={() => {
            setBusy(true); setError('')
            void pairDevice(pin, name).then(onPaired).catch(caught => setError(caught instanceof Error ? caught.message : 'Не удалось добавить устройство.')).finally(() => setBusy(false))
          }}>Подключить</button>
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
      <OledPreview previewBase64={active?.previewBase64} label={active?.name || 'Нет активной анимации'} />
      <div className={styles.cardBody}>
        <div><strong>{device.name}</strong><span className={device.online ? styles.online : styles.offline}>{device.online ? 'online' : 'offline'}</span></div>
        <p>{active?.name || 'Анимация не выбрана'}</p>
        <div className={styles.storageBar}><span style={{ width: `${percent}%` }} /></div>
        <small>{formatBytes(device.fsUsed)} из {formatBytes(device.fsTotal)}</small>
      </div>
    </button>
  )
}

function DeviceControl({ device, refresh, onRemoved }: { device: Esp32Device; refresh: () => Promise<void>; onRemoved: () => void }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(device.name)
  const active = device.manifest.find(slot => slot.slot === device.activeSlot)
  useEffect(() => setName(device.name), [device.name])

  const execute = async (type: Exclude<Esp32CommandType, 'upload_asset'>, payload: Record<string, unknown> = {}) => {
    setBusy(true); setError(''); setStatus(device.online ? 'Команда отправлена, жду ESP32…' : 'Устройство offline. Команда сохранена в очереди.')
    try {
      const command = await sendCommand(device.id, type, payload)
      if (device.online) {
        await waitForCommand(command.id)
        setStatus('ESP32 подтвердила выполнение.')
        await refresh()
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Команда не выполнена.') }
    finally { setBusy(false) }
  }

  return (
    <div className={styles.controlStack}>
      <section className={styles.heroPanel}>
        <div>
          <button className={styles.backButton} onClick={onRemoved}>← Ко всем устройствам</button>
          <span className={styles.eyebrow}>ESP32-C3 SuperMini</span>
          <h1>{device.name}</h1>
          <p><span className={device.online ? styles.online : styles.offline}>{device.online ? 'online' : 'offline'}</span> · {active?.name || 'ничего не играет'}</p>
        </div>
        <OledPreview previewBase64={active?.previewBase64} label={active?.name || 'Экран пуст'} />
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>LittleFS</span><h2>Библиотека</h2></div><span className={styles.meta}>{formatBytes(device.fsUsed)} / {formatBytes(device.fsTotal)}</span></div>
        <div className={styles.slotGrid}>
          {Array.from({ length: 10 }, (_, slot) => {
            const item = device.manifest.find(entry => entry.slot === slot)
            return (
              <article className={`${styles.slotCard} ${device.activeSlot === slot ? styles.activeSlot : ''}`} key={slot}>
                <div className={styles.slotNumber}>{slot}</div>
                <OledPreview previewBase64={item?.previewBase64} label={item?.name || 'Пустой слот'} />
                <strong>{item?.name || 'Свободно'}</strong>
                {item ? <small>{item.frameCount} кадр. · {formatBytes(item.size)}</small> : <small>Можно загрузить файл</small>}
                {item && <div className={styles.slotActions}>
                  <button disabled={busy || device.activeSlot === slot} onClick={() => void execute('set_active', { slot })}>Включить</button>
                  <button disabled={busy} onClick={() => {
                    const next = window.prompt('Новое название', item.name)
                    if (next) void execute('rename_asset', { slot, name: next })
                  }}>Имя</button>
                  <button className={styles.dangerText} disabled={busy} onClick={() => {
                    if (window.confirm(`Удалить «${item.name}» с устройства?`)) void execute('delete_asset', { slot })
                  }}>Удалить</button>
                  <label className={styles.compactSelect}>Кнопка
                    <select value={item.buttonAction?.type || 'next'} onChange={event => void execute('set_settings', {
                      slot,
                      buttonAction: { type: event.target.value as ButtonActionType },
                    })}>
                      <option value="next">Следующая</option><option value="restart">Перезапуск</option><option value="alternate">Альтернативная</option><option value="toggle_pause">Пауза</option><option value="custom">Событие</option>
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
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Устройство</span><h2>Настройки</h2></div></div>
        <div className={styles.settingsGrid}>
          <label>Имя<div className={styles.inlineField}><input value={name} maxLength={48} onChange={event => setName(event.target.value)} /><button onClick={() => void renameDevice(device.id, name).then(refresh)}>Сохранить</button></div></label>
          <label>Яркость OLED <b>{device.brightness}</b><input type="range" min="0" max="255" defaultValue={device.brightness} onPointerUp={event => void execute('set_settings', { brightness: Number((event.target as HTMLInputElement).value) })} /></label>
          <label>Скорость<select value={device.speedMultiplier} onChange={event => void execute('set_settings', { speedMultiplier: Number(event.target.value) })}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label>
          <dl className={styles.diagnostics}>
            <div><dt>Device ID</dt><dd>{device.deviceUid}</dd></div><div><dt>Прошивка</dt><dd>{device.firmwareVersion || '—'}</dd></div>
            <div><dt>Flash</dt><dd>{formatBytes(device.flashSize)}</dd></div><div><dt>LittleFS свободно</dt><dd>{formatBytes(Math.max(0, device.fsTotal - device.fsUsed))}</dd></div>
            <div><dt>Последняя связь</dt><dd>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('ru-RU') : 'никогда'}</dd></div>
          </dl>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondaryButton} disabled={busy} onClick={() => { if (window.confirm('Перезагрузить ESP32?')) void execute('reboot') }}>Перезагрузить</button>
          <button className={styles.secondaryButton} disabled={busy} onClick={() => { if (window.confirm('Сбросить Wi-Fi? Устройство откроет сеть настройки.')) void execute('reset_wifi') }}>Настроить Wi-Fi заново</button>
          <button className={styles.dangerButton} disabled={busy} onClick={() => {
            if (!window.confirm('Отвязать устройство от аккаунта? Управление будет отозвано.')) return
            setBusy(true)
            void unpairDevice(device.id).then(onRemoved).catch(caught => setError(caught instanceof Error ? caught.message : 'Не удалось отвязать.')).finally(() => setBusy(false))
          }}>Отвязать</button>
        </div>
        {status && <p className={styles.success}>{status}</p>}{error && <p className={styles.error}>{error}</p>}
      </section>
    </div>
  )
}

export default function Esp32OledRoute() {
  const { account, isReady } = useAccount()
  const [devices, setDevices] = useState<Esp32Device[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!account) return
    try { setDevices(await fetchDevices()); setError('') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось загрузить устройства.') }
  }, [account])
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 10_000)
    return () => window.clearInterval(timer)
  }, [refresh])
  const selected = useMemo(() => devices.find(device => device.id === selectedId) || null, [devices, selectedId])

  if (!isReady) return <main className={styles.page}><div className={styles.loading}>Подключаемся…</div></main>
  if (!account) return <main className={styles.page}><SignIn /></main>
  return (
    <main className={styles.page}>
      <header className={styles.topbar}><a href="/">TableTopGames</a><span>OLED garden</span><span>{account.username}</span></header>
      {selected ? <DeviceControl device={selected} refresh={refresh} onRemoved={() => { setSelectedId(null); void refresh() }} /> : (
        <div className={styles.dashboard}>
          <section className={styles.intro}><span className={styles.eyebrow}>Тихие маленькие экраны</span><h1>Мои ESP32</h1><p>Загружайте пиксельные сцены, управляйте слотами и оставляйте устройство жить своей жизнью — даже когда интернет пропал.</p><button className={styles.primaryButton} onClick={() => setPairing(true)}>＋ Добавить ESP32</button></section>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.deviceGrid}>{devices.map(device => <DeviceCard key={device.id} device={device} selected={false} onSelect={() => setSelectedId(device.id)} />)}
            {!devices.length && <div className={styles.empty}><span>◌</span><h2>Пока здесь тихо</h2><p>Подключите первую ESP32 по PIN с экрана.</p></div>}
          </div>
        </div>
      )}
      {pairing && <PairForm onCancel={() => setPairing(false)} onPaired={device => { setPairing(false); setDevices(current => [...current, device]); setSelectedId(device.id) }} />}
    </main>
  )
}
