import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  type ParsedLocation,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { sessionStore } from '@/session/session-store'
import { authSearchSchema, catalogSearchSchema } from './search'
import { RootLayout } from './root-layout'
import { HomePage } from '@/features/home/home-page'
import { NotFoundPage } from '@/features/misc/not-found-page'
import { RouteError } from '@/features/misc/route-error'

export interface RouterContext {
  queryClient: QueryClient
}

// rotas privadas mandam para o login e guardam a página que o usuário queria abrir
function requireAuth({ location }: { location: ParsedLocation }) {
  const { status } = sessionStore.get()
  if (status === 'authenticated') return

  throw redirect({
    to: '/login',
    search: { redirect: location.href, reason: status === 'expired' ? 'expired' : undefined },
  })
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteError,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: catalogSearchSchema,
  component: HomePage,
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: lazyRouteComponent(() => import('@/features/nft/nft-detail-page'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/features/cart/cart-page'), 'CartPage'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pagamento',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/features/checkout/checkout-page'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedido/$orderId',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/features/order/order-page'), 'OrderPage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: authSearchSchema,
  component: lazyRouteComponent(() => import('@/features/auth/auth-page'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: authSearchSchema,
  component: lazyRouteComponent(() => import('@/features/auth/auth-page'), 'RegisterPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/perfil',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/features/profile/profile-layout'), 'ProfileLayout'),
})

const profileIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/features/profile/profile-page'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/carteiras',
  component: lazyRouteComponent(() => import('@/features/profile/wallets-page'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/favoritos',
  component: lazyRouteComponent(() => import('@/features/profile/favorites-page'), 'FavoritesPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  profileRoute.addChildren([profileIndexRoute, walletsRoute, favoritesRoute]),
])

// deixa a URL mais legível: listas viram "a,b,c" e valores vazios são ignorados
function stringifySearch(search: Record<string, unknown>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue

    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

function parseSearch(search: string) {
  return Object.fromEntries(new URLSearchParams(search))
}

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    stringifySearch,
    parseSearch,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
