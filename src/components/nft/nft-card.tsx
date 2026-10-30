import { Link } from '@tanstack/react-router'
import { Search, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import type { NftSummary } from '@/api/contracts'
import { useAddToCart } from '@/api/queries'
import { isApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './favorite-button'

interface Props {
  nft: NftSummary
  priority?: boolean
  className?: string
  showActions?: boolean
}

export function NftCard({ nft, priority, className, showActions = true }: Props) {
  const addToCart = useAddToCart()
  return (
    <article className={cn('group relative', className)} data-testid="nft-card">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-surface p-3">
        {nft.rare && (
          <span className="absolute top-3 left-3 z-10 bg-accent px-3 py-1 text-xs font-bold text-accent-ink">RARO</span>
        )}
        <img
          src={nft.image}
          alt={`Arte do NFT ${nft.name}`}
          width={480}
          height={480}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="aspect-square w-full rounded-[10px] object-cover"
        />
        {showActions && (
          <div className="absolute right-4 bottom-4 z-20 hidden gap-1.5 transition-opacity md:flex md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full bg-ink/80 text-accent hover:bg-ink disabled:opacity-50"
              aria-label={`Adicionar ${nft.name} ao carrinho`}
              disabled={nft.available === 0 || addToCart.isPending}
              onClick={() =>
                addToCart.mutate(
                  { nftId: nft.id, editionId: '1-50', quantity: 1, name: nft.name },
                  {
                    onSuccess: () => toast.success(`${nft.name} (edição 1/50) adicionado ao carrinho.`),
                    onError: (error) => toast.error(isApiError(error) ? error.message : 'Não foi possível adicionar.'),
                  },
                )
              }
            >
              <ShoppingCart className="size-4" aria-hidden />
            </button>
            <FavoriteButton nftId={nft.id} name={nft.name} className="hidden md:grid" />
            <Link
              to="/nft/$nftId"
              params={{ nftId: nft.id }}
              tabIndex={-1}
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-ink/80 text-accent hover:bg-ink"
            >
              <Search className="size-4" />
            </Link>
          </div>
        )}
        {showActions && <FavoriteButton nftId={nft.id} name={nft.name} className="absolute top-4 right-4 z-20 md:hidden" />}
      </div>
      <h3 className="mt-3 text-sm">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-accent focus-visible:outline-none">
          {nft.name}
        </Link>
      </h3>
      <p className="mt-0.5 text-sm">
        <span className="font-bold text-accent">{formatEth(nft.price)}</span>
        {nft.previousPrice && (
          <span className="ml-2 text-subtle">
            <span className="sr-only">preço anterior </span>
            <s>{formatEth(nft.previousPrice)}</s>
          </span>
        )}
        {nft.available === 0 && <span className="ml-2 text-xs text-danger">Esgotado</span>}
      </p>
    </article>
  )
}
