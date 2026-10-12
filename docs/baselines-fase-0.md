# Baselines — Fase 0 (KPIs)

**Snapshot:** 12/10/2026
**Fonte:** banco de produção do projeto Supabase, via SQL (`execute_sql`).
**Issue:** [#63](https://github.com/evaldorcardoso/myrandomicplaylist/issues/63) — complementa o [`docs/PRD.md`](PRD.md) (§6.1, D6 e §4.7).
**Owner:** Curador proprietário (uso pessoal, dono único).

> Este arquivo registra o **baseline** da Fase 0: os valores de partida dos 4 KPIs
> deriváveis por SQL e as consultas canônicas para recalculá-los. Os 3 KPIs que
> dependem de telemetria de produto (tempo de renovação, erros por sessão e tempo
> de entrada em playlist) derivam de `product_events` e estão definidos no
> **Anexo A** do plano, não aqui.

## Resumo

| # | KPI | Valor (12/10/2026) | Definição resumida |
|---|---|---|---|
| 1 | Receita controlada | **100,00 %** (33/33) | `track_requests` pagos com lançamento no `earnings_ledger` ÷ pagos |
| 2 | Ocupação | **1,89 %** | média, por playlist gerenciada, de posições ocupadas ÷ `playlists.items` |
| 3 | Retenção de anunciantes | **23,68 %** (18/76) | anunciantes com ≥ 2 lançamentos ÷ anunciantes distintos (90 dias) |
| 4 | Expirações perdidas | **0** | `track_requests` pendentes vencidos há mais de 7 dias |

---

## 1. Receita controlada %

**O que mede:** fração dos slots pagos que têm o lançamento financeiro correspondente
registrado no `earnings_ledger`. Mede o quanto da receita já confirmada está de fato
contabilizada (quanto menor, mais dinheiro recebido sem lançamento).

```sql
select
  count(*) filter (where exists (
    select 1 from earnings_ledger e where e.track_request_id = tr.id
  )) as pagos_com_lancamento,
  count(*) as pagos,
  round(100.0 * count(*) filter (where exists (
    select 1 from earnings_ledger e where e.track_request_id = tr.id
  )) / nullif(count(*), 0), 2) as receita_controlada_pct
from track_requests tr
where tr.status = 'paid';
```

**Baseline:** 33 pagos, 33 com lançamento → **100,00 %**.
Toda receita confirmada está lançada; não há pendência de contabilização neste snapshot.

---

## 2. Ocupação %

**O que mede:** quanto da grade gerenciada está vendida. É a média das razões
`posições ocupadas ÷ playlists.items` de cada playlist gerenciada (todas as linhas de
`playlists`), tratando cada playlist com o mesmo peso.

**Definições operacionais:**
- *Playlist gerenciada* = linha em `public.playlists` (as playlists que o curador controla).
- *Posição ocupada* = posição (`track_requests.position`) com um `track_request` ativo
  (`status in ('pending','paid')`). No snapshot atual todos os requests estão `paid`, então
  todas as definições coincidem.

```sql
with por_playlist as (
  select
    p.id,
    case when p.items > 0
         then count(distinct tr.position)::numeric / p.items
         else 0 end as razao
  from playlists p
  left join track_requests tr
    on tr.playlist_id = p.id
   and tr.status in ('pending', 'paid')
  group by p.id, p.items
)
select
  count(*)                                    as playlists_gerenciadas,
  sum(round(razao, 4))                        as soma_das_razoes,
  round(avg(razao) * 100, 2)                  as ocupacao_pct
from por_playlist;
```

**Baseline:** 21 playlists gerenciadas, 33 posições ocupadas em 1.751 posições totais
(`playlists.items`), média por playlist → **1,89 %**.
Concentração: as 33 posições estão em uma única playlist (Eletrônica remix 2026 — 33/83 ≈ 39,8 %);
as outras 20 estão com ocupação 0 neste snapshot. Média aritmética por playlist ≈ 39,8 % ÷ 21.
Agregado (Σ ocupadas ÷ Σ items) ≈ 1,88 % — praticamente igual por haver só uma playlist ocupada.

---

## 3. Retenção de anunciantes %

**O que mede:** fração dos anunciantes que compraram mais de uma vez nos últimos 90 dias
(recompra). Anunciante é identificado por `requester_name` no `earnings_ledger`.

```sql
with por_anunciante as (
  select requester_name, count(*) as lancamentos
  from earnings_ledger
  where created_at >= now() - interval '90 days'
    and requester_name is not null
  group by requester_name
)
select
  count(*) filter (where lancamentos >= 2) as recorrentes,
  count(*)                                 as anunciantes_distintos,
  round(100.0 * count(*) filter (where lancamentos >= 2)
        / nullif(count(*), 0), 2)          as retencao_pct
from por_anunciante;
```

**Baseline:** 18 recorrentes de 76 anunciantes distintos → **23,68 %**.
Janela de 90 dias (12/07/2026 a 12/10/2026); o ledger cobre 01/08/2026 a 09/10/2026.

---

## 4. Expirações perdidas

**O que mede:** slots que venceram há mais de 7 dias e continuam `pending` — sinal de
renovação/cobrança não resolvida, ou seja, receita em risco.

```sql
select count(*) as expiracoes_perdidas
from track_requests
where status = 'pending'
  and due_date < now() - interval '7 days';
```

**Baseline:** **0**.
Nenhum slot vencido e não pago há mais de 7 dias neste snapshot (todos os 33 requests
estão `paid`).

---

## Como reproduzir

1. Rodar as consultas acima no banco de produção (SQL editor / `execute_sql`).
2. Registrar o snapshot no formato desta página (valores + data), preservando o histórico
   como commits em `docs/baselines-fase-0.md`.

## Observações / limites

- Os KPIs 1, 2 e 4 são *snapshots*: mudam a cada venda/renovação. A série histórica só
  existe nos commits deste arquivo.
- O KPI 2 usa as posições **registradas** no banco; a validação contra a grade real do
  Spotify (como faz a tela de playlist) exige chamada à API e não é reproduzível só por SQL.
- O KPI 3 depende de `requester_name` preenchido no `earnings_ledger`; registros sem nome
  são ignorados.
