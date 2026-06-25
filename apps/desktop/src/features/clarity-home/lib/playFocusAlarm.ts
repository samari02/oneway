/** Short alarm using Web Audio — no asset files required. */
export function playFocusAlarm() {
  try {
    const ctx = new AudioContext()
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
      void ctx.close()
    }, 2000)
  } catch {
    // Audio may be unavailable in some environments.
  }
}
