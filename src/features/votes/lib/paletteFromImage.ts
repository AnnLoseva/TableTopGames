export type ExtractedPalette = {
  accent: string
  accentStrong: string
}

const SAMPLE_SIZE = 48
const MIN_SATURATION = 0.12
const MIN_LIGHTNESS = 0.08
const MAX_LIGHTNESS = 0.92
const MIN_COLORFUL_SAMPLES = 8

function rgbToHsl(r: number, g: number, b: number) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  const delta = max - min

  if (delta === 0) return { h: 0, s: 0, l }

  const s = delta / (1 - Math.abs(2 * l - 1))
  let h: number
  switch (max) {
    case rr:
      h = ((gg - bb) / delta) % 6
      break
    case gg:
      h = (bb - rr) / delta + 2
      break
    default:
      h = (rr - gg) / delta + 4
  }
  h *= 60
  if (h < 0) h += 360

  return { h, s, l }
}

function loadImage(url: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (crossOrigin) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image failed to load'))
    image.src = url
  })
}

function proxiedImageUrl(url: string): string {
  return `/votes/api/image-proxy?url=${encodeURIComponent(url)}`
}

async function sampleImagePixels(url: string, crossOrigin: boolean): Promise<Uint8ClampedArray> {
  const image = await loadImage(url, crossOrigin)

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2d canvas context unavailable')

  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  // Throws (SecurityError) if the image was loaded cross-origin without the
  // host sending CORS headers — the canvas is "tainted" and unreadable.
  return context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
}

/**
 * Samples a poll's background image to derive an accent color that suits it
 * (e.g. warm tones for an autumn photo instead of a fixed violet), so the
 * sliders/buttons/results bars don't visually clash with the picture.
 * Purely decorative: any failure falls back to the default violet theme,
 * silently.
 *
 * Most hotlinked images (Pinterest, personal blogs, etc.) send no CORS
 * headers, which taints the canvas and blocks `getImageData`. We try a
 * direct, CORS-mode load first (cheap, no round trip to our server) and only
 * fall back to `/votes/api/image-proxy`, which re-fetches the image
 * server-side and serves it same-origin, when that fails.
 */
export async function extractAccentPalette(imageUrl: string): Promise<ExtractedPalette | null> {
  try {
    const isEmbedded = imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')
    const data = isEmbedded
      ? await sampleImagePixels(imageUrl, false)
      : await sampleImagePixels(imageUrl, true).catch(() => sampleImagePixels(proxiedImageUrl(imageUrl), false))

    let sumX = 0
    let sumY = 0
    let weightTotal = 0
    let saturationTotal = 0
    let lightnessTotal = 0
    let colorfulCount = 0

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]
      if (alpha < 200) continue

      const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2])
      if (s < MIN_SATURATION || l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue

      const weight = s
      const radians = (h * Math.PI) / 180
      sumX += Math.cos(radians) * weight
      sumY += Math.sin(radians) * weight
      weightTotal += weight
      saturationTotal += s
      lightnessTotal += l
      colorfulCount += 1
    }

    if (colorfulCount < MIN_COLORFUL_SAMPLES || weightTotal === 0) return null

    let hue = (Math.atan2(sumY, sumX) * 180) / Math.PI
    if (hue < 0) hue += 360

    const averageSaturation = saturationTotal / colorfulCount
    const averageLightness = lightnessTotal / colorfulCount

    // Clamp into a range that stays vivid and legible against the dark card.
    const accentSaturation = Math.min(85, Math.max(55, averageSaturation * 100))
    const accentLightness = Math.min(70, Math.max(52, averageLightness * 100))

    const accent = `hsl(${hue.toFixed(1)}, ${accentSaturation.toFixed(0)}%, ${accentLightness.toFixed(0)}%)`
    const accentStrong = `hsl(${hue.toFixed(1)}, ${Math.min(95, accentSaturation + 10).toFixed(0)}%, ${Math.min(82, accentLightness + 10).toFixed(0)}%)`

    return { accent, accentStrong }
  } catch {
    return null
  }
}
