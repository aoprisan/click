// The app talks to one shared GameClient. Today it's the in-browser mock; swap
// this for a LiveGameClient (fetch + WebSocket) when a backend lands.
import { MockGameClient } from './MockGameClient'
import type { GameClient } from './GameClient'

export type { GameClient, ConnectionState } from './GameClient'

export const game: GameClient = new MockGameClient()
