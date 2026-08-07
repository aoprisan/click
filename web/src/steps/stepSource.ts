// The seam between Walk Mode and wherever steps come from. Two sources exist:
//
// - DeviceMotionStepSource (web/PWA): raw accelerometer → StepDetector. Only
//   works while the page is open and the screen on — browsers stop motion
//   events on lock/background, which is the whole reason the native wrapper
//   exists.
// - NativePedometerStepSource (Capacitor app): the OS step counter — hardware,
//   near-zero battery, and it keeps counting while the app is closed. Live
//   steps stream as events; steps taken while away are BANKED and claimed on
//   return (claimBanked), to be drip-fed through the same click throttle.
//
// Either way one onStep call = one step = one throttle-capped click.

export type StepSourceStatus = 'active' | 'denied'

export interface StepSource {
  /** Begin delivering live steps; one onStep call per step, timestamped on the
   *  performance.now() clock. Must be called from a user gesture (permission
   *  prompts). Resolves 'denied' when the OS/browser refuses motion access. */
  start(onStep: (tMs: number) => void): Promise<StepSourceStatus>
  stop(): void
  /** Steps the OS counted since the last claim — i.e. while the game was away.
   *  Advances the claim cursor. Always 0 on the web (no background counting). */
  claimBanked(): Promise<number>
}
