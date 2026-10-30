import { AlertTriangle, RotateCw, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { isApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function errorMessage(error: unknown, fallback = 'Algo deu errado.') {
  return isApiError(error) ? error.message : fallback
}

export function ErrorState({
  title = 'Não foi possível carregar',
  error,
  onRetry,
  retrying,
  className,
}: {
  title?: string
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-surface p-8 text-center', className)}>
      <AlertTriangle className="size-8 text-danger" aria-hidden />
      <h2 className="font-bold">{title}</h2>
      <p className="max-w-md text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying}>
          <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden />
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-surface p-8 text-center', className)}>
      <SearchX className="size-8 text-accent" aria-hidden />
      <h2 className="font-bold">{title}</h2>
      {children}
    </div>
  )
}

export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Trilha de navegação" className="py-4 text-xs font-semibold">
      <ol className="flex flex-wrap gap-1">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1">
            {index > 0 && <span aria-hidden>/</span>}
            {item.to ? (
              <Link to={item.to} className="hover:text-accent">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
