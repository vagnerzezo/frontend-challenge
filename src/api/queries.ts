import { keepPreviousData, QueryClient, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, CartItemInput, NftListParams, Order, Profile, Quote, WalletInput, WalletSlot } from './contracts'
import { api } from './endpoints'
import { isApiError } from './http'
import { useSession } from '@/session/use-session'
import { getGuestCartId } from '@/session/guest-cart'
import { announce } from '@/lib/announcer'

type CartResponse = Cart & { couponCode: string | null }

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // tenta de novo até 2 vezes, só em erro de rede, timeout ou 5xx
        retry: (failureCount, error) => isApiError(error) && error.transient && error.code !== 'CANCELED' && failureCount < 2,
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3000),
      },
      mutations: { retry: false },
    },
  })
}

// Tudo que é do usuário logado fica embaixo de ['user', userId] para ser apagado no logout
export const keys = {
  nfts: ['nfts'] as const,
  nftList: (params: NftListParams) => ['nfts', 'list', params] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  cart: (owner: string) => ['cart', owner] as const,
  quote: (owner: string, cartKey: string) => ['quote', owner, cartKey] as const,
  user: (userId: string) => ['user', userId] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  order: (userId: string, id: string) => ['user', userId, 'order', id] as const,
}

// Catálogo

export function nftListQuery(params: NftListParams) {
  return queryOptions({
    queryKey: keys.nftList(params),
    queryFn: ({ signal }) => api.listNfts(params, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function nftQuery(id: string) {
  return queryOptions({
    queryKey: keys.nft(id),
    queryFn: ({ signal }) => api.getNft(id, { signal }),
  })
}

export function useCatalog(params: NftListParams) {
  return useQuery(nftListQuery(params))
}

export function useNft(id: string) {
  return useQuery(nftQuery(id))
}

// Favoritos

export function useFavorites() {
  const { user } = useSession()
  return useQuery({
    queryKey: keys.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.getFavorites({ signal }),
    enabled: !!user,
    select: (data) => new Set(data.nftIds),
  })
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const { user } = useSession()

  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.addFavorite(nftId) : api.removeFavorite(nftId),

    // atualiza a tela na hora e desfaz se a API falhar
    onMutate: async ({ nftId, favorite }) => {
      const key = keys.favorites(user!.id)
      await queryClient.cancelQueries({ queryKey: key })

      const previous = queryClient.getQueryData<{ nftIds: string[] }>(key)
      const ids = new Set(previous?.nftIds ?? [])
      if (favorite) ids.add(nftId)
      else ids.delete(nftId)
      queryClient.setQueryData(key, { nftIds: [...ids] })

      return { previous, key }
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous)
      else if (context) queryClient.resetQueries({ queryKey: context.key })

      const action = variables.favorite ? 'favoritar' : 'remover dos favoritos'
      const message = `Não foi possível ${action} ${variables.name}. ${isApiError(error) ? error.message : ''}`
      toast.error(message)
      announce(message, 'assertive')
    },
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(context.key, data)
      if (variables.favorite) announce(`${variables.name} adicionado aos favoritos.`)
      else announce(`${variables.name} removido dos favoritos.`)
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) queryClient.invalidateQueries({ queryKey: context.key })
    },
  })
}

// Carrinho

export function useCartOwner() {
  const { user } = useSession()
  return user ? `user:${user.id}` : `guest:${getGuestCartId()}`
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: keys.cart(owner),
    queryFn: ({ signal }) => api.getCart({ signal }),
    refetchOnWindowFocus: true,
  })
}

// Todas as ações do carrinho fazem a mesma coisa no sucesso: salvam o carrinho novo e refazem a cotação
function useCartMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<CartResponse>,
  getSuccessMessage?: (variables: TVariables) => string,
) {
  const queryClient = useQueryClient()
  const owner = useCartOwner()

  return useMutation({
    mutationFn,
    onSuccess: (cart, variables) => {
      queryClient.setQueryData(keys.cart(owner), cart)
      queryClient.invalidateQueries({ queryKey: ['quote', owner] })
      if (getSuccessMessage) announce(getSuccessMessage(variables))
    },
    onError: (error) => {
      // o estoque mudou: recarrega carrinho e NFTs para mostrar o valor certo
      if (isApiError(error) && error.code === 'AVAILABILITY_CONFLICT') {
        queryClient.invalidateQueries({ queryKey: keys.cart(owner) })
        queryClient.invalidateQueries({ queryKey: keys.nfts })
      }
    },
  })
}

export function useAddToCart() {
  return useCartMutation(
    (item: CartItemInput & { name?: string }) =>
      api.addCartItem({ nftId: item.nftId, editionId: item.editionId, quantity: item.quantity }),
    (item) => `${item.name ?? 'NFT'} adicionado ao carrinho.`,
  )
}

export function useSetCartQuantity() {
  return useCartMutation(
    (item: { nftId: string; editionId: string; quantity: number }) => api.setCartItem(item.nftId, item.editionId, item.quantity),
    (item) => `Quantidade atualizada para ${item.quantity}.`,
  )
}

export function useRemoveCartItem() {
  return useCartMutation(
    (item: { nftId: string; editionId: string; name: string }) => api.removeCartItem(item.nftId, item.editionId),
    (item) => `${item.name} removido do carrinho.`,
  )
}

export function useApplyCoupon() {
  return useCartMutation(
    (code: string) => api.applyCoupon(code),
    (code) => `Cupom ${code} aplicado.`,
  )
}

export function useRemoveCoupon() {
  return useCartMutation(
    () => api.removeCoupon(),
    () => 'Cupom removido.',
  )
}

export function useAcknowledgeCart() {
  return useCartMutation(() => api.acknowledgeCart())
}

// A cotação é quem manda nos valores mostrados e usados para finalizar a compra
export function useCartQuote(cart: CartResponse | undefined) {
  const owner = useCartOwner()

  // monta uma "chave" com os itens do carrinho para refazer a cotação quando algo mudar
  let cartKey = ''
  if (cart) {
    const items = cart.items.map((item) => `${item.nftId}/${item.editionId}x${item.quantity}@${item.unitPrice}`)
    cartKey = `${items.join('|')}|${cart.couponCode ?? ''}`
  }

  return useQuery<Quote>({
    queryKey: keys.quote(owner, cartKey),
    queryFn: ({ signal }) => api.quoteCart({ signal }),
    enabled: !!cart && cart.items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

// Perfil

export function useProfile() {
  const { user } = useSession()
  return useQuery({
    queryKey: keys.profile(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.getProfile({ signal }),
    enabled: !!user,
  })
}

export function useProfileMutations() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const saveProfile = (profile: Profile) => queryClient.setQueryData(keys.profile(user!.id), profile)

  return {
    update: useMutation({ mutationFn: api.updateProfile, onSuccess: saveProfile }),
    uploadAvatar: useMutation({ mutationFn: api.uploadAvatar, onSuccess: saveProfile }),
    removeAvatar: useMutation({ mutationFn: api.removeAvatar, onSuccess: saveProfile }),
    changePassword: useMutation({ mutationFn: api.changePassword }),
  }
}

// Carteiras

export function useWallets() {
  const { user } = useSession()
  return useQuery({
    queryKey: keys.wallets(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.getWallets({ signal }),
    enabled: !!user,
  })
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  const { user } = useSession()

  return useMutation({
    mutationFn: (data: { id?: string; slot: WalletSlot; input: WalletInput }) =>
      data.id ? api.updateWallet(data.id, data.input) : api.createWallet(data.slot, data.input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.wallets(user!.id) }),
  })
}

// Pedidos

export function useOrder(id: string | null) {
  const { user } = useSession()
  return useQuery<Order>({
    queryKey: keys.order(user?.id ?? 'anon', id ?? ''),
    queryFn: ({ signal }) => api.getOrder(id!, { signal }),
    enabled: !!user && !!id,
    // caso o socket falhe, consulta o pedido a cada 10s enquanto estiver pendente
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 10_000 : false),
  })
}
