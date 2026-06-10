import type { ConnectionState } from '../hooks/useWebSocket'

interface ConnectionStatusProps {
  state: ConnectionState
}

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === 'connected') return null

  const isConnecting = state === 'connecting'

  return (
    <div className={`conn-status ${isConnecting ? 'conn-status--connecting' : 'conn-status--disconnected'}`}>
      {isConnecting ? 'Reconnecting...' : 'Disconnected'}
    </div>
  )
}
