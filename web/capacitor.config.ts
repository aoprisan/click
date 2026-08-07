import type { CapacitorConfig } from '@capacitor/cli'

// Native wrapper around the same Vite build the web PWA ships (webDir: dist).
// The wrapper exists for one capability the web cannot have: the OS step
// counter keeps counting while the app is closed, and the Pedometer plugin
// (android/ + ios/ native sources) banks those steps for Walk Mode to mine.
const config: CapacitorConfig = {
  appId: 'io.github.aoprisan.globalconflict',
  appName: 'Global Conflict',
  webDir: 'dist',
}

export default config
