import { Heart } from 'lucide-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useFavorites, useToggleFavorite } from '@/api/queries'
import { useSession } from '@/session/use-session'
import { cn } from '@/lib/utils'

interface Props {
  nftId: string
  name: string
  variant?: 'icon' | 'button'
  className?: string
}

export function FavoriteButton({ nftId, name, variant = 'icon', className }: Props) {
  const { user } = useSession()
  const { data: favorites } = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (state) => state.location.href })
  const isFavorite = !!favorites?.has(nftId)

  const handleClick = () => {
    if (!user) {
      navigate({ to: '/login', search: { redirect: href } })
      return
    }
    toggle.mutate({ nftId, favorite: !isFavorite, name })
  }

  const label = isFavorite ? `Remover ${name} dos favoritos` : `Favoritar ${name}`
  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isFavorite}
        aria-label={label}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-accent px-3 text-sm text-accent hover:bg-accent/10',
          className,
        )}
      >
        <Heart className="size-4" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden />
        {isFavorite ? 'Favoritado' : 'Favoritar'}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isFavorite}
      aria-label={label}
      className={cn('grid size-8 place-items-center rounded-full bg-ink/80 text-accent hover:bg-ink', className)}
    >
      <Heart className="size-4" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden />
    </button>
  )
}
