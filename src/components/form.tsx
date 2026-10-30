import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Field({
  label,
  error,
  required,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode
  error?: string
  required?: boolean
  hint?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }) => ReactNode
  className?: string
  htmlFor?: string
}) {
  const generatedId = useId()
  const id = htmlFor ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  // liga o input às mensagens de erro/dica para leitores de tela
  const describedByIds = []
  if (error) describedByIds.push(errorId)
  if (hint) describedByIds.push(hintId)
  const describedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-sm">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-[11px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'h-10 w-full min-w-0 rounded-md border border-line bg-transparent px-3 text-sm placeholder:text-subtle focus-visible:border-accent aria-invalid:border-danger disabled:opacity-60 read-only:bg-surface/60'

export const TextInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function TextInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />
})

export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function PasswordInput({ className, ...props }, ref) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={cn(inputClass, 'pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded text-subtle hover:text-cream"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
      >
        {show ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
      </button>
    </div>
  )
})

export const NativeSelect = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(inputClass, 'appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23c9a07c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...props}>
      {children}
    </select>
  )
})

// mostra no formulário os erros de campo que vieram da API (422/409)
export function applyServerErrors<T extends string>(
  fields: Record<string, string> | undefined,
  setError: (name: T, error: { type: string; message: string }) => void,
  allowedFields: readonly T[],
) {
  if (!fields) return false

  let foundError = false
  for (const [name, message] of Object.entries(fields)) {
    if ((allowedFields as readonly string[]).includes(name)) {
      setError(name as T, { type: 'server', message })
      foundError = true
    }
  }
  return foundError
}
