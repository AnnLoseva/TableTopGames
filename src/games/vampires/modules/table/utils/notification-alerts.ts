export type NotificationAlertKind = 'roll' | 'message'

let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextCtor = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  if (!sharedAudioContext) sharedAudioContext = new AudioContextCtor()
  return sharedAudioContext
}

// Browsers block audio until a user gesture unlocks the AudioContext; call this
// from any early pointer/keyboard interaction so later realtime-triggered
// notifications (which aren't gestures themselves) can actually play.
export function unlockNotificationAudio() {
  const context = getAudioContext()
  if (context?.state === 'suspended') void context.resume().catch(() => undefined)
}

function playTone(context: AudioContext, frequency: number, startAt: number, duration: number, peakGain: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

export function playNotificationTone(kind: NotificationAlertKind) {
  const context = getAudioContext()
  if (!context) return
  if (context.state === 'suspended') void context.resume().catch(() => undefined)

  const now = context.currentTime
  if (kind === 'roll') {
    playTone(context, 523.25, now, 0.12, 0.16)
    playTone(context, 783.99, now + 0.09, 0.16, 0.16)
    return
  }

  playTone(context, 659.25, now, 0.1, 0.13)
  playTone(context, 880, now + 0.07, 0.14, 0.13)
}

let blinkIntervalId: ReturnType<typeof setInterval> | null = null
let originalTabTitle: string | null = null
let currentBlinkText = ''

export function startTabBlink(alertText: string, intervalMs = 1000) {
  if (typeof document === 'undefined') return
  currentBlinkText = alertText
  if (originalTabTitle === null) originalTabTitle = document.title
  if (blinkIntervalId) return

  let showingAlert = true
  document.title = currentBlinkText
  blinkIntervalId = setInterval(() => {
    showingAlert = !showingAlert
    document.title = showingAlert ? currentBlinkText : (originalTabTitle ?? '')
  }, intervalMs)
}

export function stopTabBlink() {
  if (typeof document === 'undefined') return
  if (blinkIntervalId) {
    clearInterval(blinkIntervalId)
    blinkIntervalId = null
  }
  if (originalTabTitle !== null) {
    document.title = originalTabTitle
    originalTabTitle = null
  }
}
