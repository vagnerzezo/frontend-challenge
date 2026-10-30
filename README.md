# Kurio — Marketplace de NFTs

Implementação do desafio frontend **NFT Marketplace** (layout Figma "Frontend Challenge") com React + TypeScript, TanStack Router/Query, Axios, Socket.IO, Tailwind CSS, shadcn/ui, MSW, Playwright e Lighthouse.

Todos os dados, autenticação, carteiras e pagamentos são **simulados na camada de rede (MSW)**: REST via Service Worker e Socket.IO via interceptação de WebSocket. Não há backend real.

> Arquitetura, contratos REST/eventos, política de sessão/cache e desvios do Figma: veja [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Requisitos

- Node.js ≥ 20 (testado com 22.23)
- pnpm ≥ 9 (lockfile `pnpm-lock.yaml`)

## Setup

```bash
pnpm install
pnpm exec playwright install chromium   # apenas para testes E2E e Lighthouse
pnpm dev                                # http://localhost:5173 (mocks ativos)
```

## Comandos

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Desenvolvimento com mocks (MSW + Socket.IO simulado) |
| `pnpm build` | Verificação de tipos + build otimizado (mocks inclusos para a demonstração) |
| `pnpm preview` | Serve o build em `http://localhost:4173` |
| `pnpm typecheck` | Verificação de tipos (`tsc -b`) |
| `pnpm lint` | ESLint |
| `pnpm test:e2e` | Playwright (Chromium desktop 1440px + mobile 390px), faz build + preview automaticamente |
| `pnpm test:e2e:update` | Regenera as baselines de regressão visual |
| `pnpm test:e2e:report` | Abre o relatório HTML (`playwright-report/`) |
| `pnpm lighthouse` | Auditoria Lighthouse (build otimizado, 3 medições por página/perfil) |

## Variáveis de ambiente

Definidas em `.env` (versionado, valores fictícios) — copie para `.env.local` para sobrescrever.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada de mocks (MSW). Deve ser `true` no build de demonstração publicado. |
| `VITE_MOCK_LATENCY` | `fast` | Perfil de latência padrão: `none`, `fast`, `slow`, `variable` |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Endpoint (fictício) do Socket.IO, interceptado pelo MSW |
| `VITE_HTTP_TIMEOUT_MS` | `10000` | Timeout das chamadas REST (Axios) |

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Nova Sato (2 carteiras, 1 favorito) | `colecionador@kurio.dev` | `Kurio@2026` |
| Ravi Lemos (1 carteira) | `segundo@kurio.dev` | `Kurio@2026` |

Cupons: `KURIO10` (10%), `GENESIS5` (5%), `EXPIRADO` (expirado). Qualquer outro código é inválido.

## Simulação

Pelo console do navegador, `window.__kurio` dá acesso aos controles da API simulada: `setConfig`, `reset`, `updateNft`, `replayEvent`, `dropSocket`, `expireSessions` e `disconnectWallets`. As alterações persistem após refresh.

Condições de rede (`setConfig`): latência `none`, `fast`, `slow` (2.5s) ou `variable` (100ms–2s, determinística por URL); `offline: true` (erro de rede); `serverDown: true` (HTTP 503).

**Reset:** `await window.__kurio.reset()` restaura integralmente o banco simulado (seed determinístico), a configuração e o estado do tempo real.

### Reproduzindo fluxos pelo console

| Fluxo | Passos |
| --- | --- |
| Preço alterado com carrinho aberto | Adicione um NFT, abra `/carrinho` e rode `window.__kurio.updateNft('<id>', { price: '1.50' })` — aviso + resumo atualizado |
| Pedido pendente + refresh/queda | Confirme a compra e recarregue durante "Pagamento pendente", ou rode `window.__kurio.dropSocket(5000)` |
| Eventos duplicados/antigos | Altere um preço duas vezes e rode `window.__kurio.replayEvent('duplicate')` / `replayEvent('stale')` |
| Sessão expirada | `window.__kurio.expireSessions()` e navegue para uma área privada |
| Falha e nova tentativa | `window.__kurio.setConfig({ offline: true })`, depois `{ offline: false }` → "Tentar novamente" |
| Skeletons | `window.__kurio.setConfig({ latency: 'slow' })` |

## Testes

```bash
pnpm test:e2e            # 84 testes (42 por viewport)
pnpm test:e2e:report     # relatório HTML; traces de falhas em test-results/
```

- Arquivos `e2e/01..12-*.spec.ts` cobrem os itens do enunciado (os fluxos de falha que dependiam dos cenários da simulação — pagamento recusado, timeout do pedido, carteira recusada, cotação desatualizada, edição esgotada no pedido, erro de favoritos, catálogo com erro e respostas fora de ordem — não são mais testados); `e2e/visual.spec.ts` faz regressão visual de início, detalhe, carrinho e pagamento (baselines em `e2e/__screenshots__/`).
- Cada teste roda em um `BrowserContext` novo, com `localStorage` vazio e seed determinístico, e latência configurada antes do primeiro carregamento.
- Eventos em tempo real passam pelo `socket.io-client`; REST passa pelos handlers MSW.

## Lighthouse

```bash
pnpm lighthouse
```

Configuração versionada em `lighthouse/config.json`. Os relatórios HTML/JSON de cada medição e o resumo com medianas, versões e ambiente ficam em `lighthouse/reports/` (`summary.md` / `summary.json`).

## Deploy (Vercel)

1. Importe o repositório na Vercel (framework Vite, detectado via `vercel.json`).
2. Mantenha `VITE_ENABLE_MOCKS=true` (padrão do `.env`).
3. `vercel.json` já inclui rewrite SPA (acesso direto e refresh de qualquer rota) e cabeçalhos do `mockServiceWorker.js`.

## Assets

As imagens de NFT em `public/nfts/` são **provisórias**: foram recortadas das capturas do layout. Para usar os assets originais, exporte do Figma e substitua os arquivos mantendo os mesmos nomes: `emerald-ape.webp`, `sage-nomad.webp`, `ivory-baron.webp` e `golden-beat.webp` (480×480). Depois rode `pnpm test:e2e:update` para atualizar as baselines visuais.
# frontend-challenge
# frontend-challenge
# frontend-challenge
