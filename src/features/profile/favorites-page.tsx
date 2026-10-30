import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { nftQuery, useFavorites } from '@/api/queries'
import { EmptyState, ErrorState } from '@/components/feedback'
import { NftCard } from '@/components/nft/nft-card'
import { CardSkeleton } from '@/features/home/catalog'

export function FavoritesPage() {
  const { data: favorites, isPending, isError, error, refetch } = useFavorites()
  const ids = favorites ? [...favorites] : []
  const nfts = useQueries({ queries: ids.map((id) => ({ ...nftQuery(id), staleTime: 60_000 })) })

  return (
    <section aria-labelledby="fav-title">
      <h1 id="fav-title" className="mb-5 text-sm font-bold">
        Lista de interesse
      </h1>
      {isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : ids.length === 0 ? (
        <EmptyState title="Nenhum favorito ainda">
          <p className="text-sm text-muted">Toque no coração de um NFT para acompanhá-lo aqui.</p>
          <Link to="/" hash="catalogo" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-ink">
            Explorar o mercado
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3" data-testid="favorites-grid">
          {nfts.map((query, index) => (query.data ? <NftCard key={ids[index]} nft={query.data} /> : <CardSkeleton key={ids[index]} />))}
        </div>
      )}
    </section>
  )
}
