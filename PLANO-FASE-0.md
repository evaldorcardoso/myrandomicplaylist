# Plano — Fase 0: Fundação & Segurança (complemento às issues)

**Versão do documento:** 1.2
**Última atualização:** 11/10/2026
**Referência:** [`docs/PRD.md`](docs/PRD.md) — Fase 0 do roadmap (§5.1) e riscos (§4.5)
**Owner:** Curador proprietário (uso pessoal)

> **v1.2:** o detalhamento executável (etapas, checklists e critérios de aceite) foi migrado para as issues **#57–#64** no GitHub, com as dependências registradas como *edges* nativos de bloqueio. Este documento guarda apenas o **contexto que complementa a implementação**: decisões travadas, arquitetura-alvo, riscos, itens adiados e as definições operacionais. O recorte etapista da v1.1 continua recuperável no git (`git show dea15f3:PLANO-FASE-0.md`).

---

## 1. Mapa de tickets

| Etapa (v1.1) | Issue | Bloqueado por |
|---|---|---|
| 1.1–1.4 · Auth Supabase (fundação server-side) | [#57](https://github.com/evaldorcardoso/myrandomicplaylist/issues/57) | — |
| 1.1 + 1.4 · Cutover do frontend | [#58](https://github.com/evaldorcardoso/myrandomicplaylist/issues/58) | #57 |
| 1.2 · RLS de dono | [#59](https://github.com/evaldorcardoso/myrandomicplaylist/issues/59) | #58 |
| 2 · Limpeza de código | [#60](https://github.com/evaldorcardoso/myrandomicplaylist/issues/60) | #58 |
| 3 · Envs e artefatos | [#61](https://github.com/evaldorcardoso/myrandomicplaylist/issues/61) | #58 |
| 4 · Linter + CI + testes | [#62](https://github.com/evaldorcardoso/myrandomicplaylist/issues/62) | #60, #61 |
| 5 · Métricas | [#63](https://github.com/evaldorcardoso/myrandomicplaylist/issues/63) | #59, #60 |
| 6 · Atualizar o PRD | [#64](https://github.com/evaldorcardoso/myrandomicplaylist/issues/64) | #58–#63 |

A fronteira é a única issue sem bloqueador aberto — hoje a #57.

---

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

### Ordem de aplicação do RLS (evita lockout)

O dono é marcado (**#58**) **antes** de as políticas restritivas entrarem em vigor (**#59**). Todo o banco é aplicado via MCP, sem arquivos de migration (`AGENTS.md`); as políticas atuais são exportadas (`pg_policies`) antes de qualquer troca, para rollback.

---

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Rotação do refresh token do Spotify | Upsert na Edge Function (sempre grava o refresh mais recente). |
| Lockout por RLS mal aplicado | Backup das políticas antes; marcar o dono **antes** de restringir; verificar logo após. |
| Aplicar RLS direto em produção (única cópia dos dados) | Backup das políticas + verificação como `anon` e dono logo após aplicar. |
| Envs do Vercel desatualizadas | Revisar/atualizar após a Etapa 3 (remover o secret; manter URL/key do Supabase). |
| Necessidade de relogar (único usuário) | Esperado: 1 login por dispositivo após a migração. |
| App Spotify em modo dev | Login restrito a e-mails autorizados no Spotify Dashboard (reforça o gate de dono). |
| Regressão do fluxo de auth | Validar o aceite da Etapa 1 em localhost **e** em produção antes de seguir. |

## 6. Critério de saída da Fase 0

- [ ] Sem segredos no bundle (`dist/`).
- [ ] `anon` não acessa dados de negócio; dono acessa.
- [ ] Renovação do token do Spotify funciona server-side.
- [ ] `console.log` de debug = 0; código morto removido.
- [ ] `.env.example` limpo; artefatos fora do git.
- [ ] `lint`, `build` e testes verdes; CI ativo.
- [ ] Baselines dos KPIs calculados; `product_events` gravando.
- [ ] PRD atualizado.

## 7. Itens adiados (registrados, fora da Fase 0)

- Foreign keys sem índice (4) — advisor de performance; impacto baixo, revisar na Fase 2.
- Migração dos nomes enganosos de env (`VITE_SUPABASE_PLAYLISTS_TABLE` aponta para `playlists_statistics`) — padronizar quando conveniente.
- Agregação de receita (ex-`sumLedger`) — reintroduzida junto com os relatórios da Fase 2.
- Cobertura de testes além das heurísticas (componentes/views).

> Estes itens são absorvidos pelo PRD na issue **#64**.

---

## Anexo A — Telemetria (`product_events`)

| Evento | Propriedades | Quando dispara |
|---|---|---|
| `playlist_load` | `{ playlist_id, tracks, ms }` | ao terminar a montagem da página de playlist |
| `error` | `{ scope, message }` | em captura global de erro (`App.vue` / interceptor) |
| `renewal_started` | `{ track_request_id, playlist_id }` | ao abrir a ação de renovação a partir do alerta |
| `renewal_completed` | `{ track_request_id, type }` | ao marcar o slot como pago |

- `session_id`: uuid por carregamento de página (em `sessionStorage`), anexado a todo evento.
- Métricas derivadas: tempo de renovação (mediana `renewal_completed − renewal_started`); erros por sessão (`count(error) ÷ distinct session_id`); tempo de entrada em playlist (percentil de `playlist_load.ms` com `tracks ≥ 500`).

> As fórmulas dos KPIs deriváveis por SQL (receita controlada %, ocupação %, retenção de anunciantes %, expirações perdidas) estão na issue **#63**, que é a fonte para o `docs/baselines-fase-0.md`.
