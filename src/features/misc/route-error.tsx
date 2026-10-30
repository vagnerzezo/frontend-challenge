import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorState } from '@/components/feedback'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="container-k py-16">
      <ErrorState
        title="Algo deu errado nesta tela"
        error={error}
        onRetry={() => {
          reset()
          router.invalidate()
        }}
      />
    </div>
  )
}
