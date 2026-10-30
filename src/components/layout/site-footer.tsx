import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { outOfScope } from '@/lib/out-of-scope'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from './brand-icons'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com', Icon: InstagramIcon },
  { label: 'Twitter', href: 'https://twitter.com', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com', Icon: YoutubeIcon },
]

function UnavailableLink({ children }: { children: string }) {
  return (
    <li>
      <button type="button" aria-disabled="true" className="inline-block py-1 text-left text-xs text-cream/90 hover:text-accent" onClick={() => outOfScope(children)}>
        {children}
      </button>
    </li>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          setError('Informe um e-mail válido.')
          return
        }
        setError(null)
        outOfScope('A inscrição em alertas de lançamento')
      }}
    >
      <h2 className="text-sm font-bold leading-tight">Antecipe-se ao próximo lançamento</h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para alertas
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={!!error}
          aria-describedby={error ? 'newsletter-error' : 'newsletter-hint'}
          className="h-9 min-w-0 flex-1 rounded-l-md border border-line bg-ink px-3 text-xs placeholder:text-subtle"
        />
        <button type="submit" className="rounded-r-md bg-accent px-3 text-sm font-bold text-accent-ink hover:bg-accent-strong">
          Enviar
        </button>
      </div>
      {error ? (
        <p id="newsletter-error" className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p id="newsletter-hint" className="text-[11px] leading-relaxed text-muted">
          Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
        </p>
      )}
    </form>
  )
}

export function SiteFooter() {
  return (
    <footer className="container-k mt-16 pb-28 md:pb-6">
      <div className="rounded-t-[var(--radius-card)] bg-surface">
        <div className="grid gap-8 p-6 md:grid-cols-4 md:gap-0 md:p-8">
          {FEATURES.map((feature) => (
            <section key={feature.letter} className="md:border-r md:border-accent/60 md:px-5">
              <span aria-hidden className="mb-3 grid size-12 place-items-center rounded-full bg-accent text-lg font-bold text-accent-ink">
                {feature.letter}
              </span>
              <h2 className="text-sm font-bold">{feature.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted">{feature.text}</p>
            </section>
          ))}
          <div className="md:pl-5">
            <Newsletter />
          </div>
        </div>
        <div className="grid gap-3 bg-band px-6 py-5 text-xs sm:grid-cols-2 md:grid-cols-4 md:px-8">
          <span className="font-bold tracking-[0.2em]">KURIO</span>
          <span>Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-accent">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-accent">
            +55 11 4002 8922
          </a>
        </div>
        <div className="grid grid-cols-2 gap-8 px-6 py-8 md:grid-cols-4 md:px-8">
          <nav aria-label="Meu perfil">
            <h2 className="mb-2 text-sm font-bold">Meu perfil</h2>
            <ul className="space-y-0 text-xs">
              <li>
                <Link to="/perfil" className="inline-block py-1 hover:text-accent">
                  Meu perfil
                </Link>
              </li>
              <li>
                <Link to="/perfil/favoritos" className="inline-block py-1 hover:text-accent">
                  Lista de interesse
                </Link>
              </li>
              <UnavailableLink>Minha coleção</UnavailableLink>
              <UnavailableLink>Atividade</UnavailableLink>
              <UnavailableLink>Estúdio do criador</UnavailableLink>
            </ul>
          </nav>
          <nav aria-label="Central de ajuda">
            <h2 className="mb-2 text-sm font-bold">Central de ajuda</h2>
            <ul className="space-y-0">
              <UnavailableLink>Central de ajuda</UnavailableLink>
              <UnavailableLink>Como comprar NFTs</UnavailableLink>
              <UnavailableLink>Carteira e segurança</UnavailableLink>
              <UnavailableLink>Política do mercado</UnavailableLink>
              <UnavailableLink>Denunciar item</UnavailableLink>
            </ul>
          </nav>
          <nav aria-label="Coleções">
            <h2 className="mb-2 text-sm font-bold">Coleções</h2>
            <ul className="space-y-0 text-xs">
              {[
                ['arte-digital', 'Arte digital'],
                ['fotografia', 'Fotografia'],
                ['musica', 'Música'],
                ['arte-3d', 'Arte 3D'],
                ['utilidade', 'Utilidade'],
              ].map(([slug, label]) => (
                <li key={slug}>
                  <Link to="/" search={{ collections: [slug as 'arte-digital'] }} hash="catalogo" className="inline-block py-1 hover:text-accent">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="mb-2 text-sm font-bold">Redes sociais</h2>
            <ul className="flex gap-1.5">
              {SOCIAL.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (abre em nova aba)`}
                    className="grid size-7 place-items-center rounded border border-accent text-accent hover:bg-accent hover:text-accent-ink"
                  >
                    <Icon className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 mb-2 text-sm font-bold">Carteiras compatíveis</h2>
            <p className="inline-block rounded bg-band px-2 py-1 text-[9px] font-bold tracking-wide text-accent">
              METAMASK · WALLETCONNECT · COINBASE
            </p>
          </div>
        </div>
      </div>
      <p className="py-5 text-center text-xs">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
