import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { sessionStore } from '@/session/session-store'
import { useSession } from '@/session/use-session'
import { announce } from '@/lib/announcer'

const PRIVATE_PAGES = ['/pagamento', '/pedido', '/perfil']

// Confere a sessão salva ao abrir o app e limpa os dados do usuário anterior
// sempre que a sessão muda (login, logout ou expiração).
export function SessionManager() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const session = useSession()
  const href = useRouterState({ select: (state) => state.location.href })
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lastEpoch = useRef(session.epoch)

  useQuery({
    queryKey: ['session', session.token],
    queryFn: async ({ signal }) => {
      const result = await api.getSession({ signal })
      sessionStore.updateUser(result.user)
      return result
    },
    enabled: session.status === 'authenticated',
    staleTime: 60_000,
    retry: false,
  })

  useEffect(() => {
    if (lastEpoch.current === session.epoch) return
    lastEpoch.current = session.epoch

    queryClient.removeQueries({ queryKey: ['user'] })
    queryClient.removeQueries({ queryKey: ['quote'] })
    queryClient.removeQueries({ queryKey: ['session'] })
    queryClient.invalidateQueries({ queryKey: ['cart'] })

    if (session.status === 'expired') {
      const message = 'Sua sessão expirou. Entre novamente para continuar de onde parou.'
      toast.warning(message, { id: 'session-expired' })
      announce(message, 'assertive')

      const isPrivatePage = PRIVATE_PAGES.some((page) => pathname.startsWith(page))
      if (isPrivatePage || pathname === '/carrinho') {
        navigate({ to: '/login', search: { redirect: href, reason: 'expired' } })
      }
    }
  }, [session.epoch, session.status, queryClient, navigate, href, pathname])

  return null
}
