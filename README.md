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

## Cenários da simulação

O botão **"Cenários"** (canto inferior esquerdo) abre o painel da simulação. Ele permite trocar cenário e condições de rede, disparar eventos e restaurar o estado inicial. As alterações persistem após refresh.

Também é possível selecionar o cenário pela URL — `?scenario=<id>` — ou pelo console com `window.__kurio` (`setConfig`, `reset`, `updateNft`, `replayEvent`, `dropSocket`, `expireSessions`, `disconnectWallets`).

| Cenário (`id`) | Efeito |
| --- | --- |
| `default` | Catálogo completo; pagamento confirmado ~3s após o envio |
| `empty-catalog` | Catálogo sem resultados |
| `catalog-error` | Cada consulta ao catálogo falha 3× (HTTP 503) e depois se recupera |
| `out-of-order` | Consultas do catálogo respondem em ordem inversa (1.8s, 0.6s, 0.2s) |
| `favorites-error` | Inclusão/remoção de favoritos retorna HTTP 500 (rollback otimista) |
| `short-session` | Sessão expira 45s após o login |
| `price-change-on-checkout` | Preço do 1º item sobe +0.1 ETH 2s após a cotação do checkout |
| `sold-out-on-checkout` | Edição do 1º item esgota ao criar o pedido |
| `order-timeout` | Pedido é criado, mas a resposta chega após o timeout do cliente |
| `payment-declined` | Pagamento recusado |
| `wallet-reject` | Usuário recusa a conexão da carteira |

Condições de rede (combináveis com qualquer cenário): latência `none`, `fast`, `slow` (2.5s) ou `variable` (100ms–2s, determinística por URL); **sem conexão** (erro de rede); **servidor indisponível** (HTTP 503).

**Reset:** "Restaurar cenário padrão" no painel, ou `await window.__kurio.reset()`. O reset restaura integralmente o banco simulado (seed determinístico), a configuração e o estado do tempo real.

### Reproduzindo os fluxos de falha

| Fluxo | Passos |
| --- | --- |
| Preço alterado com carrinho aberto | Adicione um NFT, abra `/carrinho`, painel → "Alterar preço do 1º item" — aviso + resumo atualizado |
| Cotação desatualizada no checkout | Cenário `price-change-on-checkout`, vá a `/pagamento` → "Confirmar compra" e aguarde 2s na revisão |
| Edição esgotada | Cenário `sold-out-on-checkout` → confirmar a compra |
| Timeout + idempotência | Cenário `order-timeout` → confirmar; após 10s o app reenvia com a mesma chave e recupera o mesmo pedido |
| Pagamento recusado | Cenário `payment-declined` → confirmar; os itens permanecem no carrinho |
| Pedido pendente + refresh/queda | Confirme a compra e recarregue durante "Pagamento pendente", ou use "Derrubar Socket.IO por 5s" |
| Eventos duplicados/antigos | Altere um preço duas vezes e use "Reenviar último evento" / "Reenviar evento antigo" |
| Sessão expirada | Painel → "Expirar sessão agora" e navegue para uma área privada |
| Falha e nova tentativa | Cenário `catalog-error` ou "Sem conexão" → "Tentar novamente" |
| Skeletons | Latência "Lenta (2.5s)" |

## Testes

```bash
pnpm test:e2e            # 100 testes (50 por viewport)
pnpm test:e2e:report     # relatório HTML; traces de falhas em test-results/
```

- Arquivos `e2e/01..12-*.spec.ts` cobrem os 12 itens do enunciado; `e2e/visual.spec.ts` faz regressão visual de início, detalhe, carrinho e pagamento (baselines em `e2e/__screenshots__/`).
- Cada teste roda em um `BrowserContext` novo, com `localStorage` vazio e seed determinístico, e latência configurada antes do primeiro carregamento.
- O relógio é controlado com `page.clock` nos cenários sensíveis a tempo (timeout do pedido, mudança de preço agendada).
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
