import type {
  LegacyVoiceQuality,
  VoiceConnectionQuality,
  VoiceDeviceInfo,
  VoiceNoiseSuppression,
  VoiceQuality,
  VoiceSettings,
} from '../types'

const VOICE_VOLUME_PREFIX = 'vtm-voice-volume:'
const VOICE_SETTINGS_KEY = 'vtm-voice-settings'
const VOICE_QUALITY_KEY = 'vtm-voice-quality'

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  quality: 'high',
  noiseSuppression: 'light',
  inputDeviceId: null,
  outputDeviceId: null,
  masterVolume: 1,
}

const VOICE_BITRATES: Record<VoiceQuality, number> = {
  low: 48000,
  medium: 80000,
  high: 128000,
  studio: 160000,
}

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

export function normalizeVoiceQuality(value: string | null | undefined): VoiceQuality {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'studio') return value
  if (value === 'clear') return 'studio'
  if (value === 'balanced') return 'high'
  return DEFAULT_VOICE_SETTINGS.quality
}

export function getSavedVoiceVolume(participantId: string) {
  const saved = Number(window.localStorage.getItem(`${VOICE_VOLUME_PREFIX}${participantId}`))
  return Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : 1
}

export function loadVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_VOICE_SETTINGS }

  const legacyQuality = window.localStorage.getItem(VOICE_QUALITY_KEY)
  const raw = window.localStorage.getItem(VOICE_SETTINGS_KEY)

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<VoiceSettings>
      return {
        quality: normalizeVoiceQuality(parsed.quality ?? legacyQuality),
        noiseSuppression: parsed.noiseSuppression === 'off' || parsed.noiseSuppression === 'light' || parsed.noiseSuppression === 'aggressive'
          ? parsed.noiseSuppression
          : DEFAULT_VOICE_SETTINGS.noiseSuppression,
        inputDeviceId: typeof parsed.inputDeviceId === 'string' ? parsed.inputDeviceId : null,
        outputDeviceId: typeof parsed.outputDeviceId === 'string' ? parsed.outputDeviceId : null,
        masterVolume: Number.isFinite(parsed.masterVolume)
          ? Math.max(0, Math.min(1, parsed.masterVolume as number))
          : DEFAULT_VOICE_SETTINGS.masterVolume,
      }
    } catch {
      // fall through to legacy migration
    }
  }

  return {
    ...DEFAULT_VOICE_SETTINGS,
    quality: normalizeVoiceQuality(legacyQuality),
  }
}

export function saveVoiceSettings(settings: VoiceSettings) {
  window.localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings))
  window.localStorage.setItem(VOICE_QUALITY_KEY, settings.quality)
}

export function getVoiceBitrate(quality: VoiceQuality | LegacyVoiceQuality) {
  return VOICE_BITRATES[normalizeVoiceQuality(quality)]
}

export function shouldUseBrowserNoiseSuppression(
  quality: VoiceQuality,
  noiseSuppression: VoiceNoiseSuppression,
) {
  if (noiseSuppression === 'off') return false
  if (quality === 'studio') return noiseSuppression === 'aggressive'
  return true
}

export function shouldUseBrowserAutoGain(
  quality: VoiceQuality,
  noiseSuppression: VoiceNoiseSuppression,
) {
  if (quality === 'studio') return false
  return noiseSuppression !== 'off'
}

export function getVoiceAudioConstraints(
  quality: VoiceQuality,
  options: {
    deviceId?: string | null
    noiseSuppression?: VoiceNoiseSuppression
  } = {},
): MediaTrackConstraints {
  const noiseMode = options.noiseSuppression ?? 'light'
  const constraints: MediaTrackConstraints = {
    channelCount: 1,
    sampleRate: 48000,
    echoCancellation: true,
    noiseSuppression: shouldUseBrowserNoiseSuppression(quality, noiseMode),
    autoGainControl: shouldUseBrowserAutoGain(quality, noiseMode),
  }

  if (options.deviceId) {
    constraints.deviceId = { exact: options.deviceId }
  }

  return constraints
}

export function getVoiceIceServers(): RTCIceServer[] {
  const servers = [...DEFAULT_STUN_SERVERS]

  const customJson = process.env.NEXT_PUBLIC_VOICE_ICE_SERVERS
  if (customJson) {
    try {
      const parsed = JSON.parse(customJson) as RTCIceServer[]
      if (Array.isArray(parsed)) {
        parsed.forEach(server => {
          if (server?.urls) servers.push(server)
        })
      }
    } catch (error) {
      console.warn('Не удалось разобрать NEXT_PUBLIC_VOICE_ICE_SERVERS:', error)
    }
  }

  const turnUrl = process.env.NEXT_PUBLIC_VOICE_TURN_URL
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_VOICE_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_VOICE_TURN_CREDENTIAL,
    })
  }

  return servers
}

export async function enumerateVoiceDevices(): Promise<VoiceDeviceInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return []

  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.flatMap(device => {
    if (device.kind !== 'audioinput' && device.kind !== 'audiooutput') return []
    return [{
      deviceId: device.deviceId,
      label: device.label || (device.kind === 'audioinput' ? 'Микрофон' : 'Динамики'),
      kind: device.kind,
    }]
  })
}

export async function applyAudioOutputDevice(
  audio: HTMLAudioElement,
  deviceId: string | null,
) {
  if (!deviceId || typeof audio.setSinkId !== 'function') return
  try {
    await audio.setSinkId(deviceId)
  } catch (error) {
    console.warn('Не удалось переключить устройство вывода:', error)
  }
}

export function enhanceVoiceSdp(sdp = '', quality: VoiceQuality | LegacyVoiceQuality) {
  const normalizedQuality = normalizeVoiceQuality(quality)
  const opusPayload = sdp.match(/a=rtpmap:(\d+) opus\/48000/i)?.[1]
  if (!opusPayload) return sdp

  const bitrate = getVoiceBitrate(normalizedQuality)
  const useDtx = normalizedQuality !== 'studio'
  const opusOptions = [
    'minptime=10',
    'useinbandfec=1',
    `usedtx=${useDtx ? 1 : 0}`,
    `maxaveragebitrate=${bitrate}`,
    'stereo=0',
    'sprop-stereo=0',
    normalizedQuality === 'low' ? 'cbr=1' : 'cbr=0',
  ].join(';')

  const fmtpPattern = new RegExp(`a=fmtp:${opusPayload} .+`, 'i')

  if (fmtpPattern.test(sdp)) {
    return sdp.replace(fmtpPattern, line => {
      const [, options = ''] = line.split(' ')
      const cleaned = options
        .split(';')
        .map(option => option.trim())
        .filter(option => option && !/^(minptime|useinbandfec|usedtx|maxaveragebitrate|stereo|sprop-stereo|cbr)=/i.test(option))
        .join(';')
      return `a=fmtp:${opusPayload} ${cleaned ? `${cleaned};` : ''}${opusOptions}`
    })
  }

  return sdp.replace(
    new RegExp(`(a=rtpmap:${opusPayload} opus/48000.*\\r?\\n)`, 'i'),
    `$1a=fmtp:${opusPayload} ${opusOptions}\r\n`,
  )
}

export function enhanceVoiceDescription(
  description: RTCSessionDescriptionInit,
  quality: VoiceQuality | LegacyVoiceQuality,
): RTCSessionDescriptionInit {
  return {
    type: description.type,
    sdp: enhanceVoiceSdp(description.sdp || '', quality),
  }
}

export async function tuneVoiceSender(
  sender: RTCRtpSender | Promise<RTCRtpSender>,
  quality: VoiceQuality | LegacyVoiceQuality,
) {
  try {
    const resolvedSender = await sender
    const parameters = resolvedSender.getParameters()
    const bitrate = getVoiceBitrate(quality)
    parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}]
    parameters.encodings = parameters.encodings.map(encoding => ({
      ...encoding,
      maxBitrate: bitrate,
      priority: 'high',
      networkPriority: 'high',
    }))
    await resolvedSender.setParameters(parameters)
  } catch (error) {
    console.warn('Не удалось поднять битрейт голосового sender:', error)
  }
}

export function mapIceConnectionQuality(state: RTCIceConnectionState): VoiceConnectionQuality {
  if (state === 'connected' || state === 'completed') return 'good'
  if (state === 'checking' || state === 'new') return 'fair'
  if (state === 'disconnected') return 'fair'
  if (state === 'failed' || state === 'closed') return 'poor'
  return 'unknown'
}