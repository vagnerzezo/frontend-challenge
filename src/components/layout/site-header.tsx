import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCart } from '@/api/queries'
import { useSession } from '@/session/use-session'
import { cn } from '@/lib/utils'
import { outOfScope } from '@/lib/out-of-scope'
import { UserAvatar } from '@/components/layout/user-avatar'

const MARKET_PATHS = ['/nft', '/carrinho', '/pagamento', '/pedido']

export function CartCount({ className }: { className?: string }) {
  const { data } = useCart()
  const count = data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0
  return (
    <span
      className={cn(
        'absolute -top-1.5 -right-2 grid min-w-4 h-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink',
        className,
      )}
      data-testid="cart-count"
    >
      {count}
    </span>
  )
}

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { user } = useSession()
  const [searchOpen, setSearchOpen] = useState(false)
  const [term, setTerm] = useState('')
  const navigate = useNavigate()
  const inMarket = MARKET_PATHS.some((path) => pathname.startsWith(path))
  const { data: cart } = useCart()
  const cartCount = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0

  const navLinkClass = (active: boolean) =>
    cn(
      'relative py-6 text-sm transition-colors hover:text-accent-strong',
      active ? 'text-accent font-semibold after:absolute after:inset-x-0 after:bottom-3 after:h-0.5 after:bg-accent' : 'text-cream',
    )

  return (
    <header className="hidden border-b border-line md:block">
      <div className="container-k flex h-20 items-center justify-between gap-6">
        <Link to="/" className="text-sm font-bold tracking-[0.2em]" aria-label="Kurio, página inicial">
          KURIO
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-8 lg:gap-10">
          <Link to="/" className={navLinkClass(pathname === '/' && !inMarket)} aria-current={pathname === '/' ? 'page' : undefined}>
            Início
          </Link>
          <Link to="/" hash="catalogo" className={navLinkClass(inMarket)}>
            Mercado
          </Link>
          <button type="button" className={navLinkClass(false)} aria-disabled="true" onClick={() => outOfScope('Criadores')}>
            Criadores
          </button>
          <button type="button" className={navLinkClass(false)} aria-disabled="true" onClick={() => outOfScope('Aprenda')}>
            Aprenda
          </button>
        </nav>
        <div className="flex items-center gap-5">
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger asChild>
              <button type="button" aria-label="Buscar NFTs" className="rounded p-1 hover:text-accent">
                <Search className="size-5" />
              </button>
            </DialogTrigger>
            <DialogContent className="top-24 translate-y-0 border-line bg-surface sm:max-w-xl">
              <DialogTitle>Buscar NFTs</DialogTitle>
              <DialogDescription className="text-muted">Busque por nome, coleção ou ID do token.</DialogDescription>
              <form
                role="search"
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  setSearchOpen(false)
                  navigate({ to: '/', search: { q: term.trim() || undefined }, hash: 'catalogo' })
                }}
              >
                <label htmlFor="header-search" className="sr-only">
                  Termo de busca
                </label>
                <Input id="header-search" autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Ex.: Emerald Ape" />
                <Button type="submit">Buscar</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Link
            to="/carrinho"
            className="relative rounded p-1 hover:text-accent"
            aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}
          >
            <ShoppingCart className="size-5" />
            <CartCount />
          </Link>
          {user ? (
            <Link to="/perfil" className="flex items-center gap-2 rounded px-1 text-sm hover:text-accent" aria-label={`Meu perfil, ${user.displayName}`}>
              <UserAvatar user={user} size={28} />
              <span className="hidden max-w-28 truncate lg:inline">{user.displayName}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ redirect: pathname === '/login' ? undefined : pathname }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-accent bg-accent px-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-strong"
            >
              <LogIn className="size-4" aria-hidden /> Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
