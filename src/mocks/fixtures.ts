import type { CollectionSlug, Edition, Network, Nft, Wallet } from '@/api/contracts'

// Fixtures determinísticas: mesmo seed => mesmo catálogo.

export const COLLECTION_LABELS: Record<CollectionSlug, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

type Character = { image: string; attributes: string[]; collectionName: string }

const CHARACTERS: Record<string, Character> = {
  emerald: { image: '/nfts/emerald-ape.webp', attributes: ['Óculos', 'Esmeralda', 'Raro'], collectionName: 'Kurio Apes' },
  sage: { image: '/nfts/sage-nomad.webp', attributes: ['Chapéu', 'Moletom', 'Calmo'], collectionName: 'Kurio Nomads' },
  ivory: { image: '/nfts/ivory-baron.webp', attributes: ['Blazer', 'Gola alta', 'Elegante'], collectionName: 'Kurio Barons' },
  golden: { image: '/nfts/golden-beat.webp', attributes: ['Fones', 'Dourado', 'Ritmo'], collectionName: 'Kurio Beats' },
}

// NFTs desenhados no Figma (nome, número, personagem, preço).
const FIGMA_NFTS: Array<[string, string, keyof typeof CHARACTERS, string, string | null, CollectionSlug, Network, boolean]> = [
  ['Emerald Ape', '042', 'emerald', '1.19', null, 'arte-digital', 'ethereum', false],
  ['Sage Nomad', '009', 'sage', '1.69', null, 'arte-digital', 'ethereum', false],
  ['Neon Vessel', '552', 'ivory', '1.99', '2.29', 'colecionaveis', 'ethereum', true],
  ['Cosmic Bloom', '118', 'sage', '1.29', null, 'generativa', 'polygon', false],
  ['Violet Nomad', '314', 'sage', '1.39', null, 'arte-digital', 'ethereum', false],
  ['Ivory Baron', '088', 'ivory', '1.79', null, 'arte-3d', 'ethereum', false],
  ['Golden Beat', '207', 'golden', '0.99', null, 'musica', 'polygon', false],
  ['Golden Frequency', '071', 'golden', '0.59', null, 'musica', 'solana', false],
  ['Golden Signal', '160', 'golden', '0.39', null, 'musica', 'ethereum', false],
]

const EXTRA_NAMES = [
  'Amber', 'Basalt', 'Cobalt', 'Dune', 'Ember', 'Fern', 'Glacier', 'Harbor', 'Indigo', 'Jade', 'Kiln', 'Lumen',
  'Mosaic', 'Nimbus', 'Onyx', 'Prism', 'Quartz', 'Rust', 'Saffron', 'Tidal', 'Umber', 'Velvet', 'Willow', 'Zenith',
  'Atlas', 'Bramble', 'Cinder', 'Delta', 'Echo', 'Flint', 'Garnet', 'Halo', 'Iris', 'Juniper', 'Kestrel', 'Lark',
  'Marble', 'Nova', 'Opal',
]
const EXTRA_SUFFIX = ['Ape', 'Nomad', 'Baron', 'Beat', 'Vessel', 'Signal', 'Bloom', 'Monk']
const COLLECTIONS = Object.keys(COLLECTION_LABELS) as CollectionSlug[]
const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']

// gerador de números "aleatórios" com semente (algoritmo mulberry32):
// a mesma semente gera sempre a mesma sequência, então o catálogo é sempre igual
function createRandom(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function buildEditions(price: string, random: () => number, soldOutOneOfOne: boolean): Edition[] {
  return [
    { id: '1-1', label: '1/1', supply: 1, available: soldOutOneOfOne ? 0 : 1, price },
    { id: '1-10', label: '1/10', supply: 10, available: 3 + Math.floor(random() * 7), price },
    { id: '1-50', label: '1/50', supply: 50, available: 12 + Math.floor(random() * 30), price },
    { id: 'aberta', label: 'Aberta', supply: null, available: 99, price },
  ]
}

function buildNft(
  index: number,
  name: string,
  number: string,
  character: Character,
  price: string,
  previousPrice: string | null,
  collection: CollectionSlug,
  network: Network,
  rare: boolean,
  random: () => number,
): Nft {
  const fullName = `${name} #${number}`
  const editions = buildEditions(price, random, index % 3 === 0)
  let available = 0
  for (const edition of editions) available += edition.available
  const createdAt = new Date(Date.UTC(2026, 8, 30) - index * 86_400_000 * 1.5)
  return {
    id: slugify(fullName),
    name: fullName,
    tokenId: `#${number.padStart(4, '0')}`,
    image: character.image,
    gallery: [character.image, character.image, character.image, character.image],
    price,
    previousPrice,
    rare,
    network,
    collection,
    collectionName: character.collectionName,
    available,
    version: 1,
    description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${NETWORK_LABELS[network]}, com arte desbloqueável e acesso para colecionadores.`,
    longDescription: [
      `${fullName} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    attributes: character.attributes,
    rating: 4 + Math.round(random() * 10) / 10,
    reviewsCount: 5 + Math.floor(random() * 30),
    contract: `0x7A${number}...19E8 · Contrato inteligente ERC-721 verificado.`,
    royalties: 'Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.',
    editions,
    reviews: REVIEWS.slice(0, 1 + (index % REVIEWS.length)),
    createdAt: createdAt.toISOString(),
  }
}

export function buildCatalog(): Nft[] {
  const random = createRandom(20261029)
  const nfts: Nft[] = FIGMA_NFTS.map(([name, number, characterKey, price, previousPrice, collection, network, rare], index) =>
    buildNft(index, name, number, CHARACTERS[characterKey], price, previousPrice, collection, network, rare, random),
  )

  // Emerald Ape #042 é o NFT de referência do Figma: 19 avaliações, 1/50 com estoque
  nfts[0].reviewsCount = 19
  nfts[0].rating = 4.8

  const characters = Object.values(CHARACTERS)
  EXTRA_NAMES.forEach((baseName, extraIndex) => {
    const index = FIGMA_NFTS.length + extraIndex
    const suffix = EXTRA_SUFFIX[extraIndex % EXTRA_SUFFIX.length]
    const number = String(100 + Math.floor(random() * 899))
    const price = (0.05 + Math.floor(random() * 1200) / 100).toFixed(2)
    const rare = random() > 0.85
    const previousPrice = random() > 0.85 ? (Number(price) + 0.3).toFixed(2) : null
    const character = characters[extraIndex % characters.length]
    const collection = COLLECTIONS[extraIndex % COLLECTIONS.length]
    const network = NETWORKS[(extraIndex * 7) % 3]
    nfts.push(buildNft(index, `${baseName} ${suffix}`, number, character, price, previousPrice, collection, network, rare, random))
  })
  return nfts
}

export const REVIEWS = [
  { author: 'Lia Andrade', rating: 5, text: 'Acabamento impecável e procedência clara. Chegou na carteira em segundos.' },
  { author: 'Caio Prado', rating: 5, text: 'A arte desbloqueável em alta resolução vale a edição.' },
  { author: 'Maya Torres', rating: 4, text: 'Ótima coleção; gostaria de mais atributos raros.' },
]

// Credenciais fictícias documentadas no README. Senhas nunca ficam em claro no "banco".
export const SEED_USERS = [
  {
    id: 'usr_nova',
    username: 'novasato',
    email: 'colecionador@kurio.dev',
    password: 'Kurio@2026',
    displayName: 'Nova Sato',
    walletNickname: 'Principal',
    ensName: 'nova',
  },
  {
    id: 'usr_ravi',
    username: 'ravilemos',
    email: 'segundo@kurio.dev',
    password: 'Kurio@2026',
    displayName: 'Ravi Lemos',
    walletNickname: 'Cofre',
    ensName: 'ravi',
  },
] as const

export const SEED_WALLETS: Array<Wallet & { userId: string }> = [
  {
    id: 'wal_nova_primary',
    userId: 'usr_nova',
    slot: 'primary',
    displayName: 'Nova Sato',
    nickname: 'Principal',
    network: 'ethereum',
    profileName: 'nova',
    address: '0xA91F3b6C0d9e4f7a2B5c8D1e6F0a3B7c9D2eE82C',
    secondaryAddress: '',
    provider: 'metamask',
    referralCode: 'KURIO-NOVA',
    email: 'colecionador@kurio.dev',
    ensName: 'nova',
    updatedAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 'wal_nova_secondary',
    userId: 'usr_nova',
    slot: 'secondary',
    displayName: 'Nova Sato',
    nickname: 'Reserva',
    network: 'polygon',
    profileName: 'nova',
    address: '0x5E2d7A4c9B1f3E6a8D0c2B4f6A8e0C2d4F6a8B10',
    secondaryAddress: 'nova.kurio.eth',
    provider: 'coinbase',
    referralCode: 'KURIO-NOVA',
    email: 'colecionador@kurio.dev',
    ensName: 'nova.kurio',
    updatedAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 'wal_ravi_primary',
    userId: 'usr_ravi',
    slot: 'primary',
    displayName: 'Ravi Lemos',
    nickname: 'Cofre',
    network: 'ethereum',
    profileName: 'ravi',
    address: '0x1234567890aBcDeF1234567890aBcDeF12345678',
    secondaryAddress: '',
    provider: 'walletconnect',
    referralCode: 'KURIO-RAVI',
    email: 'segundo@kurio.dev',
    ensName: 'ravi',
    updatedAt: '2026-10-01T12:00:00.000Z',
  },
]

export const SEED_FAVORITES: Record<string, string[]> = {
  usr_nova: ['emerald-ape-042'],
  usr_ravi: [],
}

export const COUPONS: Record<string, { percentOff: number; expiresAt: string }> = {
  KURIO10: { percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  GENESIS5: { percentOff: 5, expiresAt: '2099-12-31T23:59:59.000Z' },
  EXPIRADO: { percentOff: 15, expiresAt: '2025-01-01T00:00:00.000Z' },
}

export const NETWORK_FEE = '0.016'
