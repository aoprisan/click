// Native step source (Capacitor app): the OS pedometer via the app-local
// Pedometer plugin (android/…/PedometerPlugin.java, ios/…/PedometerPlugin.swift).
// Hardware step counting — near-zero battery, keeps counting with the app
// closed. Live steps arrive as 'step' events; steps taken while away come back
// from claimBanked() as one number.
import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import type { StepSource, StepSourceStatus } from './stepSource'

interface PedometerNative {
  isAvailable(): Promise<{ available: boolean }>
  start(): Promise<void>
  stop(): Promise<void>
  claimBanked(): Promise<{ steps: number }>
  addListener(eventName: 'step', cb: (e: { count: number }) => void): Promise<PluginListenerHandle>
}

const Pedometer = registerPlugin<PedometerNative>('Pedometer')

export class NativePedometerStepSource implements StepSource {
  private handle: PluginListenerHandle | null = null

  async start(onStep: (tMs: number) => void): Promise<StepSourceStatus> {
    try {
      this.handle = await Pedometer.addListener('step', e => {
        const n = Math.max(1, Math.round(e.count ?? 1))
        const t = performance.now()
        for (let i = 0; i < n; i++) onStep(t)
      })
      await Pedometer.start() // rejects when the OS denies motion access
      return 'active'
    } catch {
      void this.detach()
      return 'denied'
    }
  }

  stop(): void {
    void this.detach()
    void Pedometer.stop().catch(() => { /* never started — fine */ })
  }

  private async detach(): Promise<void> {
    const h = this.handle
    this.handle = null
    if (h) await h.remove().catch(() => { /* already gone */ })
  }

  async claimBanked(): Promise<number> {
    try {
      const { steps } = await Pedometer.claimBanked()
      return Math.max(0, Math.round(steps || 0))
    } catch {
      return 0
    }
  }
}
