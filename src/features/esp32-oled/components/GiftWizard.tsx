'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { createGift, fetchGifts, findGiftRecipient, updateGift } from '../lib/client'
import type { Esp32Device, Esp32GiftInvite } from '../types'
import styles from './esp32.module.css'

function wifiQrValue(ssid: string, password: string) {
  const escape = (value: string) => value.replace(/([\\;,:"])/g, '\\$1')
  return `WIFI:T:WPA;S:${escape(ssid)};P:${escape(password)};H:false;;`
}

export default function GiftWizard({ device, initialGift, onClose, onChanged }: {
  device: Esp32Device
  initialGift?: Esp32GiftInvite
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [step, setStep] = useState(initialGift?.status === 'ready' ? 5 : initialGift ? 4 : 1)
  const [username, setUsername] = useState(initialGift?.recipientUsername || 'tali')
  const [recipient, setRecipient] = useState(initialGift?.recipientUsername || '')
  const [gift, setGift] = useState<Esp32GiftInvite | undefined>(initialGift)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [qr, setQr] = useState('')
  const active = device.manifest.find(slot => slot.slot === device.activeSlot)
  const credentialsReady = Boolean((gift?.setupApSsid || device.setupApSsid) && (gift?.setupApPassword || device.setupApPassword))
  const checks = useMemo(() => [
    { label: 'Device is online and answering the server', ok: device.online },
    { label: 'At least one animation is stored', ok: device.manifest.length > 0 },
    { label: 'An active gift animation is selected', ok: Boolean(active) },
    { label: 'Unique setup network credentials are available', ok: credentialsReady },
  ], [active, credentialsReady, device.manifest.length, device.online])

  useEffect(() => {
    if (step !== 4 || !gift || gift.status === 'ready' || gift.status === 'cancelled') return
    const timer = window.setInterval(() => {
      void fetchGifts().then(result => {
        const fresh = result.outgoing.find(item => item.id === gift.id)
        if (fresh) { setGift(fresh); if (fresh.status === 'ready') setStep(5) }
      })
    }, 3000)
    return () => window.clearInterval(timer)
  }, [gift, step])

  useEffect(() => {
    const ssid = gift?.setupApSsid || device.setupApSsid
    const password = gift?.setupApPassword || device.setupApPassword
    if (!ssid || !password) return
    void QRCode.toDataURL(wifiQrValue(ssid, password), { width: 460, margin: 2, color: { dark: '#23342d', light: '#fffffc' } }).then(setQr)
  }, [device.setupApPassword, device.setupApSsid, gift?.setupApPassword, gift?.setupApSsid])

  const cancelGift = async () => {
    if (!gift) return onClose()
    setBusy(true); setError('')
    try { await updateGift(gift.id, 'cancel'); await onChanged(); onClose() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not cancel the invitation.') }
    finally { setBusy(false) }
  }

  return <div className={styles.modalBackdrop} role="presentation">
    <section className={`${styles.modal} ${styles.giftWizard}`} role="dialog" aria-modal="true" aria-labelledby="gift-title">
      <div className={styles.wizardTop}><div><span className={styles.eyebrow}>Prepare as a gift</span><h2 id="gift-title">A tiny display, ready for someone special</h2></div><button className={styles.iconButton} onClick={onClose} aria-label="Close">×</button></div>
      <ol className={styles.steps} aria-label="Gift preparation steps">
        {['Device', 'Recipient', 'Animations', 'Transfer', 'Card'].map((label, index) => <li className={step === index + 1 ? styles.currentStep : step > index + 1 ? styles.doneStep : ''} key={label}><span>{index + 1}</span>{label}</li>)}
      </ol>

      {step === 1 && <div className={styles.wizardBody}>
        <h3>1. Prepare the device</h3><p>Nothing will be erased except the saved home Wi-Fi after the recipient accepts.</p>
        <dl className={styles.giftSummary}><div><dt>Status</dt><dd>{device.online ? 'Online' : 'Offline'}</dd></div><div><dt>Storage</dt><dd>{Math.max(0, device.fsTotal - device.fsUsed).toLocaleString()} bytes free</dd></div><div><dt>Brightness</dt><dd>{device.brightness}</dd></div><div><dt>Button</dt><dd>{active?.buttonAction.type || 'Not set'}</dd></div></dl>
        <div className={styles.checkList}>{checks.map(check => <div key={check.label} className={check.ok ? styles.checkOk : styles.checkMissing}><span>{check.ok ? '✓' : '!'}</span>{check.label}</div>)}</div>
        {!credentialsReady && <p className={styles.error}>Flash firmware 1.2.0 and let the device register once before creating the gift card.</p>}
      </div>}

      {step === 2 && <div className={styles.wizardBody}>
        <h3>2. Choose the recipient</h3><p>We only send an invitation to an existing signed-in account. No device token or shared secret is exposed.</p>
        <label>Username<div className={styles.inlineField}><input value={username} maxLength={64} onChange={event => { setUsername(event.target.value); setRecipient('') }} /><button disabled={busy} onClick={() => {
          setBusy(true); setError(''); void findGiftRecipient(username.trim()).then(found => setRecipient(found.username)).catch(caught => setError(caught instanceof Error ? caught.message : 'Account not found.')).finally(() => setBusy(false))
        }}>Find</button></div></label>
        {recipient && <p className={styles.success}>Found @{recipient}. This account will have to accept the gift.</p>}
      </div>}

      {step === 3 && <div className={styles.wizardBody}>
        <h3>3. Save the gift</h3><p>Check the display now. The selected animation, speed, brightness and button behavior are stored on the ESP32 and survive the Wi-Fi reset.</p>
        <div className={styles.animationCheck}><strong>{active?.name || 'No active animation'}</strong><span>{device.manifest.length} saved animation{device.manifest.length === 1 ? '' : 's'}</span><span>{device.speedMultiplier}× speed · brightness {device.brightness}</span></div>
        {!active && <p className={styles.error}>Choose an active animation before continuing.</p>}
      </div>}

      {step === 4 && <div className={styles.wizardBody}>
        <h3>4. Transfer the device</h3>
        {!gift ? <><p>Create the invitation for <b>@{recipient}</b>. Ownership changes only after they accept.</p><button className={styles.primaryButton} disabled={busy || !recipient} onClick={() => {
          setBusy(true); setError(''); void createGift(device.id, recipient).then(created => { setGift(created); void onChanged() }).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not create the invitation.')).finally(() => setBusy(false))
        }}>Send secure invitation</button></> : <div className={styles.transferStatus}>
          <span className={styles.statusOrb} data-status={gift.status} />
          <div><strong>{gift.status === 'pending' ? `Waiting for @${gift.recipientUsername}` : gift.status === 'wifi_reset_sent' ? 'Accepted — resetting Wi-Fi' : gift.status === 'ready' ? 'Setup mode confirmed' : 'Invitation cancelled'}</strong>
          <p>{gift.status === 'pending' ? 'Keep the ESP32 powered and online. The recipient can accept from their OLED page.' : gift.status === 'wifi_reset_sent' ? 'The server transferred ownership and queued a Wi-Fi-only reset. Files and settings remain untouched.' : gift.status === 'ready' ? 'The ESP32 acknowledged the reset and is ready for the gift box.' : 'Create a new invitation when you are ready.'}</p></div>
        </div>}
      </div>}

      {step === 5 && <div className={styles.wizardBody}>
        <h3>5. Print the card</h3><p>The QR code is unique to this ESP32 setup network. It does not contain the home Wi-Fi password or the device token.</p>
        <article className={styles.printCard} id="oled-gift-card">
          <span className={styles.cardKicker}>A little moving picture for Tali</span><h4>Подключи свой OLED ✦</h4>
          {qr && <img src={qr} alt="QR code for the device setup Wi-Fi" />}
          <ol><li>Подключи OLED к питанию.</li><li>Наведи камеру iPhone на QR-код и подключись.</li><li>Выбери домашний Wi-Fi. Если окно не открылось: <b>192.168.4.1</b></li></ol>
          <small>{gift?.setupApSsid || device.setupApSsid} · пароль: {gift?.setupApPassword || device.setupApPassword}</small>
        </article>
        <button className={styles.primaryButton} onClick={() => window.print()}>Print gift card</button>
      </div>}

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.wizardActions}>
        {step > 1 && step < 4 && <button className={styles.secondaryButton} onClick={() => setStep(step - 1)}>Back</button>}
        {step < 3 && <button className={styles.primaryButton} disabled={(step === 1 && (!credentialsReady || !device.online)) || (step === 2 && !recipient)} onClick={() => setStep(step + 1)}>Continue</button>}
        {step === 3 && <button className={styles.primaryButton} disabled={!active} onClick={() => setStep(4)}>Continue</button>}
        {step === 4 && gift?.status === 'ready' && <button className={styles.primaryButton} onClick={() => setStep(5)}>Open card</button>}
        {step === 4 && gift?.status === 'pending' && <button className={styles.textButton} disabled={busy} onClick={() => void cancelGift()}>Cancel invitation</button>}
      </div>
    </section>
  </div>
}
