// Walk Mode (design feedback: "mine while you walk"): an OPT-IN alternative
// input, not a replacement for the GROW button — both stay available. While the
// toggle is on, the phone's motion sensor feeds a StepDetector and every
// detected step fires the same onStep the button would, which routes through
// the same RateMeter throttle — walking mines at human-click rates, never faster.
import { useCallback, useEffect, useRef, useState } from 'react'
import { StepDetector } from '../game/pedometer'

export type WalkModeStatus = 'idle' | 'active' | 'denied'

/** iOS 13+ gates motion events behind a permission prompt that must be
 *  triggered from a user gesture; other browsers just fire the events. */
interface MotionEventCtor {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/** Motion events only exist to be listened to on devices that move — hide the
 *  toggle on desktops (jsdom has no DeviceMotionEvent, so tests see false too). */
export function walkModeSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof DeviceMotionEvent !== 'undefined'
    && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
}

export function useWalkMode(onStep: () => void) {
  const [status, setStatus] = useState<WalkModeStatus>('idle')
  const [steps, setSteps] = useState(0)
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  const listenerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null)

  const stop = useCallback(() => {
    if (listenerRef.current) {
      window.removeEventListener('devicemotion', listenerRef.current)
      listenerRef.current = null
    }
    setStatus('idle')
  }, [])

  useEffect(() => stop, [stop]) // detach on unmount

  /** Toggle walk mode. Resolves to the resulting status so the caller can
   *  surface a denial (e.g. as a toast). Must be called from a user gesture —
   *  iOS shows its motion-permission prompt only then. */
  const toggle = useCallback(async (): Promise<WalkModeStatus> => {
    if (listenerRef.current) {
      stop()
      return 'idle'
    }
    const ctor = DeviceMotionEvent as unknown as MotionEventCtor
    if (typeof ctor.requestPermission === 'function') {
      try {
        if (await ctor.requestPermission() !== 'granted') {
          setStatus('denied')
          return 'denied'
        }
      } catch {
        setStatus('denied')
        return 'denied'
      }
    }
    const detector = new StepDetector()
    const listener = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x == null || a.y == null || a.z == null) return
      if (detector.sample(e.timeStamp, a.x, a.y, a.z)) {
        setSteps(s => s + 1)
        stepRef.current()
      }
    }
    listenerRef.current = listener
    window.addEventListener('devicemotion', listener)
    setSteps(0)
    setStatus('active')
    return 'active'
  }, [stop])

  return { status, steps, toggle }
}
