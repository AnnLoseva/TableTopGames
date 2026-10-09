'use client'

import { useEffect, useMemo, useState } from 'react'
import { ESP32_MAX_ASSET_BYTES } from '../constants'
import { convertImage, frameToBase64 } from '../lib/converter'
import { uploadAsset, waitForCommand } from '../lib/client'
import type { ConversionOptions, OledAsset } from '../types'
import OledPreview from './OledPreview'
import styles from './esp32.module.css'

const DEFAULT_OPTIONS: ConversionOptions = {
  fit: 'contain', brightness: 0, contrast: 0, threshold: 128,
  invert: false, dither: true, speed: 1, loop: true,
}

type Props = {
  deviceId: string
  defaultSlot: number
  onComplete: () => Promise<void>
}

export default function ConverterPanel({ deviceId, defaultSlot, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [slot, setSlot] = useState(defaultSlot)
  const [name, setName] = useState('')
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [asset, setAsset] = useState<OledAsset | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const duration = useMemo(() => asset?.frames.reduce((sum, frame) => sum + frame.durationMs, 0) || 0, [asset])
  useEffect(() => setSlot(defaultSlot), [defaultSlot])

  const convert = async () => {
    if (!file) return
    setBusy(true); setError(''); setStatus('Converting the image to 1-bit…')
    try {
      const result = await convertImage(file, options)
      if (result.bytes.byteLength > ESP32_MAX_ASSET_BYTES) throw new Error('The animation is larger than 2 MB. Shorten the GIF or increase its speed.')
      setAsset(result.asset); setBytes(result.bytes)
      setStatus(`Ready: ${result.asset.frames.length} frames, ${(result.bytes.byteLength / 1024).toFixed(1)} KB`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not process the file.')
      setAsset(null); setBytes(null); setStatus('')
    } finally { setBusy(false) }
  }

  const upload = async () => {
    if (!asset || !bytes) return
    setBusy(true); setError(''); setProgress(0); setStatus('Uploading the file to the server…')
    try {
      const command = await uploadAsset(deviceId, {
        bytes, slot, name: name.trim() || file?.name.replace(/\.[^.]+$/, '') || `Slot ${slot}`,
        previewBase64: frameToBase64(asset.frames[0].pixels),
      }, setProgress)
      setStatus('File uploaded. Waiting for the ESP32…')
      await waitForCommand(command.id)
      setProgress(100); setStatus('The ESP32 verified and saved the file.')
      await onComplete()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The upload did not finish.')
    } finally { setBusy(false) }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <div><span className={styles.eyebrow}>Converter</span><h2>New image</h2></div>
        {asset && <span className={styles.meta}>{asset.frames.length} frames · {(duration / 1000).toFixed(1)} s</span>}
      </div>
      <div className={styles.converterGrid}>
        <div className={styles.controls}>
          <label className={styles.filePicker}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => {
              const next = event.target.files?.[0] || null
              setFile(next); setName(next?.name.replace(/\.[^.]+$/, '') || ''); setAsset(null); setBytes(null)
            }} />
            <span>{file ? file.name : 'Choose a PNG, JPG, WebP, or GIF'}</span>
          </label>
          <div className={styles.fieldRow}>
            <label>Slot<select value={slot} onChange={event => setSlot(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => <option key={index}>{index}</option>)}</select></label>
            <label>Name<input value={name} maxLength={48} onChange={event => setName(event.target.value)} /></label>
          </div>
          <div className={styles.fieldRow}>
            <label>Fit<select value={options.fit} onChange={event => setOptions(current => ({ ...current, fit: event.target.value as ConversionOptions['fit'] }))}>
              <option value="contain">Contain</option><option value="cover">Cover</option><option value="stretch">Stretch</option>
            </select></label>
            <label>GIF speed<select value={options.speed} onChange={event => setOptions(current => ({ ...current, speed: Number(event.target.value) }))}>
              <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option>
            </select></label>
          </div>
          {(['brightness', 'contrast', 'threshold'] as const).map(key => (
            <label className={styles.range} key={key}>
              <span>{key === 'brightness' ? 'Brightness' : key === 'contrast' ? 'Contrast' : 'Threshold'} <b>{options[key]}</b></span>
              <input type="range" min={key === 'threshold' ? 0 : -100} max={key === 'threshold' ? 255 : 100} value={options[key]} onChange={event => setOptions(current => ({ ...current, [key]: Number(event.target.value) }))} />
            </label>
          ))}
          <div className={styles.checks}>
            <label><input type="checkbox" checked={options.dither} onChange={event => setOptions(current => ({ ...current, dither: event.target.checked }))} /> Dithering</label>
            <label><input type="checkbox" checked={options.invert} onChange={event => setOptions(current => ({ ...current, invert: event.target.checked }))} /> Invert</label>
            <label><input type="checkbox" checked={options.loop} onChange={event => setOptions(current => ({ ...current, loop: event.target.checked }))} /> Loop</label>
          </div>
          <div className={styles.actions}>
            <button className={styles.secondaryButton} disabled={!file || busy} onClick={() => void convert()}>Update preview</button>
            <button className={styles.primaryButton} disabled={!bytes || busy} onClick={() => void upload()}>Upload to ESP32</button>
          </div>
          {(busy || progress > 0) && <div className={styles.progress}><span style={{ width: `${progress}%` }} /></div>}
          {status && <p className={styles.success}>{status}</p>}
          {error && <p className={styles.error}>{error}</p>}
        </div>
        <OledPreview asset={asset} label={asset ? 'Conversion result' : 'Your result will appear here'} />
      </div>
    </section>
  )
}

