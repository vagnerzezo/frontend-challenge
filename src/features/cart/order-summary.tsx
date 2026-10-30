import type { UseQueryResult } from '@tanstack/react-query'
import type { Quote } from '@/api/contracts'
import { errorMessage } from '@/components/feedback'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-start justify-between gap-3', strong && 'border-t border-line pt-3')}>
      <dt className={cn('text-sm', strong && 'font-bold')}>{label}</dt>
      <dd className={cn('text-right text-sm tabular-nums', strong && 'text-base font-bold text-accent')}>
        {value}
        {hint && <span className="block text-[10px] text-accent">{hint}</span>}
      </dd>
    </div>
  )
}

// os valores sempre vêm da cotação da API, nunca são calculados aqui
export function OrderSummary({ quote, className }: { quote: UseQueryResult<Quote>; className?: string }) {
  const { data, isPending, isError, error, isFetching, refetch } = quote
  if (isPending && !data) {
    return (
      <div className={cn('space-y-3', className)} aria-busy="true" data-testid="summary-skeleton">
        <span className="sr-only" role="status">
          Calculando resumo…
        </span>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }
  if (isError && !data) {
    return (
      <div role="alert" className={cn('rounded-md border border-danger/60 p-3 text-xs text-danger', className)}>
        {errorMessage(error, 'Não foi possível calcular o resumo.')}{' '}
        <button type="button" className="underline" onClick={() => refetch()}>
          Recalcular
        </button>
      </div>
    )
  }
  if (!data) return null
  return (
    <div className={className}>
      <dl className={cn('space-y-3 transition-opacity', isFetching && 'opacity-60')} aria-busy={isFetching} data-testid="order-summary">
        <Row label="Subtotal" value={formatEth(data.subtotal)} />
        <Row
          label={data.coupon ? `Desconto (${data.coupon.code}, ${data.coupon.percentOff}%)` : 'Desconto do lançamento'}
          value={`(-) ${formatEth(data.discount, { suffix: false })}`}
        />
        <Row label="Taxa de rede" value={formatEth(data.networkFee)} hint="Taxa estimada" />
        <Row label="Total" value={formatEth(data.total)} strong />
      </dl>
      {isFetching && (
        <p className="mt-2 text-[11px] text-muted" role="status">
          Atualizando valores…
        </p>
      )}
      {isError && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {errorMessage(error)}
        </p>
      )}
    </div>
  )
}
