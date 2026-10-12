-- Rollback da Fase 0.7 (issue #63) — `product_events` + retenção.
-- Snapshot: 2026-10-12 · aplicado via MCP (migrations phase0_7_product_events e
-- phase0_7_product_events_retention).
--
-- Este arquivo NÃO é migration (o repo aplica DDL direto via MCP — ver AGENTS.md).
-- Serve como plano de rollback caso a telemetria precise ser desfeita.
--
-- Observação: `product_events` é uma tabela nova (não havia dados antes da #63).
-- O rollback abaixo descarta a tabela e o job de retenção. A extensão `pg_cron`
-- fica instalada de propósito — removê-la afetaria outros jobs futuros do projeto.

-- 1. Remove o job de retenção (180 dias).
select cron.unschedule('purge_product_events');

-- 2. Remove a tabela de telemetria (e a policy/índices junto).
drop table if exists public.product_events;
