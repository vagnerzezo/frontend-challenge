import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <div className="container-k flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-6xl font-bold text-accent">404</p>
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="max-w-md text-sm text-muted">O endereço acessado não existe ou foi movido.</p>
      <Link to="/" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-ink hover:bg-accent-strong">
        Voltar ao início
      </Link>
    </div>
  )
}
