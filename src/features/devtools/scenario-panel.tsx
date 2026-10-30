import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import type { Cart } from '@/api/contracts'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useRealtimeStatus } from '@/realtime/realtime-provider'
import { LATENCY_PROFILES, SCENARIOS, type LatencyProfile, type ScenarioId } from '@/mocks/config'
import Big from 'big.js'

// Painel para testar cenários da simulação (só aparece com VITE_ENABLE_MOCKS=true).
// As ações chamam o "servidor" do MSW, que dispara os eventos do Socket.IO normalmente.
export default function ScenarioPanel() {
  const queryClient = useQueryClient()
  const realtime = useRealtimeStatus()
  const mock = window.__kurio
  const [config, setConfig] = useState(() => mock?.config())
  if (!mock || !config) return null

  const getFirstCartItem = () => {
    const carts = queryClient.getQueriesData<Cart>({ queryKey: ['cart'] })
    const items = carts.flatMap(([, cart]) => cart?.items ?? [])
    return items[0]
  }

  const run = async (label: string, action: () => Promise<unknown>) => {
    await action()
    toast.info(`[simulação] ${label}`)
  }

  const updateConfig = async (changes: Partial<typeof config>) => {
    await mock.setConfig(changes)
    setConfig(mock.config())
  }

  const resetAll = async () => {
    await mock.reset()
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('kurio.')) localStorage.removeItem(key)
      }
      sessionStorage.clear()
    } catch {
      // storage indisponível
    }
    location.assign('/')
  }

  const buttonClass = 'w-full rounded-md border border-line px-3 py-2 text-left text-xs hover:border-accent'

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-20 left-3 z-40 flex items-center gap-1.5 rounded-full border border-accent/60 bg-surface px-3 py-2 text-[11px] text-accent shadow-lg md:bottom-4"
          aria-label="Abrir painel de cenários da simulação"
          data-testid="scenario-trigger"
        >
          <FlaskConical className="size-3.5" aria-hidden /> Cenários
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[92vw] max-w-sm overflow-y-auto border-line bg-surface p-5">
        <SheetHeader className="p-0">
          <SheetTitle>Simulação (MSW)</SheetTitle>
          <SheetDescription className="text-xs text-muted">
            Tempo real: <strong>{realtime}</strong>. Configurações persistem após refresh.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-xs">
          <label className="block space-y-1">
            <span className="font-bold">Cenário</span>
            <select className="h-9 w-full rounded-md border border-line bg-ink px-2" value={config.scenario} onChange={(event) => updateConfig({ scenario: event.target.value as ScenarioId })}>
              {Object.entries(SCENARIOS).map(([id, label]) => (
                <option key={id} value={id}>
                  {id} — {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-bold">Latência</span>
            <select className="h-9 w-full rounded-md border border-line bg-ink px-2" value={config.latency} onChange={(event) => updateConfig({ latency: event.target.value as LatencyProfile })}>
              {Object.entries(LATENCY_PROFILES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={config.offline} onChange={(event) => updateConfig({ offline: event.target.checked })} /> Sem conexão (erro de rede)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={config.serverDown} onChange={(event) => updateConfig({ serverDown: event.target.checked })} /> Servidor indisponível (HTTP 503)
          </label>

          <div className="space-y-2 border-t border-line pt-4">
            <p className="font-bold">Eventos e falhas</p>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                const item = getFirstCartItem()
                if (!item) return toast.error('Adicione um item ao carrinho primeiro.')
                const newPrice = new Big(item.unitPrice).plus('0.1').toFixed(2)
                run(`preço de ${item.name} +0.1 ETH`, () => mock.updateNft(item.nftId, { price: newPrice }))
              }}
            >
              Alterar preço do 1º item do carrinho (+0.1 ETH)
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                const item = getFirstCartItem()
                if (!item) return toast.error('Adicione um item ao carrinho primeiro.')
                run(`edição ${item.editionLabel} de ${item.name} esgotada`, () => mock.updateNft(item.nftId, { editions: { [item.editionId]: 0 } }))
              }}
            >
              Esgotar edição do 1º item do carrinho
            </button>
            <button type="button" className={buttonClass} onClick={() => run('evento duplicado reenviado', () => mock.replayEvent('duplicate'))}>
              Reenviar último evento (duplicata)
            </button>
            <button type="button" className={buttonClass} onClick={() => run('evento antigo reenviado', () => mock.replayEvent('stale'))}>
              Reenviar evento antigo (versão anterior)
            </button>
            <button type="button" className={buttonClass} onClick={() => run('socket desconectado por 5s', () => mock.dropSocket(5000))}>
              Derrubar Socket.IO por 5s
            </button>
            <button type="button" className={buttonClass} onClick={() => run('sessões expiradas', () => mock.expireSessions())}>
              Expirar sessão agora
            </button>
            <button type="button" className={buttonClass} onClick={() => run('carteiras desconectadas', () => mock.disconnectWallets())}>
              Desconectar carteira
            </button>
          </div>

          <button
            type="button"
            className="w-full rounded-md bg-accent px-3 py-2 font-bold text-accent-ink"
            onClick={resetAll}
          >
            Restaurar cenário padrão (reset completo)
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
