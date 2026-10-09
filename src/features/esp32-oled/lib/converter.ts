'use client'

import { encodeOledAsset, OLED_FRAME_BYTES } from './format'
import type { ConversionOptions, OledAsset, OledFrame } from '../types'

const WIDTH = 128
const HEIGHT = 64
const MAX_FRAMES = 240

function canvas(width: number, height: number) {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  const context = element.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available in this browser.')
  return { element, context }
}

function drawFitted(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: ConversionOptions,
) {
  const target = canvas(WIDTH, HEIGHT)
  target.context.fillStyle = '#000'
  target.context.fillRect(0, 0, WIDTH, HEIGHT)
  if (options.fit === 'stretch') {
    target.context.drawImage(source, 0, 0, WIDTH, HEIGHT)
    return target.context.getImageData(0, 0, WIDTH, HEIGHT)
  }
  const scale = options.fit === 'contain'
    ? Math.min(WIDTH / sourceWidth, HEIGHT / sourceHeight)
    : Math.max(WIDTH / sourceWidth, HEIGHT / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  target.context.drawImage(source, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height)
  return target.context.getImageData(0, 0, WIDTH, HEIGHT)
}

function monochrome(image: ImageData, options: ConversionOptions) {
  const luminance = new Float32Array(WIDTH * HEIGHT)
  const contrast = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast))
  for (let pixel = 0; pixel < luminance.length; pixel += 1) {
    const offset = pixel * 4
    const alpha = image.data[offset + 3] / 255
    const gray = (0.2126 * image.data[offset] + 0.7152 * image.data[offset + 1] + 0.0722 * image.data[offset + 2]) * alpha
    luminance[pixel] = Math.max(0, Math.min(255, contrast * (gray - 128) + 128 + options.brightness))
  }
  const packed = new Uint8Array(OLED_FRAME_BYTES)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const index = y * WIDTH + x
      const oldValue = luminance[index]
      const white = options.invert ? oldValue < options.threshold : oldValue >= options.threshold
      const nextValue = white ? 255 : 0
      if (white) packed[x + Math.floor(y / 8) * WIDTH] |= 1 << (y & 7)
      if (!options.dither) continue
      const error = oldValue - (options.invert ? 255 - nextValue : nextValue)
      if (x + 1 < WIDTH) luminance[index + 1] += error * 7 / 16
      if (y + 1 < HEIGHT) {
        if (x > 0) luminance[index + WIDTH - 1] += error * 3 / 16
        luminance[index + WIDTH] += error * 5 / 16
        if (x + 1 < WIDTH) luminance[index + WIDTH + 1] += error / 16
      }
    }
  }
  return packed
}

async function stillFrame(file: File, options: ConversionOptions) {
  const bitmap = await createImageBitmap(file)
  try {
    return [{
      durationMs: 1000,
      pixels: monochrome(drawFitted(bitmap, bitmap.width, bitmap.height, options), options),
    } satisfies OledFrame]
  } finally {
    bitmap.close()
  }
}

async function gifFrames(file: File, options: ConversionOptions) {
  const { decompressFrames, parseGIF } = await import('gifuct-js')
  const parsed = parseGIF(await file.arrayBuffer())
  const frames = decompressFrames(parsed, true)
  if (!frames.length) throw new Error('The GIF has no frames.')
  const source = canvas(parsed.lsd.width, parsed.lsd.height)
  let previousDisposal = 0
  let previousDims = frames[0].dims
  let restore: ImageData | null = null
  const output: OledFrame[] = []
  const step = Math.max(1, Math.ceil(frames.length / MAX_FRAMES))

  frames.forEach((frame, index) => {
    if (previousDisposal === 2) source.context.clearRect(previousDims.left, previousDims.top, previousDims.width, previousDims.height)
    if (previousDisposal === 3 && restore) source.context.putImageData(restore, 0, 0)
    const nextRestore = frame.disposalType === 3
      ? source.context.getImageData(0, 0, source.element.width, source.element.height)
      : null
    const patch = new ImageData(frame.dims.width, frame.dims.height)
    patch.data.set(frame.patch)
    source.context.putImageData(patch, frame.dims.left, frame.dims.top)
    if (index % step === 0) {
      output.push({
        durationMs: Math.max(20, Math.round((frame.delay || 100) * step / options.speed)),
        pixels: monochrome(drawFitted(source.element, source.element.width, source.element.height, options), options),
      })
    }
    previousDisposal = frame.disposalType
    previousDims = frame.dims
    restore = nextRestore
  })
  return output
}

export async function convertImage(file: File, options: ConversionOptions) {
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
  if (!isGif && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('PNG, JPG, WebP, and GIF files are supported.')
  }
  const frames = isGif ? await gifFrames(file, options) : await stillFrame(file, options)
  const asset: OledAsset = { width: WIDTH, height: HEIGHT, loop: options.loop, frames }
  return { asset, bytes: encodeOledAsset(asset) }
}

export function drawPackedFrame(canvasElement: HTMLCanvasElement, pixels: Uint8Array) {
  const context = canvasElement.getContext('2d')
  if (!context) return
  canvasElement.width = WIDTH
  canvasElement.height = HEIGHT
  const image = context.createImageData(WIDTH, HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const on = pixels[x + Math.floor(y / 8) * WIDTH] & (1 << (y & 7))
      const offset = (y * WIDTH + x) * 4
      image.data[offset] = on ? 205 : 5
      image.data[offset + 1] = on ? 255 : 13
      image.data[offset + 2] = on ? 224 : 10
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
}

export function frameToBase64(frame: Uint8Array) {
  let binary = ''
  frame.forEach(byte => { binary += String.fromCharCode(byte) })
  return window.btoa(binary)
}

export function base64ToFrame(value: string) {
  const binary = window.atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}
