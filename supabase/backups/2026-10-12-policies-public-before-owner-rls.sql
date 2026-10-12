-- Backup das políticas RLS de `public` antes do lockdown do anon — Fase 0.3 (issue #59).
-- Snapshot: 2026-10-12 · fonte: `select * from pg_policies where schemaname = 'public'`.
--
-- Este arquivo NÃO é migration (o repo aplica DDL direto via MCP — ver AGENTS.md).
-- Serve apenas como plano de rollback caso o lockdown quebre o acesso do dono.
--
-- Migrations aplicadas pela #59:
--   phase0_3_owner_rls_lockdown         (policies de dono + revoke de grants)
--   phase0_3_revoke_default_privileges  (impede TRUNCATE/TRIGGER/REFERENCES em tabelas futuras)
--
-- COMO REVERTER (emergência: o dono perdeu acesso e é preciso voltar atrás):
--   1. Executar o bloco de rollback abaixo (as policies permissivas voltam) via MCP.
--   2. Se — e somente se — alguma tabela de negócio perdeu DML usado pelo app,
--      reconceder APENAS DML. NUNCA reconceder TRUNCATE/TRIGGER/REFERENCES:
--      TRUNCATE ignora RLS e reabriria o buraco que a #59 fechou.
--        grant select, insert, update, delete on table public.<tabela> to authenticated;
--   3. NÃO reconceder acesso de cliente a `spotify_credentials` (decisão D3 / issue #57):
--      ela é exclusiva da Edge Function (service_role, que ignora RLS).
--   4. Investigar a falha antes de reaplicar o lockdown.


-- ===========================================================================
-- 1. Remove as policies criadas pela #59
-- ===========================================================================

drop policy if exists owner_full_access on public.playlists;
drop policy if exists owner_full_access on public.track_popularity;
drop policy if exists owner_full_access on public.playlists_statistics;
drop policy if exists owner_full_access on public.track_requests;
drop policy if exists owner_full_access on public.requesters;
drop policy if exists owner_full_access on public.price_positions;
drop policy if exists owner_full_access on public.earnings_ledger;
drop policy if exists owner_full_access on public.push_subscriptions;
drop policy if exists service_role_full_access on public.spotify_credentials;


-- ===========================================================================
-- 2. Recria as 22 policies que existiam antes do lockdown
-- ===========================================================================

-- earnings_ledger
create policy "earnings_ledger_insert_all" on public.earnings_ledger as PERMISSIVE for INSERT to public with check (true);
create policy "earnings_ledger_select_all" on public.earnings_ledger as PERMISSIVE for SELECT to public using (true);

-- playlists
create policy "Enable delete for all" on public.playlists as PERMISSIVE for DELETE to public using (true);
create policy "Enable insert for all" on public.playlists as PERMISSIVE for INSERT to public with check (true);
create policy "Enable read access for all users" on public.playlists as PERMISSIVE for SELECT to public using (true);
create policy "Enable update for all" on public.playlists as PERMISSIVE for UPDATE to public using (true);

-- playlists_statistics
create policy "Enable delete access for all users" on public.playlists_statistics as PERMISSIVE for DELETE to public using (true);
create policy "Enable insert for authenticated users only" on public.playlists_statistics as PERMISSIVE for INSERT to public with check (true);
create policy "Enable read access for all users" on public.playlists_statistics as PERMISSIVE for SELECT to public using (true);
create policy "Enable update access for all users" on public.playlists_statistics as PERMISSIVE for UPDATE to public using (true);

-- price_positions
create policy "Enable delete for all users" on public.price_positions as PERMISSIVE for DELETE to public using (true);
create policy "Enable insert for authenticated users only" on public.price_positions as PERMISSIVE for INSERT to public with check (true);
create policy "Enable read access for all users" on public.price_positions as PERMISSIVE for SELECT to public using (true);
create policy "Enable update access for all users" on public.price_positions as PERMISSIVE for UPDATE to public using (true);

-- push_subscriptions
create policy "delete own" on public.push_subscriptions as PERMISSIVE for DELETE to anon using (true);
create policy "insert own" on public.push_subscriptions as PERMISSIVE for INSERT to anon with check (true);

-- requesters
create policy "Policy with security definer functions" on public.requesters as PERMISSIVE for ALL to public using (true);

-- track_popularity
create policy "Enable delete access for all users" on public.track_popularity as PERMISSIVE for DELETE to public using (true);
create policy "Enable insert for authenticated users only" on public.track_popularity as PERMISSIVE for INSERT to public with check (true);
create policy "Enable read access for all users" on public.track_popularity as PERMISSIVE for SELECT to public using (true);
create policy "Enable update access for all users" on public.track_popularity as PERMISSIVE for UPDATE to public using (true);

-- track_requests
create policy "Policy with security definer functions" on public.track_requests as PERMISSIVE for ALL to public using (true);


-- ===========================================================================
-- Anexo — snapshot bruto do pg_policies (estado pré-lockdown, para conferência)
-- ===========================================================================
-- earnings_ledger      | earnings_ledger_insert_all                  | public | INSERT | CHECK (true)
-- earnings_ledger      | earnings_ledger_select_all                  | public | SELECT | USING (true)
-- playlists            | Enable delete for all                       | public | DELETE | USING (true)
-- playlists            | Enable insert for all                       | public | INSERT | CHECK (true)
-- playlists            | Enable read access for all users            | public | SELECT | USING (true)
-- playlists            | Enable update for all                       | public | UPDATE | USING (true)
-- playlists_statistics | Enable delete access for all users          | public | DELETE | USING (true)
-- playlists_statistics | Enable insert for authenticated users only  | public | INSERT | CHECK (true)
-- playlists_statistics | Enable read access for all users            | public | SELECT | USING (true)
-- playlists_statistics | Enable update access for all users          | public | UPDATE | USING (true)
-- price_positions      | Enable delete for all users                 | public | DELETE | USING (true)
-- price_positions      | Enable insert for authenticated users only  | public | INSERT | CHECK (true)
-- price_positions      | Enable read access for all users            | public | SELECT | USING (true)
-- price_positions      | Enable update access for all users          | public | UPDATE | USING (true)
-- push_subscriptions   | delete own                                  | anon   | DELETE | USING (true)
-- push_subscriptions   | insert own                                  | anon   | INSERT | CHECK (true)
-- requesters           | Policy with security definer functions      | public | ALL    | USING (true)
-- track_popularity     | Enable delete access for all users          | public | DELETE | USING (true)
-- track_popularity     | Enable insert for authenticated users only  | public | INSERT | CHECK (true)
-- track_popularity     | Enable read access for all users            | public | SELECT | USING (true)
-- track_popularity     | Enable update access for all users          | public | UPDATE | USING (true)
-- track_requests       | Policy with security definer functions      | public | ALL    | USING (true)


-- ===========================================================================
-- Anexo — snapshot de grants (estado pré-lockdown, para conferência)
-- ===========================================================================
-- As 9 tabelas de `public` tinham, para anon E authenticated:
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE   (arwdDxt)
-- A #59 revogou REFERENCES/TRIGGER/TRUNCATE (tabelas) e manteve o DML nas 8
-- tabelas de negócio, filtrado pelo RLS. TRUNCATE/TRIGGER/REFERENCES NÃO devem
-- ser reconcedidos (TRUNCATE ignora RLS).
--
-- `spotify_credentials`: sem grants explícitos antes; o acesso de anon/authenticated
-- vinha do default ACL do schema (mesmo arwdDxt). A #59 revogou tudo dos dois.
--
-- Default privileges (schema public, objtype = r):
--   grantor postgres         -> anon/authenticated ficam só com DELETE/INSERT/SELECT/UPDATE
--   grantor supabase_admin   -> segue com arwdDxt; o role postgres não é membro de
--                               supabase_admin, então não foi possível ajustar aqui.
--                               Revisar caso surjam novas tabelas criadas por ele.
