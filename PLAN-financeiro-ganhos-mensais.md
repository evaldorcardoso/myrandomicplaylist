# Plano — Estatística "Ganhos Mensais" via `earnings_ledger` + Tela Financeiro

## Contexto / Diagnóstico

- `track_requests` **não** tem deleção automática por `due_date`; a expiração é calculada em runtime (`DashboardService.js:225`).
- Porém os dados de pagamento se perdem quando: slot removido (`Dashboard.vue:112`, `Playlist.vue:582`, `SlotManagementModal.vue:341`) e playlist removida (`PlaylistService.js:135-165`) → `DELETE` hard.
- `loadEarnings` soma por `created_at` de `status='paid'`, então renovações (que só bumpam `due_date`/status, sem novo row) e vendas antigas **não entram** no mês atual.
- **Decisão confirmada:** pagamento = transição para `status='paid'`. A renovação em `SlotManagementModal.vue:316` volta para `pending`; o registro financeiro entra quando o modal marca `paid` novamente.

**Solução:** tabela imutável `earnings_ledger` com 1 row por evento de pagamento (venda/renovação) + nova tela "Financeiro" com filtros e somatório.

---

## Tarefas

### T1 — Schema `earnings_ledger` no Supabase (via MCP `apply_migration`)

DDL (campos de exibição denormalizados porque `track_requests` pode ser deletada depois — joins para display falhariam):

```sql
create table if not exists public.earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  track_request_id bigint,
  playlist_id varchar,
  playlist_name varchar,
  track_id varchar,
  track_name varchar,
  requester_name varchar,
  curator varchar,
  amount double precision,
  type text not null default 'new'
    constraint earnings_ledger_type_check check (type in ('new', 'renewal')),
  created_at timestamptz not null default now()
);

create index if not exists earnings_ledger_created_at_idx
  on public.earnings_ledger (created_at desc);
```

### T2 — RLS no Supabase (via MCP `apply_migration`)

Append-only (sem UPDATE/DELETE):

```sql
alter table public.earnings_ledger enable row level security;

create policy "earnings_ledger_select_all" on public.earnings_ledger
  for select to public using (true);

create policy "earnings_ledger_insert_all" on public.earnings_ledger
  for insert to public with check (true);
```

### T3 — Backfill do histórico atual (via MCP `execute_sql` / `apply_migration`)

Idempotente; popula nome/requester via join:

```sql
insert into public.earnings_ledger
  (track_request_id, playlist_id, playlist_name, track_id, track_name,
   requester_name, curator, amount, type, created_at)
select tr.id,
       tr.playlist_id,
       pl.name,
       tr.track_id,
       tr.name,
       rq.name,
       rq.curator,
       tr.value,
       'new',
       tr.created_at
from public.track_requests tr
left join public.playlists pl  on pl.id = tr.playlist_id
left join public.requesters rq on rq.id = tr.requester_id
where tr.status = 'paid' and tr.value is not null
  and not exists (
    select 1 from public.earnings_ledger el
    where el.track_request_id = tr.id
  );
```

### T4 — Funções no `TrackRequestService.js`

Adicionar exportações:
- `recordEarning({ track_request_id, playlist_id, playlist_name, track_id, track_name, requester_name, curator, amount, type })`
  → `supabase.from('earnings_ledger').insert(...)`
- `hasEarnings(track_request_id)` → `select('id').eq('track_request_id', id).maybeSingle()` → bool (para classificar new/renewal)

### T5 — Gravação do ledger nos eventos de pagamento

| Arquivo | Local | Ação |
|---|---|---|
| `SellSlotModal.vue` | após `Promise.all` (~:269) | se `paid.value`, `recordEarning({ type: 'new', ... })` usando `trackResult.data?.[0]?.id` e campos do payload/requester |
| `SlotManagementModal.vue` | ramo `isPending` (~:311) | `recordEarning({ ..., type: (await hasEarnings(id)) ? 'renewal' : 'new' })` |
| `Playlist.vue` | `handleOrphanEditSave` (~:810) | só se `formData.status === 'paid'` **e** status anterior ≠ paid; mesma classificação via `hasEarnings` |

Verificar os dados disponíveis (nome da música/playlist/requester/curator) em cada ponto e passar os campos denormalizados.

### T6 — Reescrever `loadEarnings` em `DashboardService.js` (~:181)

- Trocar fonte para `earnings_ledger`:
  ```js
  supabase.from('earnings_ledger').select('amount, created_at').gte('created_at', prevStart.toISOString())
  ```
- Somar `amount` por janela de mês (lógica `currentStart/nextStart` e delta % mantidas, agora sem filtro de status).
- Cache em `occupancyCache.js` e formatação `formatCurrency` permanecem.

### T7 — Serviço `FinanceService.js` (novo)

Em `src/services/FinanceService.js`:
- `loadEarningsLedger({ start, end })`
  → `supabase.from('earnings_ledger').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false })`
- Cálculo do total do filtro feito na view (ou no serviço).

### T8 — Rota no `src/router/index.js`

```js
import Financeiro from "@/views/Financeiro.vue"
```
Registrar em `children` do Layout:
```js
{ path: "/financeiro", name: "Financeiro", component: Financeiro }
```

### T9 — Menu no `src/components/Sidebar.vue`

Adicionar em `navItems` após Dashboard:
```js
{ label: 'Financeiro', icon: 'payments', to: '/financeiro' }
```

### T10 — View `src/views/Financeiro.vue` (nova)

- **Card no topo**: somatório do filtro atual em `formatCurrency` (`R$`), estilo do card "Ganhos Mensais" do Dashboard.
- **Filtros**:
  - `input type="month"` → filtra por mês (ex.: `2026-08`).
  - Toggle entre "Mês" e "Personalizado"; modo personalizado com dois `input type="date"` (início/fim).
  - Default = mês atual.
- **Lista/Tabela** dos registros filtrados (ordem `created_at` desc): data (`toLocaleDateString('pt-BR')`), música (`track_name`), playlist (`playlist_name`), cliente (`requester_name` + curator), tipo (`Novo`/`Renovação`), valor.
- Loading state + estado vazio (padrão do app).

### T11 — Validação

- `yarn build` (sem linter/testes configurados no repo — validação manual).
- Conferir: card "Ganhos Mensais" do Dashboard refletindo o ledger; tela Financeiro com filtro mensal/personalizado e somatório.

---

## Observações

- Nenhuma mudança em ocupação/expirações/`playlistStore`.
- Seguir regras de performance do `AGENTS.md`: dados do ledger podem ser `markRaw`/dados crus, sem mutação de objetos reativos em loops.
- Não criar arquivos sob `supabase/migrations/` — DDL executado via MCP.
- Ícones Material Symbols usados: `payments`, `account_balance_wallet` (adicionar no template conforme necessário).

## Ordem de execução sugerida

1. T1 → T2 → T3 (Supabase MCP)
2. T4 → T5 (gravação do ledger)
3. T6 (`loadEarnings`)
4. T7 → T8 → T9 → T10 (Financeiro)
5. T11 (validação)
