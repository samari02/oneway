import { useEffect, useRef } from 'react'

type UseMorningAmbientAudioOptions = {
  enabled?: boolean
  volume?: number
  loop?: boolean
}

export function useMorningAmbientAudio(
  src: string,
  { enabled = true, volume = 0.35, loop = true }: UseMorningAmbientAudioOptions = {},
) {
  const startedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !src.trim()) return

    const audio = new Audio(src)
    audio.loop = loop
    audio.volume = volume

    let cancelled = false

    const tryPlay = async () => {
      if (cancelled || startedRef.current) return

      try {
        await audio.play()
        if (!cancelled) startedRef.current = true
      } catch (err) {
        // Autoplay blocked or missing asset — retry after the next user gesture.
        if (err instanceof DOMException && err.name === 'NotAllowedError') return
        console.warn('[MorningFlow] Ambient audio failed to play:', err)
      }
    }

    void tryPlay()

    const onInteraction = () => {
      void tryPlay()
    }

    document.addEventListener('pointerdown', onInteraction)
    document.addEventListener('keydown', onInteraction)

    return () => {
      cancelled = true
      document.removeEventListener('pointerdown', onInteraction)
      document.removeEventListener('keydown', onInteraction)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      startedRef.current = false
    }
  }, [enabled, loop, src, volume])
}
