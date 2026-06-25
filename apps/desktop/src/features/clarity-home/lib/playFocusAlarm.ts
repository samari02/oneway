let sharedCtx: AudioContext | null = null

/** Call from a user gesture (e.g. Start focus) so completion beeps are allowed. */
export function prepareFocusAlarmAudio() {
  try {
    if (!sharedCtx) sharedCtx = new AudioContext()
    if (sharedCtx.state === 'suspended') {
      void sharedCtx.resume()
    }
  } catch {
    // Audio may be unavailable in some environments.
  }
}

/** Short alarm using Web Audio — no asset files required. */
export function playFocusAlarm() {
  try {
    if (!sharedCtx) sharedCtx = new AudioContext()
    const ctx = sharedCtx

    const run = () => {
      const playBeep = (startTime: number, frequency: number) => {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.frequency.value = frequency
        oscillator.type = 'sine'
        gain.gain.setValueAtTime(0.28, startTime)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.45)
        oscillator.start(startTime)
        oscillator.stop(startTime + 0.45)
      }

      const now = ctx.currentTime
      playBeep(now, 880)
      playBeep(now + 0.55, 880)
      playBeep(now + 1.1, 1100)

      window.setTimeout(() => {
        if (sharedCtx === ctx) {
          void ctx.close()
          sharedCtx = null
        }
      }, 2000)
    }

    if (ctx.state === 'suspended') {
      void ctx.resume().then(run)
    } else {
      run()
    }
  } catch {
    // Audio may be unavailable in some environments.
  }
}
