import type { VoiceQuality } from '../types'

const VOICE_DUCK_EVENT = 'vtm-voice-duck'
const VAD_INTERVAL_MS = 80
const VAD_HANGOVER_MS = 450
const SPEECH_THRESHOLD = 0.018
const REMOTE_SPEECH_THRESHOLD = 0.012

/** Ключ локального (своего) потока в наборе анализаторов монитора. */
export const LOCAL_VOICE_KEY = '__local__'

export type VoiceAudioPipeline = {
  processedStream: MediaStream
  destroy: () => void
}

export type VoiceSpeakingListener = (participantId: string, speaking: boolean) => void

export type VoiceDuckingMonitorOptions = {
  /** Вызывается при смене «говорит / молчит» у своего или чужого потока. */
  onSpeakingChange?: VoiceSpeakingListener
}

export type VoiceDuckingMonitor = {
  attachRemoteStream: (participantId: string, stream: MediaStream) => void
  detachRemoteStream: (participantId: string) => void
  destroy: () => void
}

function dispatchVoiceDuck(active: boolean) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(VOICE_DUCK_EVENT, { detail: { active } }))
}

function getRmsLevel(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer)
  let sum = 0
  for (let index = 0; index < buffer.length; index += 1) {
    const sample = buffer[index]
    sum += sample * sample
  }
  return Math.sqrt(sum / buffer.length)
}

function buildProcessingChain(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  quality: VoiceQuality,
) {
  const highPass = context.createBiquadFilter()
  highPass.type = 'highpass'
  highPass.frequency.value = quality === 'studio' ? 70 : 90
  highPass.Q.value = 0.7

  const presence = context.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 2800
  presence.Q.value = 0.9
  presence.gain.value = quality === 'studio' ? 1.2 : quality === 'low' ? 0 : 2.4

  const compressor = context.createDynamicsCompressor()
  compressor.threshold.value = quality === 'studio' ? -22 : -28
  compressor.knee.value = 8
  compressor.ratio.value = quality === 'studio' ? 2.5 : 3.5
  compressor.attack.value = 0.003
  compressor.release.value = quality === 'studio' ? 0.18 : 0.12

  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 0
  limiter.ratio.value = 12
  limiter.attack.value = 0.002
  limiter.release.value = 0.08

  const outputGain = context.createGain()
  outputGain.gain.value = quality === 'studio' ? 1 : 1.08

  source.connect(highPass)
  highPass.connect(presence)
  presence.connect(compressor)
  compressor.connect(limiter)
  limiter.connect(outputGain)

  return outputGain
}

export function createVoiceAudioPipeline(
  rawStream: MediaStream,
  quality: VoiceQuality,
): VoiceAudioPipeline {
  const context = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
  const source = context.createMediaStreamSource(rawStream)
  const destination = context.createMediaStreamDestination()
  const output = buildProcessingChain(context, source, quality)
  output.connect(destination)

  void context.resume().catch(() => undefined)

  return {
    processedStream: destination.stream,
    destroy: () => {
      source.disconnect()
      output.disconnect()
      destination.disconnect()
      rawStream.getTracks().forEach(track => track.stop())
      void context.close()
    },
  }
}

export function createVoiceDuckingMonitor(
  localStream: MediaStream | null,
  options: VoiceDuckingMonitorOptions = {},
): VoiceDuckingMonitor {
  const context = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
  const analysers = new Map<string, AnalyserNode>()
  const teardowns = new Map<string, () => void>()
  const buffer = new Float32Array(2048) as Float32Array<ArrayBuffer>
  // Состояние VAD отдельно на каждый поток — для индикации «кто говорит»
  const speakingStates = new Map<string, { speaking: boolean; lastSpeechAt: number }>()

  let localAnalyser: AnalyserNode | null = null
  let localTeardown: (() => void) | null = null
  let speaking = false
  let lastSpeechAt = 0
  let intervalId: ReturnType<typeof setInterval> | null = null
  let duckingActive = false

  const updateSpeakingState = (key: string, level: number, threshold: number, now: number) => {
    const previous = speakingStates.get(key)
    const wasSpeaking = previous?.speaking ?? false
    const state = { speaking: wasSpeaking, lastSpeechAt: previous?.lastSpeechAt ?? 0 }

    if (level >= threshold) {
      state.lastSpeechAt = now
      state.speaking = true
    } else if (now - state.lastSpeechAt > VAD_HANGOVER_MS) {
      state.speaking = false
    }

    speakingStates.set(key, state)
    if (wasSpeaking !== state.speaking) options.onSpeakingChange?.(key, state.speaking)
  }

  const clearSpeakingState = (key: string) => {
    const state = speakingStates.get(key)
    speakingStates.delete(key)
    if (state?.speaking) options.onSpeakingChange?.(key, false)
  }

  const connectStream = (stream: MediaStream, key: string) => {
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.35
    const silentGain = context.createGain()
    silentGain.gain.value = 0

    source.connect(analyser)
    analyser.connect(silentGain)
    silentGain.connect(context.destination)

    analysers.set(key, analyser)
    teardowns.set(key, () => {
      source.disconnect()
      analyser.disconnect()
      silentGain.disconnect()
      analysers.delete(key)
      teardowns.delete(key)
    })
  }

  const setLocalStream = (stream: MediaStream | null) => {
    localTeardown?.()
    localTeardown = null
    localAnalyser = null
    clearSpeakingState(LOCAL_VOICE_KEY)

    if (!stream) return
    connectStream(stream, LOCAL_VOICE_KEY)
    localAnalyser = analysers.get(LOCAL_VOICE_KEY) ?? null
    localTeardown = teardowns.get(LOCAL_VOICE_KEY) ?? null
  }

  setLocalStream(localStream)
  void context.resume().catch(() => undefined)

  const evaluateSpeech = () => {
    let localLevel = 0
    let remoteLevel = 0
    const now = Date.now()

    if (localAnalyser) {
      localLevel = getRmsLevel(localAnalyser, buffer)
      updateSpeakingState(LOCAL_VOICE_KEY, localLevel, SPEECH_THRESHOLD, now)
    }

    analysers.forEach((analyser, key) => {
      if (key === LOCAL_VOICE_KEY) return
      const level = getRmsLevel(analyser, buffer)
      updateSpeakingState(key, level, REMOTE_SPEECH_THRESHOLD, now)
      remoteLevel = Math.max(remoteLevel, level)
    })

    const hasSpeech = (localAnalyser && localLevel >= SPEECH_THRESHOLD)
      || remoteLevel >= REMOTE_SPEECH_THRESHOLD

    if (hasSpeech) {
      lastSpeechAt = now
      speaking = true
    } else if (now - lastSpeechAt > VAD_HANGOVER_MS) {
      speaking = false
    }

    if (speaking !== duckingActive) {
      duckingActive = speaking
      dispatchVoiceDuck(duckingActive)
    }
  }

  intervalId = setInterval(evaluateSpeech, VAD_INTERVAL_MS)

  return {
    attachRemoteStream: (participantId, stream) => {
      if (teardowns.has(participantId)) return
      connectStream(stream, participantId)
    },
    detachRemoteStream: participantId => {
      teardowns.get(participantId)?.()
      clearSpeakingState(participantId)
    },
    destroy: () => {
      if (intervalId) clearInterval(intervalId)
      if (duckingActive) dispatchVoiceDuck(false)
      speakingStates.forEach((_state, key) => clearSpeakingState(key))
      teardowns.forEach(teardown => teardown())
      teardowns.clear()
      localTeardown?.()
      void context.close()
    },
  }
}