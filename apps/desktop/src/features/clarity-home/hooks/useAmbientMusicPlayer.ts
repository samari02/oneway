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

const DEFAULT_TRACK: AmbientTrack = {
  id: 'default-morning',
  name: 'Peaceful morning',
  src: MORNING_AMBIENT_AUDIO_SRC,
  builtin: true,
}

const listeners = new Set<() => void>()

let audio: HTMLAudioElement | null = null
let gestureListenersAttached = false
let enabledRef = false

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
    audio = new Audio()
    audio.preload = 'auto'

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

async function tryPlay() {
  if (!enabledRef) return

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
    void tryPlay()
  }

  document.addEventListener('pointerdown', onInteraction)
  document.addEventListener('keydown', onInteraction)
}

function pausePlayback() {
  getAudio().pause()
}

function setEnabled(enabled: boolean) {
  enabledRef = enabled
  if (enabled) {
    attachGestureRetry()
    void tryPlay()
  } else {
    pausePlayback()
  }
}

function selectTrack(trackId: string) {
  if (!state.tracks.some((track) => track.id === trackId)) return

  state = { ...state, currentTrackId: trackId }
  persistPreferences()
  emitChange()
  syncAudioSource()

  if (enabledRef) {
    void tryPlay()
  }
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

  if (enabledRef) {
    void tryPlay()
  }

  return track
}

function togglePlay() {
  const element = getAudio()

  if (element.paused) {
    void tryPlay()
  } else {
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
    setEnabled(enabled)
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
    void tryPlay()
  }, [])

  const pause = useCallback(() => {
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
