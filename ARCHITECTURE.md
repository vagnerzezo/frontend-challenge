# Arquitetura — Kurio

## Visão geral

```
src/
  main.tsx              inicia MSW (se habilitado) e só então importa o app
  app/                  router (TanStack Router), layout raiz, sessão, busca na URL
  api/                  contratos tipados, schemas zod, Axios, endpoints, hooks TanStack Query
  realtime/             cliente Socket.IO (deduplicação, versão, reconciliação)
  session/              store de sessão (useSyncExternalStore) e id do carrinho do visitante
  features/             telas: home, nft, cart, checkout, order, auth, profile
  components/           layout, NFT, formulários, feedback, shadcn/ui adaptado
  mocks/                API simulada: fixtures, banco, domínio, handlers REST, Socket.IO
e2e/                    Playwright (12 grupos + regressão visual)
lighthouse/, scripts/   configuração e script da auditoria
```

**Fluxo de dados:** UI → hooks TanStack Query → `api/endpoints.ts` (Axios) → **MSW** (`mocks/handlers.ts`) → `mocks/domain.ts` → `mocks/db.ts`. As mutações do domínio emitem eventos via `mocks/realtime.ts`, que são recebidos pelo `socket.io-client` e passam por `realtime-provider.tsx` até o cache do TanStack Query.

Os contratos em `src/api/contracts.ts` e as validações em `src/api/schemas.ts` são compartilhados entre cliente e mocks. Componentes, hooks e o cliente Axios **não** contêm respostas fictícias.

## Contratos REST

Base `/api`. Erros seguem `{ error: { code, message, fields?, details? } }`. Valores ETH trafegam como **string decimal**; quantidades são inteiras.

| Método e rota | Descrição | Erros |
| --- | --- | --- |
| `POST /session` `{email,password,guestCartId?}` | Login; mescla o carrinho do visitante | 422, 401 `INVALID_CREDENTIALS` |
| `GET /session` | Consulta a sessão (Bearer) | 401 `UNAUTHENTICATED`/`SESSION_EXPIRED` |
| `DELETE /session` | Logout | — |
| `POST /users` `{username,email,password,guestCartId?}` | Cadastro + sessão | 422, 409 `CONFLICT` (campos) |
| `GET /nfts?q&collections&networks&minPrice&maxPrice&tab&sort&page&pageSize` | Listagem com facetas e eco dos parâmetros aplicados (`applied`) | 503 `TRANSIENT` |
| `GET /nfts/:id` | Detalhe (edições, avaliações, versão) | 404 |
| `GET /favorites` · `PUT/DELETE /favorites/:nftId` | Favoritos do usuário | 401, 404, 500 |
| `GET /cart` | Carrinho (Bearer **ou** `X-Cart-Id` do visitante) | 422 |
| `POST /cart/items` · `PATCH/DELETE /cart/items/:nftId/:editionId` | Alterações do carrinho | 409 `AVAILABILITY_CONFLICT`, 422 |
| `POST /cart/acknowledge` | Reconhece preços alterados (limpa avisos) | — |
| `PUT /cart/coupon` `{code}` · `DELETE /cart/coupon` | Cupom | 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| `POST /quotes` `{fromCart:true}` | Cotação: valida disponibilidade e cupom; retorna subtotal, desconto, taxa, total e `fingerprint` | 409, 422 |
| `GET /wallets` · `POST /wallets` `{slot,...}` · `PUT /wallets/:id` | Carteiras principal/secundária | 422, 409, 403, 404 |
| `POST /wallet-sessions` · `GET/DELETE /wallet-sessions/:id` | Simulação de conexão/recusa/desconexão de carteira | 403 `WALLET_REJECTED` |
| `POST /orders` + `Idempotency-Key` `{quoteId,quoteFingerprint,walletSessionId,buyer}` | Criação idempotente | 409 `QUOTE_STALE` (com `details.quote`), `AVAILABILITY_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `WALLET_DISCONNECTED` |
| `GET /orders/:id` | Estado e recibo (snapshot) | 403 (outro usuário), 404 |
| `GET/PATCH /profile` · `PUT/DELETE /profile/avatar` (multipart) · `POST /profile/password` | Perfil, avatar e senha | 422, 409 |

**Idempotência:**

- Mesma chave e mesmo corpo (hash canônico) devolvem o mesmo pedido (200).
- Mesma chave com corpo diferente retorna 409 `IDEMPOTENCY_CONFLICT`.
- Antes de criar o pedido, o servidor recalcula a cotação. Qualquer diferença de preço, disponibilidade, cupom ou taxa, ou cotação expirada (5 min), retorna `QUOTE_STALE` com a nova cotação.

**Endpoints de controle** (`/__mock/*`, usados apenas pelos testes e pelo console via `window.__kurio`): `state`, `config`, `reset`, `nfts/:id` (PATCH preço/estoque), `events/replay`, `socket/drop`, `sessions/expire`, `wallet-sessions/disconnect`, `orders/:id/resolve`.

## Eventos Socket.IO

Envelope comum: `{ eventId, type, resource: {type,id}, version, occurredAt, payload }`.

| Evento | Payload | Destinatários |
| --- | --- | --- |
| `nft.updated` | `price`, `previousPrice`, `available`, `editions` | todas as conexões |
| `order.updated` | `status`, snapshot do `order` | somente as conexões identificadas com o dono do pedido |
| `session.joined` | `userId` | a própria conexão |

O cliente emite `session.join {token}` ao conectar e a cada troca de sessão.

**Regras do cliente** (`EventGate`):

- `eventId` já visto é ignorado (duplicata).
- `version` menor ou igual à maior versão conhecida — no gate ou no cache — é ignorada. Assim, um evento antigo nunca regride o estado nem reaplica toasts ou invalidações.
- Eventos de pedido só são aplicados se a sessão (`epoch`) que fez o `join` ainda for a atual.

**Reconexão:**

- No `connect` após uma queda, o cliente invalida as consultas **ativas** de NFTs, carrinho, cotação e pedidos, reconciliando com o REST os eventos perdidos.
- Pedidos pendentes também têm *polling* de 10s como fallback.
- Listeners são removidos no cleanup do provider.

### Transporte e limitações no ambiente de mocks

- O cliente usa `transports: ['websocket']`. O MSW intercepta o `WebSocket` global e `@mswjs/socket.io-binding` codifica e decodifica os pacotes engine.io/socket.io.
- O MSW precisa iniciar **antes** de importar o app: o `engine.io-client` captura `globalThis.WebSocket` no import. Por isso `main.tsx` importa o app dinamicamente.
- O handshake é forjado pelo binding e o payload `auth` do CONNECT não é lido. Por isso a identificação é feita com o evento `session.join`.
- Não há namespaces, rooms nem acks: o roteamento por usuário é feito no mock.
- O binding não envia ping. O mock envia o pacote `2` a cada 20s para evitar *ping timeout*.
- Fechar a conexão **antes** do handshake faz o `socket.io-client` desistir de reconectar. Por isso a indisponibilidade simulada aceita o handshake e derruba a conexão logo depois.
- Tudo roda no mesmo processo da página: não há rede real, e outras abas não recebem os eventos umas das outras.

## Sessão

- Token e usuário persistidos em `localStorage` (`kurio.session`) e validados com `GET /session` no boot. A senha nunca é armazenada; no mock, só o hash SHA-256 com sal.
- Qualquer 401 `SESSION_EXPIRED`/`UNAUTHENTICATED` marca a sessão como `expired`. O `SessionManager` então remove os dados privados do cache, avisa o usuário e, se a tela for privada (ou o carrinho), redireciona para `/login?redirect=<url atual>&reason=expired`.
- O login retorna ao destino (`redirect`, validado como caminho interno).
- **Checkout:** o rascunho do formulário fica em `sessionStorage` e o carrinho no servidor, então a retomada após um novo login preserva o contexto.
- Login, logout e troca de usuário incrementam o `epoch`. Isso remove `['user', …]` e `['quote']`, invalida o carrinho e reidentifica o socket.
- Dados privados ficam sob a chave `['user', userId, …]`, isolados por usuário.
- Rotas privadas (`/pagamento`, `/pedido/:id`, `/perfil/*`) são protegidas em `beforeLoad`.

## Carrinho

- O carrinho é um recurso do servidor. O visitante é identificado por `X-Cart-Id` (UUID persistido); o usuário autenticado, pelo Bearer.
- No login ou cadastro, o carrinho do visitante é **mesclado** ao do usuário, respeitando a disponibilidade, e o visitante recebe um novo id.
- Cada linha guarda `priceWhenAdded`. Quando difere do preço atual, a UI informa a alteração; "Entendi" chama `/cart/acknowledge`.
- Os valores exibidos vêm sempre da **cotação** (`POST /quotes`). A chave da consulta inclui a assinatura do carrinho (itens, quantidades, preços e cupom).
- A aritmética usa `big.js` (18 casas) e strings decimais.
- Após a confirmação, o servidor remove do carrinho **apenas** as quantidades compradas. Em falha, nada é removido.

## Checkout

Máquina de estados (`use-checkout.ts`): `idle → reviewing → connecting → submitting → pending → confirmed | rejected | error`.

1. **Revisão:** revalida a cotação na API. Se o `fingerprint` diverge do que o usuário viu, ou se chega um `nft.updated` durante a revisão, a UI mostra as mudanças e exige "Confirmar novos valores".
2. **Tentativa:** `{key, quoteId, fingerprint, walletSessionId, orderId}` é persistida em `localStorage` por usuário.
   - Cliques repetidos são bloqueados por um *lock* e pelo botão desabilitado.
   - `TIMEOUT`/`NETWORK` reenviam com a **mesma chave**, até 3×, e recuperam o mesmo pedido.
3. **Pendente:** é retomado após refresh, pelo `orderId` salvo, e após reconexão, pela reconciliação. A tela de recibo só renderiza pedidos `confirmed`; `pending` e `rejected` têm telas próprias.
4. **Recibo:** é o snapshot imutável do pedido (itens, preços, taxa, cupom). Alterações posteriores no catálogo não o afetam.

## Estratégia de cache, retries e sincronização

| Item | Política |
| --- | --- |
| `staleTime` | 30s (padrão); cotação 15s; `refetchOnWindowFocus` apenas no carrinho |
| Retries | consultas: até 2×, **somente** em falhas transitórias (rede, timeout, 5xx), com backoff exponencial (400ms → 3s); 4xx nunca são repetidos; mutations não repetem (pedidos usam idempotência) |
| Respostas obsoletas | toda `queryFn` repassa o `signal` ao Axios; trocar a chave cancela a requisição anterior; cada chave tem seu cache, então respostas fora de ordem não sobrescrevem a consulta atual (`keepPreviousData` mostra os dados anteriores com o aviso "Atualizando…") |
| Timeout | implementado com `setTimeout` + `AbortController` no interceptor, controlável pelo relógio dos testes |
| Otimista | favoritos: `onMutate` aplica, `onError` faz rollback (ou reset sem snapshot) com feedback, `onSettled` invalida |
| Invalidação | mutações do carrinho gravam a resposta e invalidam `['quote', owner]`; `nft.updated` atualiza detalhe e listas por versão e invalida carrinho e cotação se o NFT estiver no carrinho; `order.updated confirmed` invalida carrinho e cotação |

## MSW

- **Persistência:** o banco simulado fica em `localStorage` (`kurio.mock.db.v1`) e a configuração em `kurio.mock.config`. O reset regrava o seed.
- **Fixtures:** 48 NFTs determinísticos, 9 coleções e 3 redes, mais 2 usuários, carteiras e cupons. Os 9 NFTs do Figma mantêm nomes e preços.
- **Determinismo:** IDs sequenciais, latência por hash da URL.
- **Pedidos pendentes:** resolvidos por timer, retomados no boot e resolvidos sob demanda no `GET`, se vencidos.
- **Build de demonstração:** os mocks entram no build quando `VITE_ENABLE_MOCKS=true`, carregados em chunk separado.

## Acessibilidade

- "Pular para o conteúdo" e foco visível em todos os elementos.
- Diálogos e drawers (Radix) prendem o foco e o devolvem ao gatilho.
- Labels com obrigatoriedade anunciada; erros associados por `aria-describedby`/`aria-invalid`; erros da API aplicados aos campos.
- Regiões `aria-live` (`announce()`) para mutations e eventos em tempo real; status não depende só de cor (texto/ícone).
- Alvos de toque ≥ 24px; `prefers-reduced-motion` desliga o shimmer e as animações.
- Sem overflow horizontal em 390, 768 e 1440 (testado).

## Decisões de UX e desvios do Figma

- **Assets:** as imagens dos NFTs são recortes provisórios das capturas do layout (ver README). A fonte é Roboto Mono (Fontsource, servida localmente).
- **Login/Cadastro:** no desktop são um modal sobre a Início (como no Figma), mas com rotas próprias (`/login`, `/cadastro`), o que permite acesso direto e retorno. No mobile, são telas cheias.
- **Pagamento:** o formulário do Figma foi mantido. "Carteira e rede" combina as carteiras cadastradas (frame mobile) com a escolha do provedor (frame desktop). "Tipo de carteira" e o provedor ficam sincronizados.
- **Confirmação de pedido:** é uma rota (`/pedido/:id`) com a composição do modal do Figma, para permitir refresh e acesso direto. O link "Ver no Etherscan" é simulado.
- **Perfil e Carteiras no mobile:** o menu lateral vira uma faixa rolável horizontal.
- **Fora do escopo:** Criadores, Aprenda, Atividade, Ofertas, Arquivos baixados, Suporte, Diário, login social, recuperação de senha e newsletter mostram o aviso "não disponível nesta demonstração" e nunca simulam sucesso. Os links de redes sociais são externos.
- **Toasts:** aparecem na parte inferior, acima da navegação mobile, para não cobrir o botão de favorito do topo.
- **Validação:** formulários validam no envio e revalidam ao digitar. Validar no *blur* re-renderizava a tela entre o *mousedown* e o *mouseup* do botão de envio e perdia o clique.

## Limitações conhecidas

- O carrinho e o banco simulado vivem no navegador. Outra aba compartilha o `localStorage`, mas não recebe os eventos da outra.
- Avaliações dos NFTs são estáticas (fixtures).
- No modo dev (`StrictMode`), o primeiro socket montado e desmontado pode permanecer registrado no mock até a próxima queda. Isso não acontece no build.
