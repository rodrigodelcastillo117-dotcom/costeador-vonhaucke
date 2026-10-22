-- ============================================================================
-- PROPUESTA_final100_hardening_revoke_anon_drop_probe.sql
-- Proyecto Supabase: mtuvnbgljwbsaizjjgzs  (Costeador Von Haucke)
-- Auditoría independiente ChatGPT sobre 3e592d5 · hallazgos H1 y H2.
--
-- H1 · El RPC public.revalidar_vigencia_precio heredaba EXECUTE de PUBLIC.
--   ACL observada: {=X/postgres, postgres=X/postgres, service_role=X/postgres}
--   El `=X/postgres` es el grant a PUBLIC, del que anon y authenticated heredan EXECUTE.
--   Un `revoke ... from anon` previo NO bastó porque PUBLIC seguía concediéndolo.
--   Fix de raíz: revocar de PUBLIC y de anon; conceder EXPLÍCITAMENTE a authenticated
--   y service_role (los únicos que deben invocarlo). El control de Dirección sigue
--   DENTRO del RPC (puede_certificar_costo()); esta migración NO cambia la regla de negocio.
--
-- H2 · public._f100_probe() era una función-probe temporal de FINAL-100 (cuerpo: `select 1`,
--   0 dependencias de negocio verificadas con pg_depend). No pertenece al producto: se elimina.
-- ============================================================================

-- H1 ------------------------------------------------------------------------
revoke execute on function public.revalidar_vigencia_precio(bigint, text) from public;
revoke execute on function public.revalidar_vigencia_precio(bigint, text) from anon;
grant  execute on function public.revalidar_vigencia_precio(bigint, text) to authenticated;
grant  execute on function public.revalidar_vigencia_precio(bigint, text) to service_role;

-- H2 ------------------------------------------------------------------------
drop function if exists public._f100_probe();

-- ============================================================================
-- Verificación posterior (LECTURA, tras aplicar):
--   -- H1: anon/public = false, authenticated/service_role = true
--   select has_function_privilege('anon',          'public.revalidar_vigencia_precio(bigint,text)','EXECUTE') as anon,   -- false
--          has_function_privilege('public',         'public.revalidar_vigencia_precio(bigint,text)','EXECUTE') as pub,    -- false
--          has_function_privilege('authenticated',  'public.revalidar_vigencia_precio(bigint,text)','EXECUTE') as auth_,  -- true
--          has_function_privilege('service_role',   'public.revalidar_vigencia_precio(bigint,text)','EXECUTE') as svc;    -- true
--   -- Advisor anon_security_definer_function_executable ya NO debe listar este RPC.
--   -- H2: la función ya no existe
--   select to_regprocedure('public._f100_probe()') is null as probe_eliminado;   -- true
--   -- Advisor function_search_path_mutable ya NO debe listar _f100_probe.
-- ============================================================================
