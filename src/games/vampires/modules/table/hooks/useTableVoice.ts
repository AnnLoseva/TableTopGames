'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import type {
  CharacterOption,
  VoiceDeviceInfo,
  VoiceNoiseSuppression,
  VoiceParticipant,
  VoiceQuality,
  VoiceSignal,
} from '../types'
import {
  createVoiceAudioPipeline,
  createVoiceDuckingMonitor,
  type VoiceAudioPipeline,
  type VoiceDuckingMonitor,
} from '../utils/voice-audio-pipeline'
import {
  applyAudioOutputDevice,
  enhanceVoiceDescription,
  enumerateVoiceDevices,
  getSavedVoiceVolume,
  getVoiceAudioConstraints,
  getVoiceIceServers,
  loadVoiceSettings,
  mapIceConnectionQuality,
  saveVoiceSettings,
  tuneVoiceSender,
} from '../utils/voice-webrtc'

const RECONNECT_BASE_MS = 1200
const RECONNECT_MAX_ATTEMPTS = 5

export type UseTableVoiceOptions = {
  roomRef: MutableRefObject<string>
  broadcast: (event: string, payload: unknown) => void
  chatUserRef: MutableRefObject<ChatUser | null>
  chatCharactersRef: MutableRefObject<CharacterOption[]>
  selectedChatCharacterIdRef: MutableRefObject<string>
  t: (ru: string) => string
}

export function useTableVoice({
  roomRef,
  broadcast,
  chatUserRef,
  chatCharactersRef,
  selectedChatCharacterIdRef,
  t,
}: UseTableVoiceOptions) {
  const savedSettings = loadVoiceSettings()

  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Голос выключен')
  const [voiceMasterVolume, setVoiceMasterVolume] = useState(savedSettings.masterVolume)
  const [voiceQuality, setVoiceQuality] = useState<VoiceQuality>(savedSettings.quality)
  const [voiceNoiseSuppression, setVoiceNoiseSuppression] = useState<VoiceNoiseSuppression>(savedSettings.noiseSuppression)
  const [voiceInputDeviceId, setVoiceInputDeviceId] = useState<string | null>(savedSettings.inputDeviceId)
  const [voiceOutputDeviceId, setVoiceOutputDeviceId] = useState<string | null>(savedSettings.outputDeviceId)
  const [voiceDevices, setVoiceDevices] = useState<VoiceDeviceInfo[]>([])
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([])

  const handleVoiceSignalRef = useRef<((signal: VoiceSignal) => void | Promise<void>) | null>(null)
  const voiceEnabledRef = useRef(false)
  const voiceMutedRef = useRef(false)
  const voiceQualityRef = useRef<VoiceQuality>(savedSettings.quality)
  const voiceNoiseSuppressionRef = useRef<VoiceNoiseSuppression>(savedSettings.noiseSuppression)
  const voiceInputDeviceIdRef = useRef<string | null>(savedSettings.inputDeviceId)
  const voiceOutputDeviceIdRef = useRef<string | null>(savedSettings.outputDeviceId)
  const voiceParticipantsRef = useRef<VoiceParticipant[]>([])
  const voiceMasterVolumeRef = useRef(savedSettings.masterVolume)
  const localVoiceStreamRef = useRef<MediaStream | null>(null)
  const voicePipelineRef = useRef<VoiceAudioPipeline | null>(null)
  const voiceDuckingRef = useRef<VoiceDuckingMonitor | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const voiceAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map())
  const reconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // ICE-кандидаты, пришедшие до setRemoteDescription, копим и применяем позже
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  // TURN-креды с сервера (/api/turn-credentials); null — ещё не запрашивали
  const voiceIceServersRef = useRef<{ servers: RTCIceServer[]; fetchedAt: number } | null>(null)

  const persistVoiceSettings = useCallback(() => {
    saveVoiceSettings({
      quality: voiceQualityRef.current,
      noiseSuppression: voiceNoiseSuppressionRef.current,
      inputDeviceId: voiceInputDeviceIdRef.current,
      outputDeviceId: voiceOutputDeviceIdRef.current,
      masterVolume: voiceMasterVolumeRef.current,
    })
  }, [])

  const refreshVoiceDevices = useCallback(async () => {
    try {
      const devices = await enumerateVoiceDevices()
      setVoiceDevices(devices)
      return devices
    } catch (error) {
      console.warn('Не удалось получить список аудиоустройств:', error)
      return []
    }
  }, [])

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled
  }, [voiceEnabled])

  useEffect(() => {
    voiceMutedRef.current = voiceMuted
  }, [voiceMuted])

  useEffect(() => {
    voiceQualityRef.current = voiceQuality
    persistVoiceSettings()
  }, [voiceQuality, persistVoiceSettings])

  useEffect(() => {
    voiceNoiseSuppressionRef.current = voiceNoiseSuppression
    persistVoiceSettings()
  }, [voiceNoiseSuppression, persistVoiceSettings])

  useEffect(() => {
    voiceInputDeviceIdRef.current = voiceInputDeviceId
    persistVoiceSettings()
  }, [voiceInputDeviceId, persistVoiceSettings])

  useEffect(() => {
    voiceOutputDeviceIdRef.current = voiceOutputDeviceId
    persistVoiceSettings()
    voiceAudioRefs.current.forEach(audio => {
      void applyAudioOutputDevice(audio, voiceOutputDeviceId)
    })
  }, [voiceOutputDeviceId, persistVoiceSettings])

  useEffect(() => {
    voiceMasterVolumeRef.current = voiceMasterVolume
    persistVoiceSettings()
  }, [voiceMasterVolume, persistVoiceSettings])

  useEffect(() => {
    voiceParticipantsRef.current = voiceParticipants
    voiceParticipants.forEach(participant => {
      const audio = voiceAudioRefs.current.get(participant.id)
      if (audio) {
        audio.volume = Math.max(0, Math.min(1, participant.volume * voiceMasterVolume))
      }
    })
  }, [voiceParticipants, voiceMasterVolume])

  useEffect(() => {
    void refreshVoiceDevices()

    const onDeviceChange = () => {
      void refreshVoiceDevices()
    }

    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
  }, [refreshVoiceDevices])

  const getVoiceIdentity = () => {
    const user = chatUserRef.current
    const character = chatCharactersRef.current.find(item => item.id === selectedChatCharacterIdRef.current)
    if (!user || !character || character.hydrated === false) return null
    return {
      id: user.id,
      username: user.username,
      characterName: character.name,
      characterImage: character.image,
    }
  }

  const upsertVoiceParticipant = (signal: VoiceSignal, patch: Partial<VoiceParticipant> = {}) => {
    if (!signal.from || signal.from === chatUserRef.current?.id) return
    setVoiceParticipants(prev => {
      const existing = prev.find(item => item.id === signal.from)
      const base: VoiceParticipant = {
        id: signal.from,
        username: signal.username || existing?.username || t('Участник'),
        characterName: signal.characterName || existing?.characterName || t('Безымянный'),
        characterImage: signal.characterImage ?? existing?.characterImage ?? '',
        volume: existing?.volume ?? getSavedVoiceVolume(signal.from),
        muted: signal.muted ?? existing?.muted ?? false,
        connected: existing?.connected ?? false,
        speaking: signal.speaking ?? existing?.speaking ?? false,
        connectionQuality: existing?.connectionQuality ?? 'unknown',
      }
      const next = { ...base, ...patch }
      return existing ? prev.map(item => (item.id === signal.from ? next : item)) : [...prev, next]
    })
  }

  const clearReconnectTimer = (participantId: string) => {
    const timer = reconnectTimersRef.current.get(participantId)
    if (timer) {
      clearTimeout(timer)
      reconnectTimersRef.current.delete(participantId)
    }
  }

  const flushPendingIceCandidates = async (participantId: string, connection: RTCPeerConnection) => {
    const queue = pendingIceCandidatesRef.current.get(participantId)
    if (!queue?.length) return
    pendingIceCandidatesRef.current.delete(participantId)
    for (const candidate of queue) {
      try {
        await connection.addIceCandidate(candidate)
      } catch (error) {
        console.warn('Не удалось применить отложенный ICE-кандидат:', error)
      }
    }
  }

  // TURN-креды краткоживущие: обновляем не реже раза в 12 часов
  const TURN_REFRESH_MS = 12 * 60 * 60 * 1000

  const ensureVoiceIceServers = async () => {
    const cached = voiceIceServersRef.current
    if (cached && Date.now() - cached.fetchedAt < TURN_REFRESH_MS) return
    try {
      const res = await fetch('/api/turn-credentials', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json() as { iceServers?: RTCIceServer | RTCIceServer[] | null }
      const extra = Array.isArray(data?.iceServers)
        ? data.iceServers
        : data?.iceServers?.urls ? [data.iceServers] : []
      if (extra.length) {
        voiceIceServersRef.current = {
          servers: [...getVoiceIceServers(), ...extra],
          fetchedAt: Date.now(),
        }
      }
    } catch (error) {
      console.warn('TURN-креды недоступны, используем только STUN:', error)
    }
  }

  const removeVoiceParticipant = (participantId: string) => {
    clearReconnectTimer(participantId)
    reconnectAttemptsRef.current.delete(participantId)
    pendingIceCandidatesRef.current.delete(participantId)
    voiceDuckingRef.current?.detachRemoteStream(participantId)

    const connection = peerConnectionsRef.current.get(participantId)
    connection?.close()
    peerConnectionsRef.current.delete(participantId)
    remoteStreamsRef.current.delete(participantId)
    voiceAudioRefs.current.delete(participantId)
    setVoiceParticipants(prev => prev.filter(item => item.id !== participantId))
  }

  const setVoiceParticipantVolume = (participantId: string, volume: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume))
    window.localStorage.setItem(`vtm-voice-volume:${participantId}`, String(nextVolume))
    setVoiceParticipants(prev => prev.map(item => (item.id === participantId ? { ...item, volume: nextVolume } : item)))
  }

  const broadcastVoiceSignal = (signal: Omit<VoiceSignal, 'room' | 'from'>) => {
    const identity = getVoiceIdentity()
    if (!identity) return
    broadcast('voice-signal', {
      ...signal,
      room: roomRef.current,
      from: identity.id,
      username: identity.username,
      characterName: identity.characterName,
      characterImage: identity.characterImage,
      muted: voiceMutedRef.current,
    })
  }

  const attachRemoteStream = (participantId: string, stream: MediaStream) => {
    remoteStreamsRef.current.set(participantId, stream)
    voiceDuckingRef.current?.attachRemoteStream(participantId, stream)
    const audio = voiceAudioRefs.current.get(participantId)
    if (audio) {
      audio.srcObject = stream
      audio.volume = Math.max(0, Math.min(1, (
        voiceParticipantsRef.current.find(item => item.id === participantId)?.volume ?? 1
      ) * voiceMasterVolumeRef.current))
      void applyAudioOutputDevice(audio, voiceOutputDeviceIdRef.current)
      audio.play().catch(() => setVoiceStatus('Нажми на страницу, если браузер заблокировал звук'))
    }
  }

  const schedulePeerReconnect = (participantId: string) => {
    if (!voiceEnabledRef.current) return

    const attempts = reconnectAttemptsRef.current.get(participantId) ?? 0
    if (attempts >= RECONNECT_MAX_ATTEMPTS) {
      setVoiceStatus('Не удалось восстановить голосовое соединение')
      return
    }

    clearReconnectTimer(participantId)
    const delay = RECONNECT_BASE_MS * (attempts + 1)
    reconnectAttemptsRef.current.set(participantId, attempts + 1)
    setVoiceStatus('Переподключение голоса...')

    const timer = setTimeout(() => {
      reconnectTimersRef.current.delete(participantId)
      void reconnectVoicePeer(participantId)
    }, delay)
    reconnectTimersRef.current.set(participantId, timer)
  }

  const reconnectVoicePeer = async (participantId: string) => {
    const existing = peerConnectionsRef.current.get(participantId)
    existing?.close()
    peerConnectionsRef.current.delete(participantId)

    try {
      const connection = await createVoicePeer(participantId, true, true)
      if (connection.connectionState === 'connected') {
        reconnectAttemptsRef.current.delete(participantId)
        setVoiceStatus('Голос онлайн')
      }
    } catch (error) {
      console.error('Не удалось переподключить голосового участника:', error)
      schedulePeerReconnect(participantId)
    }
  }

  const createVoicePeer = async (
    participantId: string,
    offerAfterCreate: boolean,
    iceRestart = false,
  ) => {
    const existing = peerConnectionsRef.current.get(participantId)
    if (existing && existing.connectionState !== 'closed' && !iceRestart) return existing
    if (existing) {
      existing.close()
      peerConnectionsRef.current.delete(participantId)
    }

    await ensureVoiceIceServers()
    const connection = new RTCPeerConnection({
      iceServers: voiceIceServersRef.current?.servers ?? getVoiceIceServers(),
      iceTransportPolicy: 'all',
    })

    peerConnectionsRef.current.set(participantId, connection)
    localVoiceStreamRef.current?.getTracks().forEach(track => {
      const stream = localVoiceStreamRef.current
      if (stream) {
        void tuneVoiceSender(connection.addTrack(track, stream), voiceQualityRef.current)
      }
    })

    connection.onicecandidate = event => {
      if (!event.candidate) return
      broadcastVoiceSignal({
        type: 'ice',
        to: participantId,
        candidate: event.candidate.toJSON(),
      })
    }

    connection.ontrack = event => {
      const [stream] = event.streams
      if (stream) attachRemoteStream(participantId, stream)
      upsertVoiceParticipant({ type: 'join', room: roomRef.current, from: participantId }, { connected: true })
    }

    connection.oniceconnectionstatechange = () => {
      const quality = mapIceConnectionQuality(connection.iceConnectionState)
      setVoiceParticipants(prev => prev.map(item => (
        item.id === participantId ? { ...item, connectionQuality: quality } : item
      )))
    }

    connection.onconnectionstatechange = () => {
      const connected = connection.connectionState === 'connected'
      const failed = connection.connectionState === 'failed'
        || connection.connectionState === 'closed'
        || connection.connectionState === 'disconnected'

      setVoiceParticipants(prev => prev.map(item => (
        item.id === participantId ? { ...item, connected: connected || (!failed && item.connected) } : item
      )))

      if (connected) {
        reconnectAttemptsRef.current.delete(participantId)
        setVoiceStatus('Голос онлайн')
        return
      }

      if (failed) {
        setVoiceStatus('Кто-то отключился от голоса')
        schedulePeerReconnect(participantId)
      }
    }

    if (offerAfterCreate) {
      const offer = await connection.createOffer({ iceRestart })
      await connection.setLocalDescription(enhanceVoiceDescription(offer, voiceQualityRef.current))
      broadcastVoiceSignal({
        type: 'offer',
        to: participantId,
        description: connection.localDescription?.toJSON(),
      })
    }

    return connection
  }

  const handleVoiceSignal = async (signal: VoiceSignal) => {
    const currentUser = chatUserRef.current
    if (!signal || signal.room !== roomRef.current || !signal.from || signal.from === currentUser?.id) return

    if (signal.to && signal.to !== currentUser?.id) return

    if (signal.type === 'leave') {
      removeVoiceParticipant(signal.from)
      return
    }

    if (signal.type === 'mute') {
      upsertVoiceParticipant(signal, { muted: Boolean(signal.muted) })
      return
    }

    upsertVoiceParticipant(signal)

    if (!voiceEnabledRef.current || !currentUser) return

    try {
      if (signal.type === 'join') {
        await createVoicePeer(signal.from, true)
        return
      }

      if (signal.type === 'offer' && signal.description) {
        const connection = await createVoicePeer(signal.from, false)
        await connection.setRemoteDescription(signal.description)
        await flushPendingIceCandidates(signal.from, connection)
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(enhanceVoiceDescription(answer, voiceQualityRef.current))
        broadcastVoiceSignal({
          type: 'answer',
          to: signal.from,
          description: connection.localDescription?.toJSON(),
        })
        return
      }

      if (signal.type === 'answer' && signal.description) {
        const connection = peerConnectionsRef.current.get(signal.from)
        if (connection && connection.signalingState !== 'stable') {
          await connection.setRemoteDescription(signal.description)
          await flushPendingIceCandidates(signal.from, connection)
        }
        return
      }

      if (signal.type === 'ice' && signal.candidate) {
        const connection = peerConnectionsRef.current.get(signal.from)
        if (connection?.remoteDescription) {
          await connection.addIceCandidate(signal.candidate)
        } else {
          // remote description ещё не установлена — откладываем кандидата
          const queue = pendingIceCandidatesRef.current.get(signal.from) ?? []
          queue.push(signal.candidate)
          pendingIceCandidatesRef.current.set(signal.from, queue)
        }
      }
    } catch (error) {
      console.error('Не удалось обработать голосовой сигнал:', error)
      setVoiceStatus('Голос не смог соединиться')
    }
  }
  handleVoiceSignalRef.current = handleVoiceSignal

  const destroyVoicePipeline = () => {
    voiceDuckingRef.current?.destroy()
    voiceDuckingRef.current = null
    voicePipelineRef.current?.destroy()
    voicePipelineRef.current = null
    localVoiceStreamRef.current = null
  }

  const setupLocalVoiceCapture = async () => {
    voiceDuckingRef.current?.destroy()
    voiceDuckingRef.current = null
    voicePipelineRef.current?.destroy()
    voicePipelineRef.current = null
    localVoiceStreamRef.current = null

    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: getVoiceAudioConstraints(voiceQualityRef.current, {
        deviceId: voiceInputDeviceIdRef.current,
        noiseSuppression: voiceNoiseSuppressionRef.current,
      }),
    })

    const pipeline = createVoiceAudioPipeline(rawStream, voiceQualityRef.current)
    voicePipelineRef.current = pipeline
    localVoiceStreamRef.current = pipeline.processedStream

    localVoiceStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !voiceMutedRef.current
    })

    voiceDuckingRef.current = createVoiceDuckingMonitor(rawStream)

    remoteStreamsRef.current.forEach((stream, participantId) => {
      voiceDuckingRef.current?.attachRemoteStream(participantId, stream)
    })

    return localVoiceStreamRef.current
  }

  const replaceLocalVoiceTrack = async () => {
    if (!voiceEnabledRef.current) return

    const stream = await setupLocalVoiceCapture()
    const peerEntries = [...peerConnectionsRef.current.entries()]
    await Promise.all(peerEntries.map(async ([participantId, connection]) => {
      const sender = connection.getSenders().find(item => item.track?.kind === 'audio')
      const [track] = stream.getAudioTracks()
      if (sender && track) {
        await sender.replaceTrack(track)
        await tuneVoiceSender(sender, voiceQualityRef.current)
        return
      }

      connection.close()
      peerConnectionsRef.current.delete(participantId)
      await createVoicePeer(participantId, true, true)
    }))
  }

  const stopVoice = () => {
    const wasEnabled = voiceEnabledRef.current
    if (wasEnabled) broadcastVoiceSignal({ type: 'leave' })

    reconnectTimersRef.current.forEach(timer => clearTimeout(timer))
    reconnectTimersRef.current.clear()
    reconnectAttemptsRef.current.clear()

    voiceEnabledRef.current = false
    peerConnectionsRef.current.forEach(connection => connection.close())
    peerConnectionsRef.current.clear()
    pendingIceCandidatesRef.current.clear()
    remoteStreamsRef.current.clear()
    voiceAudioRefs.current.clear()
    destroyVoicePipeline()
    setVoiceEnabled(false)
    setVoiceParticipants([])
    setVoiceStatus('Голос выключен')
  }

  const startVoice = async () => {
    const identity = getVoiceIdentity()
    if (!chatUserRef.current) {
      window.alert(t('Сначала войди в аккаунт.'))
      return
    }
    if (!identity) {
      window.alert(t('Выбери персонажа для голоса.'))
      return
    }

    try {
      await refreshVoiceDevices()
      await setupLocalVoiceCapture()
      await ensureVoiceIceServers()
      voiceEnabledRef.current = true
      setVoiceEnabled(true)
      setVoiceStatus('Голос онлайн')
      broadcastVoiceSignal({ type: 'join' })
    } catch (error) {
      console.error('Микрофон недоступен:', error)
      setVoiceStatus('Микрофон недоступен')
      window.alert(t('Не получилось включить микрофон. Проверь разрешение браузера.'))
    }
  }

  const toggleVoiceMuted = () => {
    const nextMuted = !voiceMutedRef.current
    localVoiceStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted
    })
    setVoiceMuted(nextMuted)
    voiceMutedRef.current = nextMuted
    if (voiceEnabledRef.current) broadcastVoiceSignal({ type: 'mute', muted: nextMuted })
  }

  const selectVoiceInputDevice = async (deviceId: string | null) => {
    setVoiceInputDeviceId(deviceId)
    voiceInputDeviceIdRef.current = deviceId
    if (voiceEnabledRef.current) {
      try {
        await replaceLocalVoiceTrack()
        broadcastVoiceSignal({ type: 'device-change' })
      } catch (error) {
        console.error('Не удалось переключить микрофон:', error)
        setVoiceStatus('Микрофон недоступен')
      }
    }
  }

  const selectVoiceOutputDevice = async (deviceId: string | null) => {
    setVoiceOutputDeviceId(deviceId)
    voiceOutputDeviceIdRef.current = deviceId
    await Promise.all([...voiceAudioRefs.current.values()].map(audio => applyAudioOutputDevice(audio, deviceId)))
  }

  const updateVoiceQuality = async (quality: VoiceQuality) => {
    setVoiceQuality(quality)
    voiceQualityRef.current = quality
    if (voiceEnabledRef.current) {
      try {
        await replaceLocalVoiceTrack()
      } catch (error) {
        console.error('Не удалось применить качество голоса:', error)
        setVoiceStatus('Микрофон недоступен')
      }
    }
  }

  const updateVoiceNoiseSuppression = async (mode: VoiceNoiseSuppression) => {
    setVoiceNoiseSuppression(mode)
    voiceNoiseSuppressionRef.current = mode
    if (voiceEnabledRef.current) {
      try {
        await replaceLocalVoiceTrack()
      } catch (error) {
        console.error('Не удалось применить шумоподавление:', error)
        setVoiceStatus('Микрофон недоступен')
      }
    }
  }

  useEffect(() => () => stopVoice(), [])

  return {
    voiceEnabled,
    voiceMuted,
    voiceStatus,
    voiceMasterVolume,
    voiceQuality,
    voiceNoiseSuppression,
    voiceInputDeviceId,
    voiceOutputDeviceId,
    voiceDevices,
    voiceParticipants,
    voiceAudioRefs,
    remoteStreamsRef,
    handleVoiceSignalRef,
    setVoiceMasterVolume,
    setVoiceQuality: updateVoiceQuality,
    setVoiceNoiseSuppression: updateVoiceNoiseSuppression,
    selectVoiceInputDevice,
    selectVoiceOutputDevice,
    refreshVoiceDevices,
    setVoiceStatus,
    setVoiceParticipantVolume,
    startVoice,
    stopVoice,
    toggleVoiceMuted,
  }
}
