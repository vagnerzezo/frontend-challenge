import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function QuantityStepper({ value, min = 1, max, onChange, label, disabled, size = 'md' }: Props) {
  const buttonClass = cn(
    'grid place-items-center rounded-full bg-accent text-accent-ink disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle',
    size === 'sm' ? 'size-5' : 'size-7',
  )
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={buttonClass} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label={`Diminuir ${label.toLowerCase()}`}>
        <Minus className="size-3.5" aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-5 text-center text-sm tabular-nums">
        {value}
      </output>
      <button type="button" className={buttonClass} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label={`Aumentar ${label.toLowerCase()}`}>
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
