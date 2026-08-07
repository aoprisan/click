import UIKit
import Capacitor

/// App-local Capacitor plugins register here (Main.storyboard points the
/// bridge view controller at this subclass).
class AppViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PedometerPlugin())
    }
}
