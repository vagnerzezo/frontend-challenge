import { WifiOff } from 'lucide-react'
import { useRealtimeStatus } from '@/realtime/realtime-provider'

export function RealtimeBanner() {
  const status = useRealtimeStatus()
  if (status !== 'reconnecting' && status !== 'offline') return null
  return (
    <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-band px-4 py-2 text-xs text-cream" data-testid="realtime-banner">
      <WifiOff className="size-4" aria-hidden />
      {status === 'reconnecting'
        ? 'Reconectando às atualizações em tempo real… os valores serão sincronizados ao reconectar.'
        : 'Atualizações em tempo real indisponíveis.'}
    </div>
  )
}
