import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, Home, LayoutGrid, ShoppingCart, User } from 'lucide-react'
import { useCart } from '@/api/queries'
import { useSession } from '@/session/use-session'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { user } = useSession()
  const { data } = useCart()
  const count = data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0
  const linkClass = (active: boolean) => cn('grid size-11 place-items-center rounded-full', active ? 'text-accent' : 'text-cream/80')

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-16 max-w-md items-center justify-around rounded-t-3xl bg-surface px-4 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
        <Link to="/" aria-label="Início" className={linkClass(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>
          <Home className="size-5" fill="currentColor" />
        </Link>
        <Link to="/perfil/favoritos" aria-label="Favoritos" className={linkClass(pathname === '/perfil/favoritos')}>
          <Heart className="size-5" fill="currentColor" />
        </Link>
        <Link
          to="/"
          hash="catalogo"
          aria-label="Explorar catálogo"
          className="-mt-10 grid size-16 place-items-center rounded-full border-4 border-ink bg-accent text-accent-ink"
        >
          <LayoutGrid className="size-6" />
        </Link>
        <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} className={cn(linkClass(pathname === '/carrinho'), 'relative')}>
          <ShoppingCart className="size-5" />
          {count > 0 && (
            <span className="absolute top-1 right-0 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
              {count}
            </span>
          )}
        </Link>
        <Link to={user ? '/perfil' : '/login'} aria-label={user ? 'Meu perfil' : 'Entrar'} className={linkClass(pathname.startsWith('/perfil') && pathname !== '/perfil/favoritos')}>
          <User className="size-5" fill="currentColor" />
        </Link>
      </div>
    </nav>
  )
}
