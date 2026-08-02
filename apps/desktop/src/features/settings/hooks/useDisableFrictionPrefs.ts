import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'clarity-disable-friction-secs'

/** Allowed cooldown durations (seconds). Default 30. */
export const DISABLE_FRICTION_OPTIONS = [15, 30, 60] as const
export type DisableFrictionSecs = (typeof DISABLE_FRICTION_OPTIONS)[number]
export const DEFAULT_DISABLE_FRICTION_SECS: DisableFrictionSecs = 30

export const DISABLE_CONFIRM_PHRASE = 'DISABLE'

function parseSecs(raw: string | null): DisableFrictionSecs {
  const n = Number(raw)
  if (DISABLE_FRICTION_OPTIONS.includes(n as DisableFrictionSecs)) {
    return n as DisableFrictionSecs
  }
  return DEFAULT_DISABLE_FRICTION_SECS
}

export function readDisableFrictionSecs(): DisableFrictionSecs {
  try {
    return parseSecs(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_DISABLE_FRICTION_SECS
  }
}

export function writeDisableFrictionSecs(secs: DisableFrictionSecs): void {
  localStorage.setItem(STORAGE_KEY, String(secs))
}

interface UseDisableFrictionPrefsResult {
  durationSecs: DisableFrictionSecs
  setDurationSecs: (secs: DisableFrictionSecs) => void
}

export function useDisableFrictionPrefs(): UseDisableFrictionPrefsResult {
  const [durationSecs, setDurationSecsState] = useState<DisableFrictionSecs>(DEFAULT_DISABLE_FRICTION_SECS)

  useEffect(() => {
    setDurationSecsState(readDisableFrictionSecs())
  }, [])

  const setDurationSecs = useCallback((secs: DisableFrictionSecs) => {
    writeDisableFrictionSecs(secs)
    setDurationSecsState(secs)
  }, [])

  return { durationSecs, setDurationSecs }
}
