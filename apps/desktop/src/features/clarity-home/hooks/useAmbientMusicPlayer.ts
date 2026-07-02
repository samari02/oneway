import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { MORNING_AMBIENT_AUDIO_SRC } from '../companion-avatars'

export type AmbientTrack = {
  id: string
  name: string
  src: string
  builtin?: boolean
}

type PlayerState = {
  tracks: AmbientTrack[]
  currentTrackId: string
  isPlaying: boolean
  volume: number
  loop: boolean
}

const STORAGE_KEY = 'clarity-ambient-music-v1'
const PAUSED_STORAGE_KEY = 'clarity-ambient-paused'

const DEFAULT_TRACK: AmbientTrack = {
  id: 'default-morning',
  name: 'Peaceful morning',
  src: MORNING_AMBIENT_AUDIO_SRC,
  builtin: true,
}

const listeners = new Set<() => void>()

const WINDOW_AUDIO_KEY = '__clarityAmbientAudioElement'

type WindowWithAmbient = Window & { [WINDOW_AUDIO_KEY]?: HTMLAudioElement }

function getWindowAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  return (window as WindowWithAmbient)[WINDOW_AUDIO_KEY] ?? null
}

function setWindowAudio(element: HTMLAudioElement) {
  if (typeof window === 'undefined') return
  ;(window as WindowWithAmbient)[WINDOW_AUDIO_KEY] = element
}

let audio: HTMLAudioElement | null = getWindowAudio()
let gestureListenersAttached = false
let enabledRef = false
let enabledConsumerCount = 0

function loadUserPaused(): boolean {
  try {
    return localStorage.getItem(PAUSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function setUserPaused(paused: boolean) {
  userPaused = paused
  try {
    if (paused) {
      localStorage.setItem(PAUSED_STORAGE_KEY, 'true')
    } else {
      localStorage.removeItem(PAUSED_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

/** True when the user explicitly paused via play/pause controls. */
let userPaused = loadUserPaused()

function emitChange() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function loadPersistedState(): Pick<PlayerState, 'currentTrackId' | 'volume' | 'loop'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { currentTrackId: DEFAULT_TRACK.id, volume: 0.35, loop: true }
    }
    const parsed = JSON.parse(raw) as Partial<Pick<PlayerState, 'currentTrackId' | 'volume' | 'loop'>>
    return {
      currentTrackId: parsed.currentTrackId || DEFAULT_TRACK.id,
      volume: typeof parsed.volume === 'number' ? parsed.volume : 0.35,
      loop: parsed.loop !== false,
    }
  } catch {
    return { currentTrackId: DEFAULT_TRACK.id, volume: 0.35, loop: true }
  }
}

function createInitialState(): PlayerState {
  const persisted = loadPersistedState()
  return {
    tracks: [DEFAULT_TRACK],
    currentTrackId: persisted.currentTrackId,
    isPlaying: false,
    volume: persisted.volume,
    loop: persisted.loop,
  }
}

let state: PlayerState = createInitialState()

function persistPreferences() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      currentTrackId: state.currentTrackId,
      volume: state.volume,
      loop: state.loop,
    }),
  )
}

function getSnapshot(): PlayerState {
  return state
}

function getServerSnapshot(): PlayerState {
  return createInitialState()
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = getWindowAudio()
  }

  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
    setWindowAudio(audio)

    audio.addEventListener('play', () => {
      if (state.isPlaying) return
      state = { ...state, isPlaying: true }
      emitChange()
    })

    audio.addEventListener('pause', () => {
      if (!state.isPlaying) return
      state = { ...state, isPlaying: false }
      emitChange()
    })

    audio.addEventListener('ended', () => {
      if (state.loop) return
      state = { ...state, isPlaying: false }
      emitChange()
    })
  }

  return audio
}

function getCurrentTrack(): AmbientTrack {
  return state.tracks.find((track) => track.id === state.currentTrackId) ?? DEFAULT_TRACK
}

function sourcesMatch(currentSrc: string, nextSrc: string): boolean {
  if (!nextSrc) return !currentSrc
  if (currentSrc === nextSrc) return true

  try {
    return (
      new URL(currentSrc, window.location.origin).href ===
      new URL(nextSrc, window.location.origin).href
    )
  } catch {
    return false
  }
}

function syncAudioSource() {
  const element = getAudio()
  const track = getCurrentTrack()

  element.loop = state.loop
  element.volume = state.volume

  const currentSrc = element.currentSrc || element.src
  if (!sourcesMatch(currentSrc, track.src)) {
    const wasPlaying = !element.paused
    element.pause()
    element.src = track.src
    element.load()
    if (wasPlaying && enabledRef) {
      void element.play().catch(() => {})
    }
  }
}

type TryPlayOptions = {
  /** When true, only attempt playback if a mounted consumer opted into auto-play. */
  requireEnabled?: boolean
}

async function tryPlay({ requireEnabled = false }: TryPlayOptions = {}) {
  if (userPaused) return
  if (requireEnabled && !enabledRef) return

  syncAudioSource()
  const element = getAudio()

  if (!element.paused) return

  try {
    await element.play()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') return
    console.warn('[AmbientMusic] Playback failed:', err)
  }
}

function attachGestureRetry() {
  if (gestureListenersAttached) return
  gestureListenersAttached = true

  const onInteraction = () => {
    void tryPlay({ requireEnabled: true })
  }

  document.addEventListener('pointerdown', onInteraction)
  document.addEventListener('keydown', onInteraction)
}

function pausePlayback() {
  getAudio().pause()
}

function setEnabled(enabled: boolean) {
  if (enabled) {
    enabledConsumerCount += 1
    enabledRef = true
    attachGestureRetry()
    void tryPlay({ requireEnabled: true })
    return
  }

  enabledConsumerCount = Math.max(0, enabledConsumerCount - 1)
  enabledRef = enabledConsumerCount > 0
  if (enabledConsumerCount === 0) {
    pausePlayback()
  }
}

function selectTrack(trackId: string) {
  if (!state.tracks.some((track) => track.id === trackId)) return

  state = { ...state, currentTrackId: trackId }
  persistPreferences()
  emitChange()
  syncAudioSource()

  void tryPlay()
}

function addTrackFromFile(file: File): AmbientTrack | null {
  if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(file.name)) {
    return null
  }

  const track: AmbientTrack = {
    id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name.replace(/\.[^.]+$/, ''),
    src: URL.createObjectURL(file),
  }

  state = {
    ...state,
    tracks: [...state.tracks, track],
    currentTrackId: track.id,
  }
  persistPreferences()
  emitChange()
  syncAudioSource()

  void tryPlay()

  return track
}

function togglePlay() {
  const element = getAudio()

  if (element.paused) {
    setUserPaused(false)
    void tryPlay()
  } else {
    setUserPaused(true)
    element.pause()
  }
}

function removeCustomTrack(trackId: string) {
  const track = state.tracks.find((item) => item.id === trackId)
  if (!track || track.builtin) return

  if (track.src.startsWith('blob:')) {
    URL.revokeObjectURL(track.src)
  }

  const nextTracks = state.tracks.filter((item) => item.id !== trackId)
  const nextTrackId =
    state.currentTrackId === trackId
      ? nextTracks.find((item) => item.builtin)?.id ?? DEFAULT_TRACK.id
      : state.currentTrackId

  state = {
    ...state,
    tracks: nextTracks,
    currentTrackId: nextTrackId,
  }
  persistPreferences()
  emitChange()
  syncAudioSource()
}

type UseAmbientMusicPlayerOptions = {
  enabled?: boolean
}

export function useAmbientMusicPlayer({ enabled = true }: UseAmbientMusicPlayerOptions = {}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const currentTrack = snapshot.tracks.find((track) => track.id === snapshot.currentTrackId) ?? DEFAULT_TRACK

  useEffect(() => {
    if (!enabled) return
    setEnabled(true)
    return () => setEnabled(false)
  }, [enabled])

  useEffect(() => {
    syncAudioSource()
  }, [snapshot.currentTrackId, snapshot.loop, snapshot.volume])

  const selectTrackById = useCallback((trackId: string) => {
    selectTrack(trackId)
  }, [])

  const addTrack = useCallback((file: File) => addTrackFromFile(file), [])

  const removeTrack = useCallback((trackId: string) => {
    removeCustomTrack(trackId)
  }, [])

  const play = useCallback(() => {
    setUserPaused(false)
    void tryPlay()
  }, []) // manual play — not gated by enabledRef

  const pause = useCallback(() => {
    setUserPaused(true)
    pausePlayback()
  }, [])

  const toggle = useCallback(() => {
    togglePlay()
  }, [])

  return {
    tracks: snapshot.tracks,
    currentTrack,
    isPlaying: snapshot.isPlaying,
    selectTrack: selectTrackById,
    addTrack,
    removeTrack,
    play,
    pause,
    toggle,
  }
}

/** @deprecated Use useAmbientMusicPlayer instead */
export function useMorningAmbientAudio(
  src: string,
  { enabled = true, volume = 0.35, loop = true }: { enabled?: boolean; volume?: number; loop?: boolean } = {},
) {
  useEffect(() => {
    state = { ...state, volume, loop }
    if (state.tracks[0]?.id === DEFAULT_TRACK.id) {
      state = {
        ...state,
        tracks: [{ ...DEFAULT_TRACK, src }, ...state.tracks.slice(1)],
      }
    }
    persistPreferences()
    syncAudioSource()
  }, [src, volume, loop])

  return useAmbientMusicPlayer({ enabled })
}
