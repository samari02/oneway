import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hasApiKey, transcribeAudio } from '@/lib/openai'

type SpeechRecognitionCtor = new () => SpeechRecognition
type SpeechEngine = 'webspeech' | 'whisper' | null

function isRunningInTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  // Web Speech API triggers macOS TCC SpeechRecognition check which sends SIGABRT
  // if the binary lacks a bundled Info.plist (always the case in tauri dev, unreliable in prod).
  if (isRunningInTauri()) return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function canUseMediaRecorder(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

function resolveSpeechLang(explicit?: string): string {
  if (explicit) return explicit
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
  if (locale.toLowerCase().startsWith('fr')) return 'fr-FR'
  return 'en-US'
}

export const OPENAI_KEY_SETTINGS_HINT =
  'Add your OpenAI API key in Settings → AI Features (sidebar), then try again.'

function mapTranscriptionError(err: unknown): string | null {
  if (!(err instanceof Error)) {
    return 'Could not transcribe your voice. Try again or keep typing.'
  }

  switch (err.message) {
    case 'No API key configured':
      return OPENAI_KEY_SETTINGS_HINT
    case 'Invalid API key':
      return 'Your OpenAI API key looks invalid. Update it in Settings → AI Features.'
    case 'Network error':
      return 'Voice input needs a network connection. You can keep typing.'
    case 'Empty audio':
    case 'No speech detected':
      return 'No speech detected. Speak a bit longer, then tap Stop.'
    default:
      if (err.message && err.message !== 'Failed to transcribe audio') {
        return err.message
      }
      return 'Could not transcribe your voice. Try again or keep typing.'
  }
}

function mapSpeechError(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech access denied. Allow Clarity in System Settings → Privacy → Microphone and Speech Recognition.'
    case 'audio-capture':
      return 'Could not access the microphone. Check that another app is not using it.'
    case 'network':
      return 'Voice input needs a network connection. You can keep typing.'
    case 'no-speech':
      return ''
    case 'aborted':
      return ''
    default:
      return 'Voice input unavailable. You can keep typing.'
  }
}

async function requestMicrophoneAccess(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, message: 'Voice input is not available in this environment.' }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return { ok: true }
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        ok: false,
        message:
          'Microphone access denied. Allow Clarity in System Settings → Privacy → Microphone.',
      }
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, message: 'No microphone found. Connect one or keep typing.' }
    }
    return { ok: false, message: 'Could not access the microphone. You can keep typing.' }
  }
}

function pickRecorderMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

export type UseSpeechRecognitionOptions = {
  onTranscript: (text: string, isFinal: boolean) => void
  lang?: string
}

export function useSpeechRecognition({ onTranscript, lang }: UseSpeechRecognitionOptions) {
  const hasWebSpeech = useMemo(() => getSpeechRecognitionCtor() !== null, [])
  const canRecord = useMemo(() => canUseMediaRecorder(), [])
  const isTauri = useMemo(() => isRunningInTauri(), [])
  const isSupported = hasWebSpeech || canRecord

  const [isListening, setIsListening] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaChunksRef = useRef<Blob[]>([])
  const engineRef = useRef<SpeechEngine>(null)
  const preferWhisperRef = useRef(false)
  const listeningRef = useRef(false)
  const startingRef = useRef(false)
  const onTranscriptRef = useRef(onTranscript)
  const startWebSpeechRef = useRef<(() => boolean) | null>(null)
  const startWhisperRecordingRef = useRef<(() => Promise<boolean>) | null>(null)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const resolvedLang = resolveSpeechLang(lang)

  const cleanupMedia = useCallback(() => {
    mediaRecorderRef.current = null
    mediaChunksRef.current = []
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }, [])

  const stopWebSpeech = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const stopWhisperRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      cleanupMedia()
      return
    }

    setIsTranscribing(true)

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          void (async () => {
            try {
              const mimeType = recorder.mimeType || pickRecorderMimeType() || 'audio/webm'
              const blob = new Blob(mediaChunksRef.current, { type: mimeType })
              console.info(
                '[useSpeechRecognition] Transcribing audio blob:',
                blob.size,
                'bytes, type:',
                blob.type || mimeType,
              )
              const text = await transcribeAudio(blob, resolvedLang)
              onTranscriptRef.current(text, true)
            } catch (err) {
              console.error('[useSpeechRecognition] Whisper transcription failed:', err)
              const message = mapTranscriptionError(err)
              if (message) setError(message)
            } finally {
              setIsTranscribing(false)
              cleanupMedia()
              resolve()
            }
          })()
        },
        { once: true },
      )
      if (typeof recorder.requestData === 'function') {
        recorder.requestData()
      }
      recorder.stop()
    })
  }, [cleanupMedia, resolvedLang])

  const stop = useCallback(() => {
    listeningRef.current = false
    setIsListening(false)
    engineRef.current = null

    if (recognitionRef.current) {
      stopWebSpeech()
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      void stopWhisperRecording()
      return
    }

    cleanupMedia()
  }, [cleanupMedia, stopWebSpeech, stopWhisperRecording])

  const startWebSpeech = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return false

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = resolvedLang
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (!text) continue
        if (result.isFinal) {
          onTranscriptRef.current(text, true)
        } else {
          interim += text
        }
      }
      if (interim) {
        onTranscriptRef.current(interim, false)
      }
    }

    recognition.onerror = (event) => {
      // Browser ends the session after silence (~5s) with no-speech; onend restarts if still listening.
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return
      }

      const message = mapSpeechError(event.error)
      if (
        !preferWhisperRef.current &&
        canUseMediaRecorder() &&
        hasApiKey() &&
        (event.error === 'service-not-allowed' || event.error === 'network')
      ) {
        preferWhisperRef.current = true
        recognitionRef.current = null
        listeningRef.current = false
        setIsListening(false)
        void startWhisperRecordingRef.current?.()
        return
      }

      if (message) setError(message)
      listeningRef.current = false
      setIsListening(false)
      recognitionRef.current = null
      engineRef.current = null
    }

    recognition.onend = () => {
      if (engineRef.current !== 'webspeech') return

      recognitionRef.current = null

      if (listeningRef.current) {
        window.setTimeout(() => {
          if (!listeningRef.current || engineRef.current !== 'webspeech') return
          startWebSpeechRef.current?.()
        }, 50)
        return
      }

      setIsListening(false)
      engineRef.current = null
    }

    recognitionRef.current = recognition
    engineRef.current = 'webspeech'
    listeningRef.current = true
    setIsListening(true)

    try {
      recognition.start()
      return true
    } catch {
      recognitionRef.current = null
      engineRef.current = null
      listeningRef.current = false
      setIsListening(false)
      return false
    }
  }, [resolvedLang])

  const startWhisperRecording = useCallback(async () => {
    if (!canUseMediaRecorder()) {
      setError('Voice input is not available in this environment.')
      return false
    }

    if (!hasApiKey()) {
      setError(OPENAI_KEY_SETTINGS_HINT)
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      mediaChunksRef.current = []

      stream.getTracks().forEach((track) => {
        track.onended = () => {
          console.warn('[useSpeechRecognition] Microphone track ended unexpectedly')
          if (listeningRef.current && engineRef.current === 'whisper') {
            listeningRef.current = false
            setIsListening(false)
            engineRef.current = null
            cleanupMedia()
          }
        }
      })

      const mimeType = pickRecorderMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data)
        }
      }
      recorder.onerror = (event) => {
        console.error('[useSpeechRecognition] MediaRecorder error:', event)
        if (listeningRef.current && engineRef.current === 'whisper') {
          listeningRef.current = false
          setIsListening(false)
          engineRef.current = null
          setError('Could not record audio. Try again or keep typing.')
          cleanupMedia()
        }
      }

      mediaRecorderRef.current = recorder
      engineRef.current = 'whisper'
      listeningRef.current = true
      setIsListening(true)
      recorder.start(250)
      return true
    } catch (err) {
      console.error('[useSpeechRecognition] Failed to start MediaRecorder:', err)
      cleanupMedia()
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone access denied. Allow Clarity in System Settings → Privacy → Microphone.')
      } else {
        setError('Could not start voice input. Try again or keep typing.')
      }
      return false
    }
  }, [cleanupMedia])

  useEffect(() => {
    startWebSpeechRef.current = startWebSpeech
    startWhisperRecordingRef.current = startWhisperRecording
  }, [startWebSpeech, startWhisperRecording])

  const start = useCallback(async () => {
    if (startingRef.current || listeningRef.current) return

    startingRef.current = true
    setIsStarting(true)
    setError(null)

    try {
      const whisperAvailable = canRecord && hasApiKey()
      const useWhisper = preferWhisperRef.current || (!hasWebSpeech && (whisperAvailable || isTauri))

      // Whisper acquires the mic once inside startWhisperRecording — skip preflight getUserMedia.
      if (useWhisper) {
        await startWhisperRecording()
        return
      }

      const mic = await requestMicrophoneAccess()
      if (!mic.ok) {
        setError(mic.message)
        return
      }

      if (hasWebSpeech) {
        const started = startWebSpeech()
        if (started) return
        if (whisperAvailable) {
          preferWhisperRef.current = true
          await startWhisperRecording()
          return
        }
        setError('Could not start voice input. Try again.')
        return
      }

      if (whisperAvailable) {
        await startWhisperRecording()
        return
      }

      if (isTauri && canRecord && !hasApiKey()) {
        setError(OPENAI_KEY_SETTINGS_HINT)
        return
      }

      setError('Voice input is not available in this environment.')
    } finally {
      startingRef.current = false
      setIsStarting(false)
    }
  }, [canRecord, hasWebSpeech, isTauri, startWebSpeech, startWhisperRecording])

  const toggle = useCallback(() => {
    if (listeningRef.current) {
      stop()
    } else if (!startingRef.current) {
      void start()
    }
  }, [start, stop])

  useEffect(() => {
    return () => {
      listeningRef.current = false
      recognitionRef.current?.abort()
      recognitionRef.current = null
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      cleanupMedia()
    }
  }, [cleanupMedia])

  return {
    isSupported,
    isListening,
    isStarting,
    isTranscribing,
    error,
    start,
    stop,
    toggle,
  }
}
