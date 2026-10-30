import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { outOfScope } from '@/lib/out-of-scope'

const POSTS = [
  { img: '/nfts/ivory-baron.webp', date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.' },
  { img: '/nfts/emerald-ape.webp', date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.' },
  { img: '/nfts/sage-nomad.webp', date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.' },
  { img: '/nfts/golden-beat.webp', date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.' },
]

export function PromoBanners() {
  const banners = [
    { img: '/nfts/emerald-ape.webp', title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores em sua revelação pública.', search: { tab: 'novos' as const } },
    { img: '/nfts/ivory-baron.webp', title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', search: { collections: ['arte-digital' as const] } },
  ]
  return (
    <section aria-label="Coleções em destaque" className="container-k mt-16 grid gap-6 md:grid-cols-2">
      {banners.map((banner) => (
        <article key={banner.title} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] overflow-hidden rounded-[var(--radius-card)] bg-surface">
          <img src={banner.img} alt="" width={240} height={240} loading="lazy" className="aspect-square size-full object-cover" />
          <div className="flex flex-col items-end justify-center gap-2 p-4 text-right">
            <h2 className="text-sm font-bold">{banner.title}</h2>
            <p className="text-[11px] leading-relaxed text-muted">{banner.text}</p>
            <Link to="/" search={banner.search} hash="catalogo" className="mt-1 inline-flex items-center gap-1 rounded bg-accent px-3 py-1 text-xs font-bold text-accent-ink hover:bg-accent-strong">
              Explorar <ArrowRight className="size-3" aria-hidden />
              <span className="sr-only">{banner.title}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

export function Diary() {
  return (
    <section aria-labelledby="diary-title" className="container-k mt-16">
      <h2 id="diary-title" className="text-center text-xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-2 text-center text-xs text-muted">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <article key={post.title} className="overflow-hidden rounded-[var(--radius-card)] bg-surface">
            <img src={post.img} alt="" width={300} height={180} loading="lazy" className="aspect-[5/3] w-full object-cover object-top" />
            <div className="p-3">
              <p className="text-[10px] text-muted">
                {post.date} | Leitura de {post.read} min
              </p>
              <h3 className="mt-2 text-sm font-bold">{post.title}</h3>
              <p className="mt-1 text-[11px] text-muted">{post.text}</p>
              <button type="button" aria-disabled="true" className="mt-2 text-[11px] text-accent hover:underline" onClick={() => outOfScope('O Diário da Cunhagem')}>
                Ler mais →<span className="sr-only"> sobre {post.title}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
