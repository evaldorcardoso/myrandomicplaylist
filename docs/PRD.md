# PRD — MR Playlist

**Versão do documento:** 1.1
**Última atualização:** 11/10/2026
**Versão do produto (as-is):** 3.25.17
**Autor / Owner:** Curador proprietário (uso pessoal)
**Status:** Aprovado (decisões de escopo resolvidas — ver Seção 6)

> **Nota de contexto.** O `README.md` e o `AGENTS.md` do repositório descrevem o app como um "gerador de playlists aleatórias". Isso já não reflete o produto real, que evoluiu para um **painel profissional de curadoria de playlists**: venda e gestão de posições ("slots"), controle financeiro, ledger de ganhos, expiração/renovação de anúncios e notificações push. Este PRD documenta o produto **como ele é hoje (as-is)** e propõe um **roadmap** de evolução.

---

## 1. Sumário Executivo

### 1.1 Problema

O curador de playlists do Spotify administra, de forma totalmente manual e dispersa, a venda de posições (slots) dentro das suas playlists: quem comprou qual posição, por quanto, até quando, se já pagou, se o anúncio expirou e se deve renovar. As ferramentas existentes (planilhas, WhatsApp, anotações) não conversam com a API do Spotify, o que gera:

- **Perda de receita** por anúncios expirados que ninguém percebeu a tempo.
- **Ineficiência operacional**: retrabalho manual para conferir posições, cobrar, marcar pagos e reordenar faixas.
- **Risco de erro humano** no controle de posições e valores por faixa de posição.
- **Falta de visão financeira** consolidada (quanto entrou, o que é novo vs. renovação).

### 1.2 Solução proposta

Um **painel web (PWA)** que integra as playlists do próprio curador via Spotify Web API com um backend Supabase, transformando a operação de venda de slots em um fluxo único: visualizar ocupação por posição, vender/renovar posições, registrar pagamentos em um ledger financeiro, alertar sobre expirações (in-app e push) e sincronizar a ordem das faixas direto no Spotify.

### 1.3 Critérios de sucesso (KPIs)

| KPI | Métrica | Baseline | Meta |
|---|---|---|---|
| Receita controlada | % de slots pagos registrados no `earnings_ledger` sobre o total de slots ocupados | TBD (instrumentar) | ≥ 98% |
| Tempo economizado | Tempo médio para renovar um anúncio expirado (do alerta à conclusão) | TBD (medir) | < 60 s |
| Retenção de anunciantes | % de anunciantes com ≥ 2 compras/renovações no trimestre | TBD (instrumentar) | ≥ 60% |
| Ocupação de slots | % médio de posições ocupadas nas playlists gerenciadas | TBD (calcular) | ≥ 85% |
| Confiabilidade | Erros não tratados por sessão de uso | — | 0 erros críticos/semana |
| Performance | Tempo de entrada em página de playlist com 500 faixas | TBD (baseline pós-`markRaw`) | < 1,5 s |
| Expiração perdida | Anúncios expirados sem ação de renovação há > 7 dias | — | 0 |

> **Ação de instrumentação:** hoje não há telemetria de produto. Fase 0 do roadmap inclui medir os baselines acima antes de tratá-los como metas.

---

## 2. Experiência do Usuário & Funcionalidades

### 2.1 Personas

| Persona | Quem é | Objetivo principal |
|---|---|---|
| **Curador (primário)** | O proprietário do app e das playlists no Spotify | Vender posições, cobrar, renovar e controlar receita com o mínimo de trabalho manual |
| **Anunciante / Requester** (secundário, fora do app) | Artista, selo ou divulgador que compra posições | Ser adicionado à playlist e ser lembrado/renovado sem atrito |

> **Escopo definitivo:** a ferramenta é de **uso pessoal de um único curador**. O modelo de dados usa o ID do Spotify e chave anon do Supabase. Autenticação permanece **somente Spotify OAuth** e **abrir para novos curadores / modelo multi-tenant está fora de escopo** (decisão do owner — ver Seção 6).

### 2.2 Jornada principal (fluxo do curador)

```
Login Spotify (OAuth)
      │
      ▼
Dashboard ──► KPIs (receita do mês, ocupação, expirados, seguidores)
      │        Alertas de expiração ──► [Renovar] / [Copiar WhatsApp] / [Push]
      │
      ├─► Library ──► selecionar playlist ──► Detalhe da Playlist
      │                                              │
      │                                              ├─► Vender slot (SellSlotModal)
      │                                              ├─► Gerenciar slot (pago/renovar/liberar/trocar)
      │                                              ├─► Ordenar e sincronizar com Spotify
      │                                              └─► Estatísticas (likes/seguidores/gêneros)
      │
      ├─► Mixar (Randomic) ──► gerar playlist aleatória ──► salvar no Spotify
      ├─► Player / FloatPlayer ──► tocar, adicionar faixa, vender slot
      ├─► Financeiro ──► ledger de ganhos (novo/renovação)
      └─► Configurações ──► preços por posição, push, paginação
```

### 2.3 Rotas (as-is)

| Rota | Nome | View | Auth |
|---|---|---|---|
| `/` | Home | `views/Dashboard.vue` | Sim |
| `/library` | Library | `views/Library.vue` | Sim |
| `/playlist/:id` | Playlist | `views/Playlist.vue` | Sim |
| `/playlist/:id/stats` | PlaylistStats | `views/Estatisticas.vue` | Sim |
| `/random` | Random ("Mixar") | `views/Randomic.vue` | Sim |
| `/player` | Player | `views/Player.vue` | Sim |
| `/configuracoes` | Configuracoes | `views/Configuracoes.vue` | Sim |
| `/financeiro` | Financeiro | `views/Financeiro.vue` | Sim |
| `/login` | Login | `views/Login.vue` | Público |
| `/callback` | Callback | `views/Callback.vue` | Público |

Todas as rotas autenticadas ficam sob `components/Layout.vue` (Sidebar + TopBar + FloatPlayer + modal de slot) e passam pelo guard `isLogged` (presença de `spotify_access_token` no localStorage).

### 2.4 Histórias de usuário e critérios de aceite

#### Épico A — Autenticação e sessão
- **História:** Como curador, quero entrar com minha conta Spotify para que o app acesse minhas playlists.
- **Critérios de aceite:**
  - [ ] Fluxo Authorization Code: `/login` → authorize → `/callback` → troca de `code` por tokens.
  - [ ] Tokens (`access`, `refresh`, `expire_time`) persistidos no localStorage.
  - [ ] Refresh proativo (interceptor de request) e reativo (401 → refresh + retry com fila) funcionando.
  - [ ] Sessão expirada redireciona para `/login` sem tela branca.

#### Épico B — Dashboard
- **História:** Como curador, quero ver o resumo do meu negócio em uma tela para tomar decisões rápido.
- **Critérios de aceite:**
  - [ ] Cards: receita do mês, ocupação/posições ativas, faixas expiradas, seguidores.
  - [ ] Tabela de playlists com barra de ocupação e valor médio de slot.
  - [ ] Widget de expiração com ações Renovar / Push / Copiar WhatsApp (grava `notified_at`).
  - [ ] Widgets de próximas expirações e pedidos recentes.
  - [ ] Skeletons de carregamento (sem layout shift).

#### Épico C — Biblioteca e detalhe de playlist
- **História:** Como curador, quero selecionar uma playlist e ver a ocupação por posição.
- **Critérios de aceite:**
  - [ ] Library lista todas as playlists do Spotify (paginado) + marca quais estão "gerenciadas".
  - [ ] Filtros: Todas / Minhas / Públicas / Privadas / Curadoria.
  - [ ] Detalhe com abas: Todas / Expira em breve / Expiradas / Disponíveis / Pendentes + busca + paginação.
  - [ ] Cada posição exibe estado do slot (`free`/`pending`/`paid`), valor e contagem regressiva de expiração.
  - [ ] Detecção de divergência de posição vs. Spotify, com correção individual e em lote.

#### Épico D — Venda e gestão de slots
- **História:** Como curador, quero vender uma posição e registrar o pagamento para controlar minha receita.
- **Critérios de aceite:**
  - [ ] `SellSlotModal`: escolher requester + curador, valor, vencimento (padrão +1 mês), marcar pago.
  - [ ] Gravação em `track_requests` + `earnings_ledger` (+ auto `price_positions` quando aplicável).
  - [ ] `SlotManagementModal`: marcar pago (`new`/`renewal`), renovar, liberar, remover/trocar/mover faixa, corrigir posição Spotify.
  - [ ] `OrphanRequestModal`: editar/excluir pedidos cuja faixa saiu da playlist.
  - [ ] Ordenação + sincronização com Spotify (`updateTracksOrder`, `SortingProgressModal`) e `SortConfirmModal` quando a ordem local divergir.

#### Épico E — Adicionar faixa / vender
- **História:** Como curador, quero adicionar uma faixa a uma playlist compatível e já oferecer a venda.
- **Critérios de aceite:**
  - [ ] `AddToPlaylistModal` sugere playlists compatíveis por score de gênero (`playlistCompatibility.js`).
  - [ ] Modo orgânico vs. pago; inserção em posição (com tratamento de colisão/relocação) ou no fim.
  - [ ] Checagem de duplicidade e encadeamento opcional com o fluxo de venda.

#### Épico F — Mixar (padrão aleatório)
- **História:** Como curador, quero gerar playlists aleatórias para preencher/renovar conteúdo.
- **Critérios de aceite:**
  - [ ] Wizard em 2 passos: quantidade (1–200), modo (Aleatório / Por popularidade / Top do usuário), seleção de fontes.
  - [ ] Prévia com popularidade e checkboxes; salvar no Spotify (chunks de 100) ou adicionar à fila.

#### Épico G — Player
- **Critérios de aceite:**
  - [ ] Controles play/pause/next/prev, barra de progresso, seleção/troca de dispositivo.
  - [ ] Ações sobre a faixa atual: adicionar à playlist, vender slot, copiar faixa/artista.
  - [ ] `FloatPlayer` global (poll a cada 10 s no `Layout.vue`).

#### Épico H — Estatísticas
- **Critérios de aceite:**
  - [ ] Gráfico de crescimento de likes (15/30/90D) e tendência de seguidores.
  - [ ] Top 5 artistas e mix de gêneros.
  - [ ] Ação "salvar estatísticas diárias" (likes + faixa) em `playlists_statistics`.

#### Épico I — Financeiro
- **Critérios de aceite:**
  - [ ] Listagem do `earnings_ledger` com filtros por mês e período customizado.
  - [ ] Totais (geral e por tipo `new`/`renewal`).

#### Épico J — Configurações
- **Critérios de aceite:**
  - [ ] Ajustes avançados: tamanhos de página, tamanhos de lote, nº de gêneros, exibição do dashboard.
  - [ ] Toggle de push notifications (`usePushNotifications.js`).
  - [ ] CRUD de preço por faixa de posição (`price_positions`), agrupado por playlist.

### 2.5 Non-Goals (fora de escopo)

- **Descoberta/scouting de anunciantes** ou marketplace público de compra de slots (não é uma plataforma de compra self-service).
- **Processamento de pagamento nativo no app** — a cobrança é feita por **lembrete/link + conciliação manual** (decisão do owner, ver Seção 6). Nenhuma integração de gateway na versão as-is nem no roadmap próximo.
- **Multi-tenant / autenticação própria de usuários** — decisão do owner: **não abrir para novos curadores**. A auth permanece somente Spotify OAuth.
- **Onboarding de novos curadores** (convites, isolamento por curador, produto multi-usuário).
- **App nativo iOS/Android** — a entrega é PWA.
- **Moderação/verificação de conteúdo** das faixas anunciadas.
- **Migração para TypeScript** como objetivo em si (pode ser meio, não fim).

---

## 3. Automação & Inteligência Heurística

> O produto **não usa IA generativa**. As seções abaixo documentam os componentes heurísticos/automáticos que se beneficiam de avaliação formal (adaptação da seção "AI System Requirements" do template).

### 3.1 Componentes heurísticos

| Componente | Onde | O que faz | Como avaliar |
|---|---|---|---|
| Compatibilidade de playlist | `support/playlistCompatibility.js` | Score de gênero para sugerir a playlist mais aderente à faixa | Precisão da playlist top-1 aceita pelo curador; validar com conjunto de faixas conhecidas |
| Sugestão de curador | `composables/useCuratorSuggestions.js` | Sugere curador/requester com base em histórico (cache 30 dias) | Taxa de aceite das sugestões top-3 |
| Ocupação / ganhos | `support/occupancyCache.js` | Agrega ocupação e receita com TTL (1h/6h) | Consistência com recálculo direto do Supabase |
| Expiração e renovação | `PushService.js` + edge function `notify-expiration` | Alerta expirações via push; função poda inscrições obsoletas (404/410) | % de alertas entregues; nº de expirações sem ação em 7 dias |

### 3.2 Estratégia de avaliação

- **Determinismo:** heurísticas devem ser testáveis com entradas fixas (sem dependência de rede) — hoje inexistente (sem testes).
- **Observabilidade:** registrar (log/telemetria) sugestões mostradas vs. aceitas para calibrar pesos de gênero/curador.
- **Automação de expiração:** medir taxa de entrega de push e taxa de renovação pós-alerta.

---

## 4. Especificações Técnicas

### 4.1 Arquitetura (as-is)

- **Frontend SPA:** Vue 3 (`<script setup>`) + Vite 6, Pinia, Vue Router, Tailwind CSS v4 (`@theme` custom em `src/assets/main.css`), SCSS.
- **PWA:** `vite-plugin-pwa` com `injectManifest` (`src/sw.ts`), `registerType: 'autoUpdate'`. Precache + `NavigationRoute` (denylist para `api.spotify.com`, CDNs do Spotify e `*.supabase.co`) + `CacheFirst` para imagens do Spotify (50 entradas / 30 dias). Handlers de `push` e `notificationclick`. Manifest: "MR Playlist / MRP", tema `#62faf5`. `ReloadPWA.vue` avisa atualizações.
- **Backend/BaaS:** Supabase (Postgres + client JS `supabase-js`) e uma **Edge Function Deno** (`supabase/functions/notify-expiration/index.ts`) para push. Há também `scripts/notify-expiration.js` (mesma lógica, `--dry-run`) acionável pelo workflow manual `.github/workflows/notify-expiration.yml`.
- **APIs externas:** Spotify Web API (chamadas diretas do browser via axios).

```
Browser (Vue/PWA)
   ├── axios ──► Spotify Web API        (OAuth, playlists, player, upload de capa)
   ├── supabase-js ──► Supabase (Postgres)  (playlists, track_requests, ledger...)
   └── supabase.functions.invoke ──► Edge Function notify-expiration ──► Web Push
```

### 4.2 Estado e performance

- **Pinia (Options API):** `user`, `playlist`, `settings`, `notifications`.
- **Padrão de performance obrigatório (regra do `AGENTS.md`):** objetos de faixa do Spotify armazenados como **`markRaw`** no store; mutações em dados brutos não reactivos + **contadores de revisão explícitos** (`playlistRevision`, `slotsVersion`, `slotRevision`) para disparar recomputação. Motivo histórico: escrita em objetos profundamente reativos causava travamentos de ~8–16 s por loop (a página de playlist congelava ~30 s).
- **Regras a manter:** nunca mutar propriedades de objetos de faixa reativos (`track.id = ...`, `track._slot`, `track.track.popularity_old`, `track.track.tracked`); não inserir heartbeat/`performance.now()`/experimentos de debug no código commitado; não confiar na reatividade de dados não-reativos.

### 4.3 Modelo de dados (Supabase)

| Tabela | Finalidade | Campos principais |
|---|---|---|
| `playlists` | Playlists gerenciadas | `id` (Spotify), `name`, `image`, `items`, `genres`, `top_artists`, `order` |
| `track_popularity` (`VITE_SUPABASE_TRACKS_TABLE`) | Snapshot de popularidade por faixa | `track_id`, `popularity`, `playlist_id` |
| `playlists_statistics` (`VITE_SUPABASE_PLAYLISTS_TABLE`) | Histórico de likes (~10 últimas linhas) | `playlist_id`, `likes_count`, `created_at` |
| `track_requests` | Slots vendidos/solicitados | `playlist_id`, `track_id`, `name`, `position`, `due_date`, `status` (`pending`/`paid`), `value`, `requester_id`, `notified_at` |
| `requesters` | Anunciantes/curadores | `name`, `curator` |
| `price_positions` | Faixas de preço por posição | `playlist_id`, `min_position`, `max_position`, `value`, `color` |
| `earnings_ledger` | Receita | `track_request_id`, `playlist_id`, `playlist_name`, `track_id`, `track_name`, `requester_name`, `curator`, `amount`, `type` (`new`/`renewal`), `created_at` |
| `push_subscriptions` | Inscrições Web Push | `endpoint`, `p256dh`, `auth`, `user_agent` |

> **Débito de nomenclatura:** `PlaylistService.js` usa a tabela literal `playlists`, enquanto `usePlaylistData.js` usa `VITE_SUPABASE_PLAYLISTS_TABLE` (= `playlists_statistics`) para likes. O nome da env é enganoso. Padronizar (ver roadmap / débito técnico).

### 4.4 Integrações e fluxos de token

- **OAuth:** Authorization Code. URL de autorização em `views/Login.vue` (com `state` hardcoded); troca de `code` em `composables/requestToken.js`; redirect `window.location.origin + '/callback'`.
- **Scopes solicitados:** `user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private user-read-playback-state user-modify-playback-state user-top-read`.
- **Endpoints usados (direto do browser):** `/me`, `/me/top/tracks`, `/recommendations`, `/me/playlists`, `/me/player*`, `/playlists/{id}` (+ `/tracks`, `/images`), `/users/{id}/playlists`, `/tracks/{id}`, `/albums/{id}`, `/artists`.
- **Armazenamento:** `spotify_access_token`, `spotify_refresh_token`, `spotify_token_expire_time` (`now + (expires_in − 400) * 1000`) em localStorage/helpers.

### 4.5 Segurança e privacidade

**Riscos identificados (as-is) — priorizados no roadmap:**

- **🔴 Segredo de cliente exposto:** `VITE_SPOTIFY_CLIENT_SECRET` é empacotado no frontend e usado para Basic Auth em `requestToken.js` e `axios-plugin.js`. O segredo do app fica visível a qualquer usuário. Correção: **PKCE** (não exige segredo no cliente) para app pessoal, ou **proxy backend** que guarda o segredo.
- **🟠 Sem auth/RLS no Supabase:** o client usa a chave anon e as tabelas guardam dados de negócio (valores, contratantes, receita). Sem RLS/Auth próprios, a chave anon exposta permite leitura/escrita indevida conforme as políticas do projeto. Correção: habilitar RLS com política de dono, ou mover escritas para Edge Function com service role.
- **🟠 Dados pessoais:** nomes de anunciantes/curadores e valores financeiros armazenados; requerem proteção (LGPD — finalidade, minimização, retenção).
- **🟡 Segredos em arquivos/DX:** `.env` versionado/exposto; envs órfãs (`VITE_NOTION_API_KEY`, `VITE_NOTION_DATABASE_ID` sem uso).

### 4.6 Qualidade e testes (as-is)

- **Sem testes, sem linter, sem CI de build** (há apenas o workflow manual de push).
- ~30 `console.log`/`warn` no código commitado.
- Bug: guard do router (`src/router/index.js`) chama `next({name:'Login'})` e depois `next()` sem `return`.
- Código morto/duplicado: `spotifyApi.getRecommendations`, `PlaylistDetailsService.getAudience`, `FinanceService.sumLedger*`, `PushService.listSubscriptions/getSubscription`, `TrackRequestService.getPricePositionsWithMetadata`.
- Artefatos indevidos: `dist/`, `dev-dist/`, `db.json`, arquivos `*.Zone.Identifier`, `.kilo/`.
- Drift de env: `.env` `VITE_APP_URL=:5173` vs `.env.example` `:3000`; `vite.config.js` define `publicPath` (opção inválida; deveria ser `base`) com valor divergente do base documentado.

---

## 5. Riscos & Roadmap

### 5.1 Roadmap faseado

> Baseline = versão atual (3.25.17) em produção. As fases abaixo são incrementais.

**Fase 0 — Fundação & Segurança (pré-requisito)**
- Migrar OAuth para **PKCE** e remover o client secret do bundle.
- Habilitar **RLS** no Supabase (políticas de dono) e revisar exposição de tabelas/dados de negócio.
- Instrumentar **métricas de produto** (baselines da seção 1.3).
- Corrigir bug do guard do router; limpar código morto, envs órfãs, `console.log`, artefatos.
- Adicionar **linter + CI de build** (mínimo) e primeiros testes unitários das heurísticas.

**Fase 1 — Cobrança e renovação (lembrete/link + conciliação manual)**
- Lembretes automáticos de vencimento (push + e-mail/WhatsApp) com cadência configurável.
- Geração de **link de cobrança** (ex.: link de pagamento externo/PIX) e registro da **conciliação manual** no `earnings_ledger`.
- Fluxo de renovação em 1 clique a partir do alerta; históricos de renovação por anunciante.
- **Sem integração nativa de gateway de pagamento** (decisão do owner).

**Fase 2 — Analytics e relatórios**
- Relatórios de desempenho (receita por playlist/anunciante, ocupação ao longo do tempo, renovações).
- Exportação (CSV/PDF) de relatórios financeiros.

**Fase 3 — Mobile / PWA**
- Refino do PWA mobile: gestos, atalhos, push nativo confiável, offline melhorado para consulta de slots.

### 5.2 Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| Segredo do Spotify exposto | Alto (abuso/banimento do app) | PKCE/proxy na Fase 0 |
| Ausência de RLS/Auth no Supabase | Alto (vazamento de dados de negócio/PII) | RLS + políticas de dono na Fase 0 |
| Rate limits / mudanças da Spotify Web API | Médio | Cache, backoff, monitorar depreciações |
| Confiança no push para receita | Médio | Fallback in-app/e-mail; medir entrega |
| Débito técnico (sem testes) travando evolução | Médio | Linter + CI + testes das heurísticas |
| Drift de env/config (`publicPath`, `.env`) | Médio (falhas de deploy) | Padronizar `base` e envs |
| Performance de páginas grandes | Médio | Manter padrão `markRaw` + revisão; orçamento < 1,5 s |

### 5.3 Dependências externas

- Spotify Web API (auth, playlists, player) — mudanças de contrato/rate limit.
- Supabase (Postgres, Edge Functions, Web Push via `web-push`).
- Provedores de push do navegador (VAPID).

---

## 6. Decisões de escopo (resolvidas com o owner)

| # | Decisão | Escolha | Impacto no documento |
|---|---|---|---|
| 1 | Abrir para novos curadores / multi-tenant? | **Não.** Produto permanece de uso exclusivo do proprietário | Multi-tenant e onboarding de curadores movidos para Non-Goals; Fase 2 reescopada para Analytics |
| 2 | Como cobrar? | **Lembrete/link + conciliação manual** (sem gateway) | Fase 1 ajustada; "processamento de pagamento nativo" virou Non-Goal |
| 3 | Instrumentar baselines dos KPIs? | **Sim** | Mantida a ação de instrumentação na Fase 0 |
| 4 | Auth própria (Supabase Auth)? | **Não por enquanto** — mantém somente **Spotify OAuth** | Non-Goal de auth própria; RLS ainda recomendada como política de dono |

> **Nota:** a prioridade "onboarding de novos curadores" levantada inicialmente foi **cancelada** pela decisão 1 e não compõe o roadmap.

---

## Apêndice A — Mapa de arquivos

- **Views:** `src/views/{Dashboard,Library,Playlist,Randomic,Player,Estatisticas,Financeiro,Configuracoes,Login,Callback}.vue`
- **Components:** `src/components/{Layout,Sidebar,TopBar,FloatPlayer,AddToPlaylistModal,SellSlotModal,SlotManagementModal,OrphanRequestModal,EditPlaylistModal,ConfirmRemovePlaylistModal,SortConfirmModal,SortingProgressModal,ReloadPWA}.vue`
- **Stores:** `src/stores/{user,playlist,settings,notifications}.js`
- **Services:** `src/services/{PlaylistService,DashboardService,TrackRequestService,FinanceService,PlaylistDetailsService,PushService}.js`
- **Composables:** `src/composables/{requestToken,usePlaylistData,usePushNotifications,useCuratorSuggestions}.js`
- **Support:** `src/support/{spotifyApi,supabaseClient,helpers,occupancyCache,requesterCuratorCache,playlistCompatibility}.js` (+ `src/axios-plugin.js`)
- **PWA/Backend:** `src/sw.ts`, `supabase/functions/notify-expiration/index.ts`, `scripts/notify-expiration.js`, `.github/workflows/notify-expiration.yml`, `vite.config.js`
