import { Capacitor } from '@capacitor/core'
import type { StepSource } from './stepSource'
import { DeviceMotionStepSource, deviceMotionSupported } from './deviceMotionSource'
import { NativePedometerStepSource } from './nativePedometerSource'

export type { StepSource, StepSourceStatus } from './stepSource'

/** Native app → OS pedometer (background banking); web → DeviceMotion. */
export function selectStepSource(): StepSource {
  return Capacitor.isNativePlatform() ? new NativePedometerStepSource() : new DeviceMotionStepSource()
}

/** Whether this device can supply steps at all (gates the Walk Mode toggle). */
export function stepSourceSupported(): boolean {
  return Capacitor.isNativePlatform() || deviceMotionSupported()
}
