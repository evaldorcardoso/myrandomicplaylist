# PRD — MR Playlist

**Versão do documento:** 1.2
**Última atualização:** 12/10/2026
**Versão do produto (as-is):** 3.25.18
**Autor / Owner:** Curador proprietário (uso pessoal)
**Status:** Aprovado — Fase 0 (Fundação & Segurança) concluída (ver §5.1 e §6)

> Este PRD é o **destino durável** do contexto da Fase 0: decisões travadas
> (§6), arquitetura-alvo do fluxo de auth (§6), telemetria (§4.7) e itens
> adiados / débito conhecido (§7). O antigo `PLANO-FASE-0.md` foi removido após
> a migração (recuperável no histórico do git).

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

| KPI | Métrica | Baseline (12/10/2026) | Meta |
|---|---|---|---|
| Receita controlada | % de slots pagos registrados no `earnings_ledger` sobre o total de slots pagos | **100,00 %** (33/33) | ≥ 98% |
| Tempo economizado | Tempo médio para renovar um anúncio expirado (do alerta à conclusão) | TBD (telemetria ativa; série ainda curta) | < 60 s |
| Retenção de anunciantes | % de anunciantes com ≥ 2 compras/renovações no trimestre | **23,68 %** (18/76) | ≥ 60% |
| Ocupação de slots | % médio de posições ocupadas nas playlists gerenciadas | **1,89 %** | ≥ 85% |
| Confiabilidade | Erros não tratados por sessão de uso | — (telemetria ativa) | 0 erros críticos/semana |
| Performance | Tempo de entrada em página de playlist com 500 faixas | TBD (medição via `playlist_load.ms`) | < 1,5 s |
| Expiração perdida | Anúncios expirados sem ação de renovação há > 7 dias | **0** | 0 |

> **Baseline da Fase 0:** os 4 KPIs deriváveis por SQL foram calculados e
> registrados em [`docs/baselines-fase-0.md`](baselines-fase-0.md), com as
> consultas canônicas para recalculá-los. Os 3 KPIs que dependem de telemetria de
> produto (tempo economizado, confiabilidade e performance) derivam de
> `product_events` — contrato em §4.7; a partir do snapshot há dados fluindo, mas
> ainda sem série suficiente para fixar o valor de partida.

---

## 2. Experiência do Usuário & Funcionalidades

### 2.1 Personas

| Persona | Quem é | Objetivo principal |
|---|---|---|
| **Curador (primário)** | O proprietário do app e das playlists no Spotify | Vender posições, cobrar, renovar e controlar receita com o mínimo de trabalho manual |
| **Anunciante / Requester** (secundário, fora do app) | Artista, selo ou divulgador que compra posições | Ser adicionado à playlist e ser lembrado/renovado sem atrito |

> **Escopo definitivo:** a ferramenta é de **uso pessoal de um único curador (dono único e estrito)**. O modelo de dados usa o ID do Spotify e a chave anon do Supabase. A autenticação passou a ser **Supabase Auth com o provider Spotify** (o antigo OAuth Authorization Code com segredo no frontend foi removido) e o banco tem **RLS de dono**; **abrir para novos curadores / modelo multi-tenant permanece fora de escopo** (decisão 1; decisão 4 revogada — ver §6).

### 2.2 Jornada principal (fluxo do curador)

```
Login (Supabase Auth · provider Spotify)
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

Todas as rotas autenticadas ficam sob `components/Layout.vue` (Sidebar + TopBar + FloatPlayer + modal de slot) e passam pelo guard `isLogged`, que verifica a **sessão do Supabase** (`supabase.auth.getSession()`) — não há mais token do Spotify no `localStorage`.

### 2.4 Histórias de usuário e critérios de aceite

#### Épico A — Autenticação e sessão
- **História:** Como curador, quero entrar com minha conta Spotify para que o app acesse minhas playlists.
- **Critérios de aceite:**
  - [ ] Login via **Supabase Auth** com o provider Spotify (`supabase.auth.signInWithOAuth`, mesmos escopos): `/login` → Spotify → `/callback`.
  - [ ] No callback, o `provider_refresh_token` é enviado à Edge Function `spotify-token` (`action: store`) e **nunca** fica no navegador.
  - [ ] Access token do Spotify é cacheado em memória e renovado **server-side** pela `spotify-token` (`action: refresh`) antes de expirar, deduplicando renovações concorrentes.
  - [ ] 401 do Spotify força uma renovação e repete a requisição uma vez; falha de credencial (`no_credentials`/`invalid_grant`) → `signOut` + `/login`.
  - [ ] Sessão expirada redireciona para `/login` sem tela branca.
  - [ ] Dono único marcado por `app_metadata.role = 'owner'`; `anon` não acessa dados de negócio (RLS de dono).

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
- **Multi-tenant / contas para novos curadores** — decisão do owner: **não abrir para novos curadores**. O app usa **Supabase Auth** (provider Spotify), mas com **um único dono estrito**; não há cadastro, convite nem isolamento por curador.
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

- **Determinismo:** heurísticas testáveis com entradas fixas (sem dependência de rede) — coberto desde a Fase 0 por testes unitários (Vitest) de `playlistCompatibility`, `occupancyCache`, `helpers.hexToRgba` e do helper de telemetria.
- **Observabilidade:** registrar (log/telemetria) sugestões mostradas vs. aceitas para calibrar pesos de gênero/curador. A captura genérica de eventos de produto existe desde a Fase 0 (§4.7), mas a instrumentação específica de sugestões mostradas × aceitas ainda não foi feita.
- **Automação de expiração:** medir taxa de entrega de push e taxa de renovação pós-alerta.

---

## 4. Especificações Técnicas

### 4.1 Arquitetura (as-is)

- **Frontend SPA:** Vue 3 (`<script setup>`) + Vite 6, Pinia, Vue Router, Tailwind CSS v4 (`@theme` custom em `src/assets/main.css`), SCSS.
- **PWA:** `vite-plugin-pwa` com `injectManifest` (`src/sw.ts`), `registerType: 'autoUpdate'`. Precache + `NavigationRoute` (denylist para `api.spotify.com`, CDNs do Spotify e `*.supabase.co`) + `CacheFirst` para imagens do Spotify (50 entradas / 30 dias). Handlers de `push` e `notificationclick`. Manifest: "MR Playlist / MRP", descrição "Painel de curadoria de playlists do Spotify", tema `#62faf5`. `ReloadPWA.vue` avisa atualizações.
- **Backend/BaaS:** Supabase — **Auth** (provider Spotify), Postgres + client JS `supabase-js` (com RLS de dono) e **duas Edge Functions Deno**: `spotify-token` (`supabase/functions/spotify-token/index.ts`, renovação server-side do token do Spotify) e `notify-expiration` (`supabase/functions/notify-expiration/index.ts`, Web Push). Há também `scripts/notify-expiration.js` (mesma lógica, `--dry-run`) acionável pelo workflow manual `.github/workflows/notify-expiration.yml`.
- **APIs externas:** Spotify Web API (chamadas diretas do browser via axios, com access token curto renovado server-side).

```
Browser (Vue/PWA)
   ├── supabase-js ──► Supabase Auth (provider Spotify) ──► Spotify (Authorization Code + client secret no servidor)
   ├── supabase-js ──► Supabase (Postgres)  (playlists, track_requests, ledger...; RLS de dono via JWT)
   ├── supabase.functions.invoke ──► Edge Function spotify-token ──► Spotify (refresh; guarda o refresh token)
   ├── supabase.functions.invoke ──► Edge Function notify-expiration ──► Web Push
   └── axios ──► Spotify Web API        (playlists, player, upload de capa; access token curto)
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
| `spotify_credentials` | Credencial de longa duração do Spotify (só no servidor) | `user_id` (FK `auth.users`, on delete cascade), `provider_refresh_token`, `updated_at`; RLS ligado **sem policy de cliente** (exclusiva da Edge Function `spotify-token` via `service_role`) |
| `product_events` | Telemetria mínima de produto (Fase 0) | `id` (uuid), `user_id`, `session_id` (uuid), `event`, `props` (jsonb), `created_at`; RLS de dono (`owner_full_access`), retenção de 180 dias |

> **RLS de dono (Fase 0.3):** as 8 tabelas de negócio de §4.3 **e** `product_events` usam a policy `owner_full_access` (`to authenticated using (public.is_owner()) with check (public.is_owner())`), com `is_owner()` = `app_metadata.role = 'owner'`. O papel `anon` não lê nem escreve dados de negócio.

> **Débito de nomenclatura:** `PlaylistService.js` usa a tabela literal `playlists`, enquanto `usePlaylistData.js` usa `VITE_SUPABASE_PLAYLISTS_TABLE` (= `playlists_statistics`) para likes. O nome da env é enganoso. Padronizar na Fase 2 (ver §7).

### 4.4 Integrações e fluxos de token

- **Login:** Supabase Auth com o provider Spotify (`supabase.auth.signInWithOAuth({ provider: 'spotify' })` em `views/Login.vue`), redirect para `window.location.origin + '/callback'`. O Redirect URI cadastrado no Spotify Developer Dashboard é `https://<projeto>.supabase.co/auth/v1/callback`.
- **Token do Spotify:** o Supabase entrega, na sessão, um `provider_token` curto (~1 h) e um `provider_refresh_token`. O refresh token é enviado por `src/support/spotifyToken.js` → Edge Function `spotify-token` (`action: store`) e guardado em `spotify_credentials`; o access token curto vive apenas em memória no navegador.
- **Renovação:** `getSpotifyToken()` renova server-side (`action: refresh`) um pouco antes de expirar, deduplicando chamadas concorrentes; o interceptor do axios injeta o token e repete a requisição uma vez em caso de 401.
- **Scopes solicitados:** `user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private user-read-playback-state user-modify-playback-state user-top-read`.
- **Endpoints usados (direto do browser, com access token curto):** `/me`, `/me/top/tracks`, `/me/playlists`, `/me/player*`, `/playlists/{id}` (+ `/tracks`, `/images`), `/users/{id}/playlists`, `/tracks/{id}`, `/albums/{id}`, `/artists`.
- **Armazenamento:** preferências e cache de perfil em `localStorage` (`spotify_filter_library`, `user`, `spotify_settings`); a sessão do Supabase é gerida pelo `supabase-js`. **Nenhum token do Spotify nem segredo fica no navegador.**

### 4.5 Segurança e privacidade

**Postura atual (após a Fase 0) — riscos tratados e remanescentes:**

- **✅ Segredo de cliente do Spotify:** resolvido. O segredo saiu do bundle e vive só no servidor (provider Spotify do Supabase Auth + Edge Function `spotify-token`); o CI falha se `SPOTIFY_CLIENT_SECRET` reaparecer em `src/`. Em vez de PKCE, a decisão foi **Supabase Auth** (D1).
- **✅ Auth/RLS no Supabase:** resolvido — e a premissa anterior estava incorreta: **já existia RLS, mas era ineficaz**, com 22 policies permissivas (`using(true)`/`with check(true)` para `public`), incluindo `DELETE` de `anon` em `push_subscriptions` (backup em `supabase/backups/2026-10-12-policies-public-before-owner-rls.sql`). A Fase 0.3 trocou tudo por `owner_full_access` (`is_owner()` = `app_metadata.role = 'owner'`), revogou `TRUNCATE`/`TRIGGER`/`REFERENCES` e isolou `spotify_credentials` sem policy de cliente.
- **🟠 Dados pessoais:** nomes de anunciantes/curadores e valores financeiros armazenados; requerem proteção (LGPD — finalidade, minimização, retenção). `product_events` guarda `user_id`/`session_id`; retenção de 180 dias.
- **🟡 Chave anon exposta (por design):** a chave anon continua no bundle; o que protege os dados é o RLS de dono, não o sigilo da chave.
- **✅ Segredos em arquivos/DX:** resolvido. `.env` fora do versionamento; envs órfãs (`VITE_NOTION_*`, `VITE_SUPABASE_DATABASE_PASS`, `VITE_APP_TITLE`, `NODE_ENV`) e o segredo do Spotify removidos; `.env.example` reflete só o que o frontend usa.

### 4.6 Qualidade e testes (pós-Fase 0)

- **Lint + CI + testes:** ESLint flat config (`eslint.config.mjs`, com `no-console` no nível `warn` e `allow: ['error']`) com blocos para `src`/`scripts`/`supabase/functions`; Vitest com testes das heurísticas (`playlistCompatibility`, `occupancyCache`, `helpers.hexToRgba`) e da telemetria; workflow `.github/workflows/ci.yml` roda `lint` → `build` → `test` em push/PR, além da **checagem anti-regressão** que falha se `SPOTIFY_CLIENT_SECRET` aparecer em `src/`.
- **Logs de debug:** removidos (~142 ocorrências em ~27 arquivos); `grep` por `console.log/warn/info/debug` em `src/` = 0. `console.error` em blocos `catch` foi mantido.
- **Bug do guard do router:** corrigido (Fase 0.2) — `isLogged` usa `supabase.auth.getSession()` e retorna após `next()`.
- **Código morto/duplicado:** removido (Fase 0.4) — `spotifyApi.getRecommendations`, `PlaylistDetailsService.getAudience`, `FinanceService.sumLedger*`, `PushService.listSubscriptions/getSubscription`, `TrackRequestService.getPricePositionsWithMetadata`.
- **Artefatos indevidos:** `dist/`, `dev-dist/`, `db.json`, arquivos `*.Zone.Identifier` e `.kilo/` fora do versionamento; `.gitignore` reforçado.
- **Env/config:** `vite.config.js` usa `base: '/'` (o antigo `publicPath` era opção inválida e silenciosamente ignorada); `.env` e `.env.example` alinhados (`VITE_APP_URL=http://localhost:5173`).

### 4.7 Telemetria de produto (`product_events`)

Helper `track(event, props)` em `src/support/telemetry.js` — best-effort (nunca quebra o app), grava na tabela `product_events` com `session_id` (uuid por carregamento de página, em `sessionStorage`) anexado a todo evento.

| Evento | Propriedades | Quando dispara |
|---|---|---|
| `playlist_load` | `{ playlist_id, tracks, ms }` | ao terminar a montagem da página de playlist |
| `error` | `{ scope, message }` | em captura global de erro (`App.vue` / interceptor) |
| `renewal_started` | `{ track_request_id, playlist_id }` | ao abrir a ação de renovação a partir do alerta |
| `renewal_completed` | `{ track_request_id, type }` | ao marcar o slot como pago |

- **Métricas derivadas:** tempo de renovação (mediana `renewal_completed − renewal_started`); erros por sessão (`count(error) ÷ distinct session_id`); tempo de entrada em playlist (percentil de `playlist_load.ms` com `tracks ≥ 500`).
- **Retenção:** 180 dias, com expurgo diário via `pg_cron` (`delete from public.product_events where created_at < now() - interval '180 days'`).

---

## 5. Riscos & Roadmap

### 5.1 Roadmap faseado

> Baseline = versão de produção no início da Fase 0 (3.25.17). As fases abaixo são incrementais.

**Fase 0 — Fundação & Segurança (pré-requisito) — ✅ concluída (12/10/2026)**
- Auth migrada para **Supabase Auth + provider Spotify** (não PKCE), com renovação de token **server-side** pela Edge Function `spotify-token`; client secret fora do bundle (ver §6, D1–D6).
- **RLS de dono** aplicado nas 9 tabelas de negócio/telemetria; `spotify_credentials` isolada no servidor (ver §4.5).
- **Métricas de produto** instrumentadas (`product_events` + `track()`); baselines dos 4 KPIs deriváveis por SQL em [`docs/baselines-fase-0.md`](baselines-fase-0.md).
- Bug do guard do router corrigido; código morto, envs órfãs, logs de debug e artefatos removidos.
- **Linter + CI** (lint/build/test + guarda anti-segredo) e primeiros testes unitários das heurísticas.

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

| Risco | Impacto | Status | Mitigação |
|---|---|---|---|
| Segredo do Spotify exposto | Alto (abuso/banimento do app) | ✅ Resolvido (Fase 0) | Segredo só no servidor (Supabase Auth + `spotify-token`); guarda anti-regressão no CI |
| Auth/RLS ineficaz no Supabase | Alto (vazamento de dados de negócio/PII) | ✅ Resolvido (Fase 0) | RLS de dono (`is_owner()`); `anon` bloqueado; grants perigosos revogados |
| Rate limits / mudanças da Spotify Web API | Médio | Monitorado | Cache, backoff, monitorar depreciações |
| Confiança no push para receita | Médio | Aberto | Fallback in-app/e-mail; medir entrega |
| Débito técnico travando evolução | Médio | Reduzido | Linter + CI + testes das heurísticas (cobertura parcial — ver §7) |
| Drift de env/config (`base`, `.env`) | Médio (falhas de deploy) | ✅ Resolvido (Fase 0) | `base: '/'` e envs alinhadas/documentadas |
| Performance de páginas grandes | Médio | Mitigado | Padrão `markRaw` + revisão; KPI < 1,5 s via telemetria |

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
| 3 | Instrumentar baselines dos KPIs? | **Sim** — executado na Fase 0 | Baselines dos 4 KPIs em [`docs/baselines-fase-0.md`](baselines-fase-0.md); telemetria em §4.7 |
| 4 | Auth própria (Supabase Auth)? | **REVOGADA.** ~~Não por enquanto~~ — a Fase 0 adotou **Supabase Auth + provider Spotify** (ver D1) | Non-Goal de auth própria removido; §2.1, §4.1, §4.4 e §6 reescritos |

> **Revisão da decisão 4 (Fase 0):** o problema real não era "ter auth própria", mas o **segredo do Spotify no bundle**. A solução escolhida não foi PKCE, e sim **mover a autenticação para o Supabase Auth** (provider Spotify), com renovação de token server-side. A ferramenta **continua single-user**: a decisão 1 permanece intacta.

### 6.1 Decisões travadas na Fase 0 (D1–D6)

| # | Decisão | Escolha |
|---|---|---|
| D1 | Auth | **Supabase Auth** com o **provider Spotify** (já configurado no projeto). Substitui o OAuth Authorization Code com segredo no frontend. |
| D2 | Token do Spotify pós-login | Renovação **server-side** via **Edge Function** `spotify-token` (o Supabase **não** renova o `provider_token`; o Spotify exige o client secret para o refresh). |
| D3 | Armazenamento do `provider_refresh_token` | Tabela **`spotify_credentials`** com RLS de dono e **sem acesso pelo navegador** (só a Edge Function com `service_role`). |
| D4 | Multi-dispositivo | **Suportado.** A credencial do Spotify é compartilhada no servidor; cada aparelho faz login uma vez (sessão Supabase própria). |
| D5 | Proteção de dados | RLS de dono em todas as tabelas de negócio, com autorização por `app_metadata.role = 'owner'` (não editável pelo usuário). **Dono único e estrito.** |
| D6 | Métricas | Baselines deriváveis por **SQL** (registrados em [`docs/baselines-fase-0.md`](baselines-fase-0.md)) + tabela **`product_events`** mínima com helper `track()` para os 3 KPIs que exigem telemetria. |

### 6.2 Arquitetura-alvo do fluxo de autenticação

```
Browser                         Supabase                     Spotify
  │                                │                            │
  │─ signInWithOAuth('spotify') ─► │                            │
  │                                │── OAuth (Authorization ──► │
  │                                │   Code + client secret)    │
  │                                │◄─ code ─────────────────── │
  │◄─ sessão Supabase (JWT) ────── │   (troca por tokens no     │
  │   + provider_token (1h)        │    servidor do Supabase)   │
  │   + provider_refresh_token     │                            │
  │                                │                            │
  │─ invoke('spotify-token',       │                            │
  │   { action:'store',            │                            │
  │     provider_refresh_token })─►│ grava em spotify_credentials│
  │                                │                            │
  │─ invoke('spotify-token',       │                            │
  │   { action:'refresh' }) ──────►│── refresh (client secret)─►│
  │◄─ access_token (curto) ─────── │◄─ novo access_token ────── │
  │                                │   (upsert se rotacionar)   │
  │─ axios ──► Spotify Web API (usa access_token) ──────────────►│
  │─ supabase-js ──► Postgres (RLS de dono, via JWT)             │
```

**Regra de ouro:** o navegador só toca em tokens descartáveis (JWT do Supabase e access token curto do Spotify). O segredo do Spotify e o refresh token de longa duração vivem apenas no servidor.

**Ordem de aplicação do RLS (evita lockout):** o dono foi marcado (**Fase 0.2**) **antes** de as políticas restritivas entrarem em vigor (**Fase 0.3**). Todo o banco é aplicado via MCP, sem arquivos de migration (`AGENTS.md`); as políticas anteriores foram exportadas em `supabase/backups/2026-10-12-policies-public-before-owner-rls.sql` para rollback.

> **Nota:** a prioridade "onboarding de novos curadores" levantada inicialmente foi **cancelada** pela decisão 1 e não compõe o roadmap.

---

## 7. Itens adiados / débito conhecido (fora da Fase 0)

Registrados ao fim da Fase 0 e absorvidos por este PRD. A maioria tem origem no antigo `PLANO-FASE-0.md` (removido na #64; recuperável no git); os itens de banco vêm dos advisors do Supabase. Não bloqueiam a Fase 1.

| Item | Descrição | Quando |
|---|---|---|
| FKs sem índice | 4 foreign keys sem índice de cobertura (advisor de performance): `playlists_statistics.playlist_id`, `track_popularity.playlist_id`, `track_requests.playlist_id`, `track_requests.requester_id`. Impacto baixo no volume atual. | Fase 2 |
| Nomes enganosos de env | `VITE_SUPABASE_PLAYLISTS_TABLE` aponta para `playlists_statistics` (não para `playlists`) — ver §4.3. Padronizar quando conveniente. | Fase 2 |
| Agregação de receita | `FinanceService.sumLedger*` foi removido como código morto; a agregação de receita volta junto com os relatórios. | Fase 2 |
| Cobertura de testes | Além das heurísticas puras e da telemetria, faltam testes de componentes/views. | Fase 2+ |
| Índice ocioso | `product_events_created_at_idx` criado e ainda não usado (advisor de performance); remover se continuar sem uso. | Fase 2 |
| Default privileges do `supabase_admin` | Tabelas futuras criadas por `supabase_admin` ainda recebem `TRUNCATE/TRIGGER/REFERENCES` (grantor diferente de `postgres`). Revisar quando surgirem. | Monitorar |
| Sugestões mostradas × aceitas | Instrumentação específica das heurísticas de curador/compatibilidade para calibrar pesos (ver §3.2). | Fase 2 |

---

## Apêndice A — Mapa de arquivos

- **Views:** `src/views/{Dashboard,Library,Playlist,Randomic,Player,Estatisticas,Financeiro,Configuracoes,Login,Callback}.vue`
- **Components:** `src/components/{Layout,Sidebar,TopBar,FloatPlayer,AddToPlaylistModal,SellSlotModal,SlotManagementModal,OrphanRequestModal,EditPlaylistModal,ConfirmRemovePlaylistModal,SortConfirmModal,SortingProgressModal,ReloadPWA}.vue`
- **Stores:** `src/stores/{user,playlist,settings,notifications}.js`
- **Services:** `src/services/{PlaylistService,DashboardService,TrackRequestService,FinanceService,PlaylistDetailsService,PushService}.js`
- **Composables:** `src/composables/{usePlaylistData,usePushNotifications,useCuratorSuggestions}.js`
- **Support:** `src/support/{spotifyApi,spotifyToken,supabaseClient,helpers,telemetry,occupancyCache,requesterCuratorCache,playlistCompatibility}.js` (+ `src/axios-plugin.js`)
- **PWA/Backend:** `src/sw.ts`, `supabase/functions/spotify-token/index.ts`, `supabase/functions/notify-expiration/index.ts`, `scripts/notify-expiration.js`, `supabase/backups/*.sql`, `.github/workflows/{ci,notify-expiration}.yml`, `eslint.config.mjs`, `vitest.config.js`, `vite.config.js`
- **Testes:** `tests/{helpers,occupancyCache,playlistCompatibility,telemetry}.test.js`
