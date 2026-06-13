// Lightweight click feedback: a short synthesized "blip" via Web Audio plus
// device haptics. No audio assets needed — the tone is generated on the fly.

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  // Browsers start the context suspended until a user gesture resumes it.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

/**
 * Play a short, satisfying click tone. `pitch` lets boosted clicks get a
 * punchier sound. Safe to call rapidly — each click is its own short voice.
 */
export function playClickSound(pitch = 1): void {
  const audio = getContext()
  if (!audio) return

  const now = audio.currentTime
  const osc = audio.createOscillator()
  const gain = audio.createGain()

  osc.type = 'triangle'
  // Quick downward chirp gives a tactile "pop".
  osc.frequency.setValueAtTime(660 * pitch, now)
  osc.frequency.exponentialRampToValueAtTime(330 * pitch, now + 0.08)

  // Fast attack, short decay so rapid clicks stay crisp and don't muddy.
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.13)
}

/** Trigger a brief device vibration when haptics are supported. */
export function haptic(durationMs = 12): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs)
    } catch {
      // Ignore — vibration is best-effort.
    }
  }
}
