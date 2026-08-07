// Step detection for Walk Mode (mine-while-you-walk): turns raw accelerometer
// samples into discrete steps, each of which the UI feeds through the SAME
// throttle-capped click path as the GROW button. Walking is an alternative way
// to click, not a faster one — the RateMeter still governs the rate.
//
// The algorithm is a classic orientation-free pedometer: take the magnitude of
// accelerationIncludingGravity (so it works with the phone in a hand, pocket or
// armband), track a slow exponential-moving-average baseline (~gravity), and
// fire a step when the deviation spikes above a threshold — with hysteresis
// (must dip back down before re-arming) and a refractory window (no plausible
// human cadence exceeds ~3.5 steps/s) so vibration jitter doesn't count.

export interface StepDetectorOptions {
  /** m/s² above the baseline that counts as a step impact. */
  threshold?: number
  /** deviation must fall back below this before the next step can fire. */
  resetBelow?: number
  /** refractory window between steps, ms (caps cadence, kills jitter). */
  minStepMs?: number
  /** EMA smoothing factor for the gravity baseline (per sample, ~60Hz). */
  baselineAlpha?: number
}

export class StepDetector {
  private readonly threshold: number
  private readonly resetBelow: number
  private readonly minStepMs: number
  private readonly alpha: number
  private baseline: number | null = null
  private armed = true
  private lastStepAt = -Infinity

  constructor(opts: StepDetectorOptions = {}) {
    this.threshold = opts.threshold ?? 1.5
    this.resetBelow = opts.resetBelow ?? 0.6
    this.minStepMs = opts.minStepMs ?? 280
    this.alpha = opts.baselineAlpha ?? 0.02
  }

  /** Feed one accelerometer sample; returns true when a step is detected. */
  sample(tMs: number, x: number, y: number, z: number): boolean {
    const mag = Math.sqrt(x * x + y * y + z * z)
    if (this.baseline == null) {
      this.baseline = mag
      return false
    }
    const deviation = mag - this.baseline
    this.baseline += this.alpha * (mag - this.baseline)

    if (this.armed && deviation > this.threshold && tMs - this.lastStepAt >= this.minStepMs) {
      this.armed = false
      this.lastStepAt = tMs
      return true
    }
    if (!this.armed && deviation < this.resetBelow) this.armed = true
    return false
  }
}
