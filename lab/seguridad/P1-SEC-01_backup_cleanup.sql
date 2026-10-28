-- P1-SEC-01 · limpieza del backup `_bk_familia_app_20261021` — LISTO para que Dirección lo aplique.
-- NO aplicado por la sesión (es cambio de prod DB, §100).
--
-- Hallazgo real (medido HOY, read-only): la tabla tiene RLS DESHABILITADO (306 filas), PERO
-- anon/authenticated/public NO tienen ningún grant sobre ella (information_schema.role_table_grants
-- regresó vacío). Es decir: NO es lectura pública por la API; sólo la alcanza service_role/owner.
-- Por eso el advisor de seguridad ya no la marca como exposición. Severidad real: HIGIENE, no fuga.
--
-- Es un respaldo con fecha (`_bk_...20261021`). Lo correcto es eliminarlo. Si prefieres conservarlo,
-- usa la alternativa de abajo (habilitar RLS; al no haber policy ni grant, queda doblemente cerrado).

begin;

-- Opción A (recomendada): eliminar el respaldo.
drop table if exists public._bk_familia_app_20261021;

-- Opción B (si decides conservarlo): en vez del DROP de arriba, habilita RLS y revoca por si acaso.
-- alter table public._bk_familia_app_20261021 enable row level security;
-- revoke all on table public._bk_familia_app_20261021 from anon, authenticated;

commit;

-- Verificación (debe regresar 0 filas tras la Opción A):
-- select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and c.relname='_bk_familia_app_20261021';
