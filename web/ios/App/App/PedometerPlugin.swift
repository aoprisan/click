import Foundation
import Capacitor
import CoreMotion

/// Walk Mode's native step source. Two jobs:
///
/// 1. Live steps: CMPedometer.startUpdates delivers batched step counts while
///    the app is open; each batch is forwarded as a "step" event with the delta.
/// 2. Banked steps: iOS records steps continuously in the motion coprocessor
///    (up to 7 days back), so claimBanked() queries the window since the last
///    claim — steps taken while the app was closed included — and advances the
///    cursor.
///
/// The JS side (src/steps/nativePedometerSource.ts) feeds both through the same
/// throttle-capped click path as tapping. Registered in AppViewController.
@objc(PedometerPlugin)
public class PedometerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PedometerPlugin"
    public let jsName = "Pedometer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "claimBanked", returnType: CAPPluginReturnPromise)
    ]

    private let pedometer = CMPedometer()
    private var liveTotal = 0
    private let lastClaimKey = "gc.pedometer.lastClaim"

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": CMPedometer.isStepCountingAvailable()])
    }

    @objc func start(_ call: CAPPluginCall) {
        guard CMPedometer.isStepCountingAvailable() else {
            call.reject("no step counting on this device")
            return
        }
        guard CMPedometer.authorizationStatus() != .denied else {
            call.reject("denied")
            return
        }
        liveTotal = 0
        pedometer.startUpdates(from: Date()) { [weak self] data, error in
            guard let self = self, let data = data, error == nil else { return }
            let total = data.numberOfSteps.intValue
            let delta = total - self.liveTotal
            self.liveTotal = total
            // Live-mined steps advance the banked cursor — no double credit later.
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: self.lastClaimKey)
            if delta > 0 {
                self.notifyListeners("step", data: ["count": delta])
            }
        }
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        pedometer.stopUpdates()
        call.resolve()
    }

    @objc func claimBanked(_ call: CAPPluginCall) {
        guard CMPedometer.isStepCountingAvailable(),
              CMPedometer.authorizationStatus() != .denied else {
            call.resolve(["steps": 0])
            return
        }
        let now = Date()
        let stored = UserDefaults.standard.double(forKey: lastClaimKey)
        UserDefaults.standard.set(now.timeIntervalSince1970, forKey: lastClaimKey)
        guard stored > 0 else {
            // First claim just opens the window (also triggers the motion
            // permission prompt via the query below on next claims).
            call.resolve(["steps": 0])
            return
        }
        let from = Date(timeIntervalSince1970: stored)
        pedometer.queryPedometerData(from: from, to: now) { data, _ in
            call.resolve(["steps": data?.numberOfSteps.intValue ?? 0])
        }
    }
}
