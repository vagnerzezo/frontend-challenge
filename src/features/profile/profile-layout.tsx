import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Download, Heart, LogOut, MapPin, ShoppingCart, Tag, User } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { sessionStore } from '@/session/session-store'
import { outOfScope } from '@/lib/out-of-scope'
import { announce } from '@/lib/announcer'

const linkClass =
  'flex items-center gap-3 border-l-4 border-transparent px-4 py-2.5 text-sm text-accent hover:bg-surface-2 data-[status=active]:border-accent data-[status=active]:bg-surface-2 whitespace-nowrap'

export function useLogout() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => api.logout().catch(() => undefined),
    onSettled: () => {
      const userId = sessionStore.get().user?.id
      // apaga o rascunho do checkout para o próximo usuário não ver
      try {
        if (userId) {
          sessionStorage.removeItem(`kurio.checkout.draft.${userId}`)
          localStorage.removeItem(`kurio.checkout.attempt.${userId}`)
        }
      } catch {
        // storage indisponível
      }
      sessionStore.signOut()
      toast.success('Você saiu da sua conta.')
      announce('Você saiu da sua conta.')
      navigate({ to: '/' })
    },
  })
}

export function ProfileLayout() {
  const logout = useLogout()
  // itens do menu que não existem nesta demonstração
  const unavailableItem = (label: string, Icon: typeof User) => (
    <li className="hidden md:block">
      <button type="button" aria-disabled="true" className={linkClass + ' w-full opacity-80'} onClick={() => outOfScope(label)}>
        <Icon className="size-4" aria-hidden /> {label}
      </button>
    </li>
  )
  return (
    <div className="container-k grid grid-cols-[minmax(0,1fr)] gap-6 py-6 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0 self-start rounded-md bg-surface md:pb-1">
        <h2 className="px-4 pt-4 pb-2 font-bold">Meu perfil</h2>
        <nav aria-label="Meu perfil">
          <ul className="flex overflow-x-auto md:block">
            <li>
              <Link to="/perfil" activeOptions={{ exact: true }} className={linkClass}>
                <User className="size-4" aria-hidden /> Dados do perfil
              </Link>
            </li>
            <li>
              <Link to="/perfil/carteiras" className={linkClass}>
                <MapPin className="size-4" aria-hidden /> Carteiras
              </Link>
            </li>
            <li>
              <Link to="/perfil/favoritos" className={linkClass}>
                <Heart className="size-4" aria-hidden /> Lista de interesse
              </Link>
            </li>
            {unavailableItem('Atividade', ShoppingCart)}
            {unavailableItem('Ofertas', Tag)}
            {unavailableItem('Arquivos baixados', Download)}
            {unavailableItem('Suporte', AlertTriangle)}
            <li className="md:border-t md:border-line">
              <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className={linkClass + ' w-full font-bold'}>
                <LogOut className="size-4" aria-hidden /> Sair
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
