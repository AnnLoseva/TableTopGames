import type { OledAsset, OledFrame } from '../types'

const MAGIC = [0x4f, 0x4c, 0x45, 0x44, 0x31] as const // OLED1
const HEADER_BYTES = 12
export const OLED_FRAME_BYTES = 1024

function rleEncode(input: Uint8Array) {
  const output: number[] = []
  for (let offset = 0; offset < input.length;) {
    const value = input[offset]
    let count = 1
    while (offset + count < input.length && input[offset + count] === value && count < 255) {
      count += 1
    }
    output.push(count, value)
    offset += count
  }
  return Uint8Array.from(output)
}

export function rleDecode(input: Uint8Array, expectedLength = OLED_FRAME_BYTES) {
  const output = new Uint8Array(expectedLength)
  let writeOffset = 0
  for (let offset = 0; offset + 1 < input.length; offset += 2) {
    const count = input[offset]
    const value = input[offset + 1]
    if (count === 0 || writeOffset + count > expectedLength) {
      throw new Error('Повреждённый RLE-кадр.')
    }
    output.fill(value, writeOffset, writeOffset + count)
    writeOffset += count
  }
  if (writeOffset !== expectedLength) throw new Error('Неполный RLE-кадр.')
  return output
}

export function encodeOledAsset(asset: OledAsset) {
  if (asset.width !== 128 || asset.height !== 64) throw new Error('Поддерживается только OLED 128×64.')
  if (asset.frames.length < 1 || asset.frames.length > 2048) throw new Error('Недопустимое количество кадров.')

  const encoded = asset.frames.map(frame => {
    if (frame.pixels.byteLength !== OLED_FRAME_BYTES) throw new Error('Кадр должен занимать 1024 байта.')
    const compressed = rleEncode(frame.pixels)
    if (compressed.byteLength > 0xffff) throw new Error('Кадр слишком велик.')
    return { frame, compressed }
  })
  const byteLength = HEADER_BYTES + encoded.reduce((sum, item) => sum + 4 + item.compressed.byteLength, 0)
  const bytes = new Uint8Array(byteLength)
  const view = new DataView(bytes.buffer)
  bytes.set(MAGIC, 0)
  view.setUint8(5, 1) // format version
  view.setUint8(6, asset.loop ? 1 : 0)
  view.setUint8(7, 1) // compression: byte-run RLE
  view.setUint16(8, asset.frames.length, true)
  view.setUint16(10, 0, true)
  let offset = HEADER_BYTES
  encoded.forEach(({ frame, compressed }) => {
    view.setUint16(offset, Math.max(20, Math.min(60_000, Math.round(frame.durationMs))), true)
    view.setUint16(offset + 2, compressed.byteLength, true)
    bytes.set(compressed, offset + 4)
    offset += 4 + compressed.byteLength
  })
  return bytes
}

export function decodeOledAsset(bytes: Uint8Array): OledAsset {
  if (bytes.byteLength < HEADER_BYTES || MAGIC.some((value, index) => bytes[index] !== value)) {
    throw new Error('Это не файл OLED1.')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint8(5) !== 1 || view.getUint8(7) !== 1) throw new Error('Версия OLED-файла не поддерживается.')
  const frameCount = view.getUint16(8, true)
  if (frameCount < 1 || frameCount > 2048) throw new Error('Некорректное количество кадров.')
  const frames: OledFrame[] = []
  let offset = HEADER_BYTES
  for (let index = 0; index < frameCount; index += 1) {
    if (offset + 4 > bytes.byteLength) throw new Error('Оборван заголовок кадра.')
    const durationMs = view.getUint16(offset, true)
    const length = view.getUint16(offset + 2, true)
    offset += 4
    if (offset + length > bytes.byteLength) throw new Error('Оборваны данные кадра.')
    frames.push({ durationMs, pixels: rleDecode(bytes.subarray(offset, offset + length)) })
    offset += length
  }
  if (offset !== bytes.byteLength) throw new Error('В OLED-файле есть лишние данные.')
  return { width: 128, height: 64, loop: Boolean(view.getUint8(6) & 1), frames }
}

export function inspectOledAsset(bytes: Uint8Array) {
  const asset = decodeOledAsset(bytes)
  return {
    frameCount: asset.frames.length,
    durationMs: asset.frames.reduce((sum, frame) => sum + frame.durationMs, 0),
    loop: asset.loop,
  }
}

