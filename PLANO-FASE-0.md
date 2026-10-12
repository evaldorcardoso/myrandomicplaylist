# Plano — Fase 0: Fundação & Segurança

**Versão do documento:** 1.1
**Última atualização:** 11/10/2026
**Referência:** [`docs/PRD.md`](docs/PRD.md) — Fase 0 do roadmap (§5.1) e riscos (§4.5)
**Owner:** Curador proprietário (uso pessoal)

> **v1.1:** incorpora as respostas da checagem do builder (ver §10). Mudanças principais: ordem de aplicação do RLS (evita lockout), fallback do `provider_refresh_token`, definições operacionais dos KPIs e correção de uma contradição na Etapa 4.

---

## 1. Objetivo

Deixar a base **segura, limpa e observável** antes de construir a Fase 1 (cobrança/renovação). Ao final:

- Nenhum segredo do Spotify ou VAPID empacotado no frontend.
- Dados de negócio (receita, PII de anunciantes, pedidos) protegidos por RLS real de dono — a chave anon sozinha não lê nem escreve nada.
- Baselines dos KPIs (§1.3 do PRD) mensuráveis.
- Código sem código morto, sem logs de debug, sem envs órfãs e sem artefatos versionados.
- Linter + CI de build + primeiros testes das heurísticas.

## 2. Decisões travadas

Alteram a **Seção 6 do PRD** (a decisão 4 "sem auth própria" é revogada).

| # | Decisão | Escolha |
|---|---|---|
| D1 | Auth | **Supabase Auth** com o **provider Spotify** (já configurado no projeto). Substitui o OAuth Authorization Code com segredo no frontend. |
| D2 | Token do Spotify pós-login | Renovação **server-side** via **Edge Function** (o Supabase **não** renova o `provider_token`; o Spotify exige o client secret para refresh). |
| D3 | Armazenamento do `provider_refresh_token` | **Tabela `spotify_credentials`** com RLS de dono e **sem acesso pelo navegador** (só a Edge Function com `service_role`). |
| D4 | Multi-dispositivo | **Suportado.** A credencial do Spotify é compartilhada no servidor; cada aparelho faz login uma vez (sessão Supabase própria). |
| D5 | Proteção de dados | RLS de dono em todas as tabelas de negócio, com autorização por `app_metadata.role = 'owner'` (não editável pelo usuário). **Dono único e estrito.** |
| D6 | Métricas | Baselines deriváveis por **SQL** + tabela **`product_events`** mínima com helper `track()` para os 3 KPIs que exigem telemetria. |

## 3. Escopo

**Dentro:** os itens acima e o item §5.1 do PRD (PKCE→substituído por Supabase Auth, RLS, métricas, correção do guard, limpeza, linter/CI/testes).

**Fora (não fazer nesta fase):** multi-tenant/onboarding, auth própria além do Spotify, gateway de pagamento, refino mobile do PWA, migração para TypeScript, integração de e-mail/WhatsApp (é Fase 1).

---

## 4. Arquitetura-alvo do fluxo de autenticação

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

---

## 5. Etapas

### Etapa 1 — Auth Supabase + RLS *(caminho crítico)*

**1.1 Passos operacionais no painel (manual, uma vez)**

- [ ] Supabase → Authentication → Redirect URLs: adicionar `http://localhost:5173/**` e o domínio de produção no Vercel.
- [ ] Supabase → Authentication: **desligar confirmação de e-mail** (app pessoal de usuário único).
- [ ] Spotify Developer Dashboard: conferir se o Redirect URI é `https://nptiiholiyuqxhstuyav.supabase.co/auth/v1/callback`.
- [ ] Confirmar que o provider Spotify está habilitado com Client ID/Secret no Supabase.

**1.2 Banco (via MCP — não criar arquivos de migration)**

> **Ordem de aplicação importa:** para não haver janela de lockout, o dono é marcado **antes** de as políticas restritivas entrarem em vigor.

1. [ ] **Backup das políticas atuais** (exportar `pg_policies` de `public`) para permitir rollback. Aplicar tudo via MCP no banco de produção é a convenção do projeto (o `AGENTS.md` proíbe arquivos de migration); branco de branch não é usado.
2. [ ] Criar `spotify_credentials`:
   ```sql
   create table public.spotify_credentials (
     user_id uuid primary key references auth.users(id) on delete cascade,
     provider_refresh_token text not null,
     updated_at timestamptz not null default now()
   );
   alter table public.spotify_credentials enable row level security;
   -- Sem policies para anon/authenticated: negado por padrão.
   -- Acesso exclusivo da Edge Function (service_role).
   ```
3. [ ] Criar função de autorização: `public.is_owner()` (SQL, `STABLE`, `SECURITY INVOKER`) = `coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'owner', false)`.
4. [ ] **Marcar o dono** *(com as políticas atuais ainda permissivas)*: após o seu 1º login via Supabase Auth, rodar
   `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"owner"}'::jsonb where id = '<seu-uid>'`.
5. [ ] **Só então** substituir **todas** as políticas `qual = true` por políticas de dono:
   - `to authenticated using (public.is_owner()) with check (public.is_owner())`.
   - Lembrar: `UPDATE` exige também uma policy de `SELECT`.
   - Tabelas: `playlists`, `track_popularity`, `playlists_statistics`, `track_requests`, `requesters`, `price_positions`, `earnings_ledger`, `push_subscriptions`.
6. [ ] Revogar grants inúteis do `anon`/`authenticated` (`TRUNCATE`, `TRIGGER`, `REFERENCES`) mantendo `SELECT/INSERT/UPDATE/DELETE` (filtrados pelo RLS).
7. [ ] Corrigir `push_subscriptions` (o anon hoje pode `DELETE` tudo).
8. [ ] **Verificar imediatamente** (ver aceite) e, se algo quebrar, restaurar as políticas do backup.

**1.3 Edge Function `spotify-token` (Deno)**

- [ ] Secrets da função: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (os mesmos do provider).
- [ ] Validação do caller pelo JWT encaminhado em `functions.invoke`.
- [ ] Ação `store`: grava/atualiza `provider_refresh_token` do usuário autenticado.
- [ ] Ação `refresh`: chama `https://accounts.spotify.com/api/token` (grant `refresh_token`, Basic com id/secret); devolve `access_token` e `expires_in`; faz **upsert** do refresh token se o Spotify rotacionar.
- [ ] **Fallback (token ausente):** o Supabase só devolve `provider_refresh_token` no exchange inicial e o texto pode vir `null`. Se vier `null` no `store`: (a) se já existe credencial salva, ignorar e seguir com o `refresh`; (b) se não existe nenhuma, forçar novo consentimento — `signOut()` + `signInWithOAuth` com `queryParams: { show_dialog: 'true' }`. Nunca falhar em silêncio.
- [ ] Tratar erros (`400/401` → sessão/credencial inválida; nunca vazar o secret nas mensagens).

**1.4 Frontend**

- [ ] `src/views/Login.vue` → `supabase.auth.signInWithOAuth({ provider: 'spotify', options: { scopes } })` (mesmos escopos atuais).
- [ ] `src/views/Callback.vue` → obter a sessão, capturar `provider_refresh_token` e chamar `invoke('spotify-token', { action: 'store' })`; corrigir a navegação dupla atual.
- [ ] Token manager novo: cacheia o access token do Spotify (memória/localStorage) e renova via `spotify-token` quando expirado.
- [ ] `src/axios-plugin.js` → interceptor 401/já-expirado passa a usar o token manager (remove `Basic btoa(id:secret)`).
- [ ] `src/router/index.js` → guard checa sessão Supabase (`supabase.auth.getSession()`); corrige o bug do `next()` duplo.
- [ ] `src/support/helpers.js` → `logout()` = `supabase.auth.signOut()`; revisar chaves de localStorage do Spotify.
- [ ] Remover `src/composables/requestToken.js` (obsoleto).

**Aceite da Etapa 1**
- Login via Spotify entra no app; navegação protegida funciona; **nenhum segredo no bundle** (checar `dist/`).
- Chamadas à Web API do Spotify funcionam e continuam funcionando **após ~1h** (renovação server-side).
- `anon` **não** lê `earnings_ledger`/`requesters` (testar com a chave anon).
- `authenticated` dono lê/escreve normalmente.
- Advisors de segurança do Supabase sem achados; `spotify_credentials` inacessível pelo client.

---

### Etapa 2 — Limpeza de código

- [ ] Remover código morto: `spotifyApi.getRecommendations`, `PlaylistDetailsService.getAudience`, `FinanceService.sumLedger`/`sumLedgerByType`, `PushService.listSubscriptions`/`getSubscription`, `TrackRequestService.getPricePositionsWithMetadata`.
- [ ] Remover os logs de debug (**142 ocorrências** em 27 arquivos); **manter `console.error`** em blocos catch.
- [ ] Guard do router corrigido (sai na Etapa 1, se aplicável).

**Aceite:** `grep -rn "console.log\|console.warn\|console.info\|console.debug" src` = 0; build verde; nenhum export órfão.

---

### Etapa 3 — Envs e artefatos

- [ ] Remover do `.env`/`.env.example`: `VITE_NOTION_API_KEY`, `VITE_NOTION_DATABASE_ID`, `VITE_SUPABASE_DATABASE_PASS`, `VITE_APP_TITLE`, `NODE_ENV`.
- [ ] Após a Etapa 1: remover `VITE_SPOTIFY_CLIENT_SECRET`, `VITE_SPOTIFY_CLIENT_ID` (deixa de ser usado — o Supabase monta a URL de autorização) e `VITE_VAPID_PRIVATE_KEY` do frontend.
- [ ] Alinhar `VITE_APP_URL` entre `.env` e `.env.example`.
- [ ] `git rm --cached` de: `dev-dist/*` (6 arquivos), `mrp_logo.svg_Zone.Identifier`, `src/assets/logo_semfundo.png:Zone.Identifier`.
- [ ] Apagar `db.json`; reforçar `.gitignore` (`*.Zone.Identifier`, `.kilo/`, `db.json`).

**Aceite:** `git status` limpo; `.env.example` reflete exatamente as variáveis usadas no frontend; build não depende de segredo.

---

### Etapa 4 — Linter + CI + testes

- [ ] ESLint (flat config) + `eslint-plugin-vue`; scripts `lint` e `lint:fix`.
  - Base mínima: `@eslint/js` recommended + `plugin:vue/vue3-essential`.
  - Blocos separados por ambiente: `src/**` (browser), `scripts/**` (Node), `supabase/functions/**` (Deno); ignorar `dist`, `dev-dist`, `node_modules`.
  - `no-console: ['warn', { allow: ['error'] }]`.
- [ ] Workflow `.github/workflows/ci.yml`: em push/PR → instalar → `lint` → `build` → **passo que falha se `VITE_SPOTIFY_CLIENT_SECRET` voltar a aparecer em `src/`** (checagem estática anti-regressão).
- [ ] **Vitest** + primeiros testes unitários das heurísticas puras:
  - `support/playlistCompatibility.js` (score por gênero).
  - TTL/consistência de `support/occupancyCache.js`.
  - `support/helpers.hexToRgba`.
  - *(Os "sums" do `FinanceService` saem deste escopo — eles são removidos como código morto na Etapa 2; a agregação de receita volta na Fase 2.)*

**Aceite:** `yarn lint` e `yarn build` verdes; CI dispara em PR; suíte de testes passando.

---

### Etapa 5 — Métricas

**5.1 Baselines por SQL** (definições operacionais em §Anexo A; documentar em `docs/baselines-fase-0.md`).

**5.2 Tabela `product_events`**

- [ ] `product_events(id, user_id, session_id, event, props jsonb, created_at)` com RLS de dono (insert por `authenticated`); retenção definida (ex.: 180 dias).

**5.3 Helper e instrumentação**

- [ ] Helper `track(event, props)`; `session_id` = uuid por carregamento de página (guardado em `sessionStorage`), anexado a todo evento.
- [ ] Eventos mínimos: `playlist_load`, `error`, `renewal_started`, `renewal_completed` (ver Anexo A).

**Aceite:** baselines calculados e registrados; eventos gravando com `session_id`.

---

### Etapa 6 — Atualizar o PRD

- [ ] Seção 6: registrar a mudança de auth (Supabase Auth + provider Spotify) e o fim da decisão "sem auth própria".
- [ ] Corrigir itens já resolvidos/desatualizados: `vite.config.js` já usa `base`, manifest já corrigido, "sem RLS" → RLS existia mas era ineficaz.
- [ ] Ajustar magnitudes (ex.: ~30 → 142 logs) e o status dos riscos de §4.5.

---

## 6. Ordem e dependências

```
Etapa 1 (auth + RLS)
   ├──► Etapa 2 (limpeza de código)   ─┐
   └──► Etapa 3 (envs/artefatos)      ─┴──► Etapa 4 (lint/CI/testes) ──► Etapa 5 (métricas) ──► Etapa 6 (PRD)
```

- A Etapa 3 só pode remover o `VITE_SPOTIFY_CLIENT_SECRET` **depois** da Etapa 1.
- Etapas 2 e 3 são independentes entre si e podem correr em paralelo.
- Dentro da Etapa 1, respeitar a ordem da §1.2 (dono marcado antes das políticas restritivas).

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Rotação do refresh token do Spotify | Upsert na Edge Function (sempre grava o refresh mais recente). |
| Lockout por RLS mal aplicado | Backup das políticas antes; marcar o dono **antes** de restringir; verificar logo após. |
| Aplicar RLS direto em produção (única cópia dos dados) | Backup das políticas + verificação como `anon` e dono logo após aplicar. |
| Envs do Vercel desatualizadas | Revisar/atualizar após a Etapa 3 (remover o secret; manter URL/key do Supabase). |
| Necessidade de relogar (único usuário) | Esperado: 1 login por dispositivo após a migração. |
| App Spotify em modo dev | Login restrito a e-mails autorizados no Spotify Dashboard (reforça o gate de dono). |
| Regressão do fluxo de auth | Validar o aceite da Etapa 1 em localhost **e** em produção antes de seguir. |

## 8. Definition of Done

- [ ] Sem segredos no bundle (`dist/`).
- [ ] `anon` não acessa dados de negócio; dono acessa.
- [ ] Renovação do token do Spotify funciona server-side.
- [ ] `console.log` de debug = 0; código morto removido.
- [ ] `.env.example` limpo; artefatos fora do git.
- [ ] `lint`, `build` e testes verdes; CI ativo.
- [ ] Baselines dos KPIs calculados; `product_events` gravando.
- [ ] PRD atualizado.

## 9. Itens adiados (registrados, fora da Fase 0)

- Foreign keys sem índice (4) — advisor de performance; impacto baixo, revisar na Fase 2.
- Migração dos nomes enganosos de env (`VITE_SUPABASE_PLAYLISTS_TABLE` aponta para `playlists_statistics`) — padronizar quando conveniente.
- Agregação de receita (ex-`sumLedger`) — reintroduzida junto com os relatórios da Fase 2.
- Cobertura de testes além das heurísticas (componentes/views).

---

## 10. Respostas da checagem do builder (v1.0 → v1.1)

| Ponto levantado | Resolução |
|---|---|
| Janela/snapshot de cada KPI | Definido no Anexo A. |
| Operacionalização da telemetria (sessão, alerta→conclusão) | Definido no Anexo A (`session_id`, eventos `renewal_*`). |
| O que é "lint verde" / escopo | Regra mínima (`recommended` + `vue3-essential`), blocos por ambiente (§Etapa 4). |
| `provider_refresh_token` ausente | Fallback explícito (§1.3). |
| Contradição: `sumLedger` é morto × testado | Corrigido: sai do escopo de testes (§Etapa 4) e permanece como remoção (Etapa 2). |
| Bootstrap do dono / lockout | Ordem de aplicação na §1.2 (dono antes das políticas); dono único estrito. |
| RLS em produção vs. branch | Aplicar via MCP (convenção do projeto) com backup de políticas + verificação. |
| CI deveria checar "sem segredos em `dist/`" | Adicionado passo estático no workflow (Etapa 4). |
| `VITE_SPOTIFY_CLIENT_ID` ainda é usado no frontend? | Não — removido na Etapa 3. |

## Anexo A — Definições operacionais

### KPIs deriváveis por SQL

| KPI | Fórmula | Janela/snapshot |
|---|---|---|
| Receita controlada % | `count(track_requests where status='paid' and existe earnings_ledger com track_request_id = id)` ÷ `count(track_requests where status='paid')` | Snapshot atual |
| Ocupação % | média, por playlist gerenciada, de `posições ocupadas ÷ playlists.items` | Snapshot atual |
| Retenção de anunciantes % | `count(requester_name com ≥ 2 lançamentos)` ÷ `count(distinct requester_name)`, no `earnings_ledger` | Últimos 90 dias |
| Expirações perdidas | `count(track_requests where due_date < now() - interval '7 days' and status='pending')` | Snapshot atual |

### Telemetria (`product_events`)

| Evento | Propriedades | Quando dispara |
|---|---|---|
| `playlist_load` | `{ playlist_id, tracks, ms }` | ao terminar a montagem da página de playlist |
| `error` | `{ scope, message }` | em captura global de erro (`App.vue` / interceptor) |
| `renewal_started` | `{ track_request_id, playlist_id }` | ao abrir a ação de renovação a partir do alerta |
| `renewal_completed` | `{ track_request_id, type }` | ao marcar o slot como pago |

- `session_id`: uuid por carregamento de página (em `sessionStorage`), anexado a todo evento.
- Métricas derivadas: tempo de renovação (mediana `renewal_completed − renewal_started`); erros por sessão (`count(error) ÷ distinct session_id`); tempo de entrada em playlist (percentil de `playlist_load.ms` com `tracks ≥ 500`).
