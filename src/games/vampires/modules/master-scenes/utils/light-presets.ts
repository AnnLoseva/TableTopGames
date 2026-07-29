import type { LightMoodPreset, LightPresetId } from '../types'

export const LIGHT_MOOD_PRESETS: readonly LightMoodPreset[] = [
  {
    id: 'elysium',
    label: 'Элизиум',
    brightness: 1.05,
    contrast: 1.05,
    saturation: 0.9,
    filterCss: 'brightness(1.05) contrast(1.05) saturate(0.9) sepia(0.08)',
    ambience: 'Тёплый салонный свет, мягкие тени',
  },
  {
    id: 'concrete',
    label: 'Бетон',
    brightness: 0.95,
    contrast: 1.15,
    saturation: 0.55,
    filterCss: 'brightness(0.95) contrast(1.15) saturate(0.55) grayscale(0.2)',
    ambience: 'Холодный промышленный серый',
  },
  {
    id: 'night',
    label: 'Ночь',
    brightness: 0.72,
    contrast: 1.1,
    saturation: 0.75,
    filterCss: 'brightness(0.72) contrast(1.1) saturate(0.75) hue-rotate(-8deg)',
    ambience: 'Тёмная улица, лунный холод',
  },
  {
    id: 'danger',
    label: 'Опасная зона',
    brightness: 0.88,
    contrast: 1.25,
    saturation: 1.15,
    filterCss: 'brightness(0.88) contrast(1.25) saturate(1.15) sepia(0.25) hue-rotate(-15deg)',
    ambience: 'Красноватое напряжение',
  },
  {
    id: 'neon',
    label: 'Неон',
    brightness: 1.0,
    contrast: 1.2,
    saturation: 1.45,
    filterCss: 'brightness(1.0) contrast(1.2) saturate(1.45) hue-rotate(20deg)',
    ambience: 'Городской неон, кислотные блики',
  },
] as const

export function getLightPreset(id: string | null | undefined): LightMoodPreset | undefined {
  return LIGHT_MOOD_PRESETS.find(preset => preset.id === id)
}

export function isLightPresetId(value: string): value is LightPresetId {
  return LIGHT_MOOD_PRESETS.some(preset => preset.id === value)
}
