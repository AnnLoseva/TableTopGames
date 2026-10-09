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
    setBusy(true); setError(''); setStatus('Преобразую изображение в 1-bit…')
    try {
      const result = await convertImage(file, options)
      if (result.bytes.byteLength > ESP32_MAX_ASSET_BYTES) throw new Error('Анимация больше 2 МБ. Уменьшите GIF или ускорьте его.')
      setAsset(result.asset); setBytes(result.bytes)
      setStatus(`Готово: ${result.asset.frames.length} кадр., ${(result.bytes.byteLength / 1024).toFixed(1)} КБ`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось обработать файл.')
      setAsset(null); setBytes(null); setStatus('')
    } finally { setBusy(false) }
  }

  const upload = async () => {
    if (!asset || !bytes) return
    setBusy(true); setError(''); setProgress(0); setStatus('Передаю файл на сервер…')
    try {
      const command = await uploadAsset(deviceId, {
        bytes, slot, name: name.trim() || file?.name.replace(/\.[^.]+$/, '') || `Слот ${slot}`,
        previewBase64: frameToBase64(asset.frames[0].pixels),
      }, setProgress)
      setStatus('Файл на сервере. Жду подтверждение ESP32…')
      await waitForCommand(command.id)
      setProgress(100); setStatus('ESP32 проверила и сохранила файл.')
      await onComplete()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Загрузка не завершена.')
    } finally { setBusy(false) }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <div><span className={styles.eyebrow}>Конвертер</span><h2>Новое изображение</h2></div>
        {asset && <span className={styles.meta}>{asset.frames.length} кадр. · {(duration / 1000).toFixed(1)} с</span>}
      </div>
      <div className={styles.converterGrid}>
        <div className={styles.controls}>
          <label className={styles.filePicker}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => {
              const next = event.target.files?.[0] || null
              setFile(next); setName(next?.name.replace(/\.[^.]+$/, '') || ''); setAsset(null); setBytes(null)
            }} />
            <span>{file ? file.name : 'Выбрать PNG, JPG или GIF'}</span>
          </label>
          <div className={styles.fieldRow}>
            <label>Слот<select value={slot} onChange={event => setSlot(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => <option key={index}>{index}</option>)}</select></label>
            <label>Название<input value={name} maxLength={48} onChange={event => setName(event.target.value)} /></label>
          </div>
          <div className={styles.fieldRow}>
            <label>Масштаб<select value={options.fit} onChange={event => setOptions(current => ({ ...current, fit: event.target.value as ConversionOptions['fit'] }))}>
              <option value="contain">Вместить</option><option value="cover">Заполнить</option><option value="stretch">Растянуть</option>
            </select></label>
            <label>Скорость GIF<select value={options.speed} onChange={event => setOptions(current => ({ ...current, speed: Number(event.target.value) }))}>
              <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option>
            </select></label>
          </div>
          {(['brightness', 'contrast', 'threshold'] as const).map(key => (
            <label className={styles.range} key={key}>
              <span>{key === 'brightness' ? 'Яркость' : key === 'contrast' ? 'Контраст' : 'Порог'} <b>{options[key]}</b></span>
              <input type="range" min={key === 'threshold' ? 0 : -100} max={key === 'threshold' ? 255 : 100} value={options[key]} onChange={event => setOptions(current => ({ ...current, [key]: Number(event.target.value) }))} />
            </label>
          ))}
          <div className={styles.checks}>
            <label><input type="checkbox" checked={options.dither} onChange={event => setOptions(current => ({ ...current, dither: event.target.checked }))} /> Дизеринг</label>
            <label><input type="checkbox" checked={options.invert} onChange={event => setOptions(current => ({ ...current, invert: event.target.checked }))} /> Инверсия</label>
            <label><input type="checkbox" checked={options.loop} onChange={event => setOptions(current => ({ ...current, loop: event.target.checked }))} /> Зацикливать</label>
          </div>
          <div className={styles.actions}>
            <button className={styles.secondaryButton} disabled={!file || busy} onClick={() => void convert()}>Обновить предпросмотр</button>
            <button className={styles.primaryButton} disabled={!bytes || busy} onClick={() => void upload()}>Загрузить в ESP32</button>
          </div>
          {(busy || progress > 0) && <div className={styles.progress}><span style={{ width: `${progress}%` }} /></div>}
          {status && <p className={styles.success}>{status}</p>}
          {error && <p className={styles.error}>{error}</p>}
        </div>
        <OledPreview asset={asset} label={asset ? 'Результат конвертации' : 'Здесь появится результат'} />
      </div>
    </section>
  )
}

