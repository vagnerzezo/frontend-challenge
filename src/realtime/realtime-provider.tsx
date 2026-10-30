import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import type {
  Cart,
  Nft,
  NftListResponse,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  SocketClientToServer,
  SocketServerToClient,
} from '@/api/contracts'
import { keys } from '@/api/queries'
import { sessionStore } from '@/session/session-store'
import { announce } from '@/lib/announcer'
import { formatEth } from '@/lib/eth'

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string) || 'wss://realtime.kurio.mock'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

const RealtimeContext = createContext<RealtimeStatus>('connecting')

export function useRealtimeStatus() {
  return useContext(RealtimeContext)
}

type RealtimeEvent = { eventId: string; resource: { type: string; id: string }; version: number }

// Guarda os eventos já recebidos para ignorar eventos repetidos
// ou mais antigos do que a versão que já temos.
class EventFilter {
  seenIds = new Set<string>()
  versions = new Map<string, number>()

  shouldApply(event: RealtimeEvent, cachedVersion = 0) {
    if (this.seenIds.has(event.eventId)) return false

    const key = `${event.resource.type}:${event.resource.id}`
    const latestVersion = Math.max(this.versions.get(key) ?? 0, cachedVersion)
    if (event.version <= latestVersion) return false

    this.seenIds.add(event.eventId)
    // evita que a lista cresça para sempre
    if (this.seenIds.size > 1000) {
      const oldest = this.seenIds.values().next().value!
      this.seenIds.delete(oldest)
    }
    this.versions.set(key, event.version)
    return true
  }

  clear() {
    this.seenIds.clear()
    this.versions.clear()
  }
}

function handleNftUpdated(queryClient: QueryClient, filter: EventFilter, event: NftUpdatedEvent) {
  const id = event.resource.id
  const cachedNft = queryClient.getQueryData<Nft>(keys.nft(id))
  if (!filter.shouldApply(event, cachedNft?.version ?? 0)) return

  const changes = { ...event.payload, version: event.version }

  queryClient.setQueryData<Nft>(keys.nft(id), (old) => {
    if (old && old.version < event.version) return { ...old, ...changes }
    return old
  })

  queryClient.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (old) => {
    if (!old) return old
    const items = old.items.map((nft) => {
      if (nft.id !== id || nft.version >= event.version) return nft
      return { ...nft, price: changes.price, previousPrice: changes.previousPrice, available: changes.available, version: event.version }
    })
    return { ...old, items }
  })

  // se o NFT está no carrinho, avisa o usuário e atualiza o carrinho e a cotação
  const carts = queryClient.getQueriesData<Cart>({ queryKey: ['cart'] })
  const allItems = carts.flatMap(([, cart]) => cart?.items ?? [])
  const cartItem = allItems.find((item) => item.nftId === id)
  if (!cartItem) return

  const edition = event.payload.editions.find((ed) => ed.id === cartItem.editionId)
  let message = ''
  if (edition && edition.available < cartItem.quantity) {
    if (edition.available === 0) {
      message = `${cartItem.name} (${cartItem.editionLabel}) esgotou. Ajuste seu carrinho.`
    } else {
      message = `${cartItem.name} (${cartItem.editionLabel}) agora tem apenas ${edition.available} disponível(is).`
    }
  } else if (edition && edition.price !== cartItem.unitPrice) {
    message = `O preço de ${cartItem.name} mudou de ${formatEth(cartItem.unitPrice)} para ${formatEth(edition.price)}.`
  }

  if (message) {
    toast.warning(message, { id: event.eventId })
    announce(message, 'assertive')
  }
  queryClient.invalidateQueries({ queryKey: ['cart'] })
  queryClient.invalidateQueries({ queryKey: ['quote'] })
}

function handleOrderUpdated(queryClient: QueryClient, filter: EventFilter, event: OrderUpdatedEvent, joinedEpoch: number) {
  const { user, epoch } = sessionStore.get()
  // evento de outra sessão não pode mexer nos dados do usuário atual
  if (!user || joinedEpoch !== epoch) return

  const key = keys.order(user.id, event.resource.id)
  const cachedOrder = queryClient.getQueryData<Order>(key)
  if (!filter.shouldApply(event, cachedOrder?.version ?? 0)) return

  queryClient.setQueryData<Order>(key, (old) => {
    if (!old || old.version < event.version) return event.payload.order
    return old
  })

  if (event.payload.status === 'confirmed') {
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    queryClient.invalidateQueries({ queryKey: ['quote'] })
    announce('Pagamento confirmado. Seus NFTs estão na sua carteira.', 'assertive')
  } else if (event.payload.status === 'rejected') {
    announce(`Pagamento recusado. ${event.payload.order.failureReason ?? ''}`, 'assertive')
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    const filter = new EventFilter()
    const socket: Socket<SocketServerToClient, SocketClientToServer> = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    })
    let joinedEpoch = -1
    let hasConnectedBefore = false

    function joinSession() {
      const session = sessionStore.get()
      joinedEpoch = session.epoch
      socket.emit('session.join', { token: session.token })
    }

    function onConnect() {
      setStatus('connected')
      joinSession()

      // reconectou: alguns eventos podem ter se perdido, então busca tudo de novo pela API
      if (hasConnectedBefore) {
        queryClient.invalidateQueries({ queryKey: ['nfts'], refetchType: 'active' })
        queryClient.invalidateQueries({ queryKey: ['cart'], refetchType: 'active' })
        queryClient.invalidateQueries({ queryKey: ['quote'], refetchType: 'active' })
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'user' && query.queryKey[2] === 'order',
          refetchType: 'active',
        })
        announce('Conexão em tempo real restabelecida.')
      }
      hasConnectedBefore = true
    }

    function onDisconnect() {
      setStatus(socket.active ? 'reconnecting' : 'offline')
    }

    function onReconnectAttempt() {
      setStatus('reconnecting')
    }

    function onNftUpdated(event: NftUpdatedEvent) {
      handleNftUpdated(queryClient, filter, event)
    }

    function onOrderUpdated(event: OrderUpdatedEvent) {
      handleOrderUpdated(queryClient, filter, event, joinedEpoch)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect_attempt', onReconnectAttempt)
    socket.on('nft.updated', onNftUpdated)
    socket.on('order.updated', onOrderUpdated)
    socket.connect()

    // quando a sessão muda (login, logout ou expiração), entra de novo com o token novo
    const unsubscribe = sessionStore.subscribe(() => {
      if (sessionStore.get().epoch !== joinedEpoch) {
        filter.clear()
        if (socket.connected) joinSession()
      }
    })

    return () => {
      unsubscribe()
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('nft.updated', onNftUpdated)
      socket.off('order.updated', onOrderUpdated)
      socket.io.off('reconnect_attempt', onReconnectAttempt)
      socket.disconnect()
    }
  }, [queryClient])

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>
}
