import type { Die } from '../types'

export const DIE_IMAGES: Record<Die['kind'], { src: string; label: string }> = {
  fail: { src: '/vampires/static/dice/fail.png', label: 'провал' },
  success: { src: '/vampires/static/dice/success.png', label: 'успех' },
  critical: { src: '/vampires/static/dice/critical-success.png', label: 'критический успех' },
  botch: { src: '/vampires/static/dice/fail.png', label: 'провал' },
  'hunger-fail': { src: '/vampires/static/dice/hunger-fail.png', label: 'провал Голода' },
  'hunger-success': { src: '/vampires/static/dice/hunger-success.png', label: 'успех Голода' },
  'hunger-critical-success': { src: '/vampires/static/dice/hunger-critical-success.png', label: 'критический успех Голода' },
  'hunger-critical-fail': { src: '/vampires/static/dice/hunger-critical-fail.png', label: 'критический провал Голода' },
}

export function getDieImage(die: Die) {
  return DIE_IMAGES[die.kind] || DIE_IMAGES.fail
}