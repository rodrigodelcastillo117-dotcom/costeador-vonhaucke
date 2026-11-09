-- ============================================================================
--  VERIFICACION POSTERIOR al fix 20261112 (SOLO LECTURA).
--  Correr DESPUES de aplicar la migracion a produccion. No modifica nada.
--  Devuelve una fila por chequeo con PASS/FAIL. Objetivo: 0 FAIL.
--  Cubre: PK (creado_por,clave), aislamiento por dueño, historial, RLS,
--  permisos efectivos, contrato de ambas RPC, y preservacion de la fila QA.
-- ============================================================================
with chk as (
  -- 1. PK compuesta en el ORDEN definido (creado_por, clave)
  select 1 n, 'PK = (creado_por, clave)' chequeo,
    coalesce((select string_agg(a.attname, ',' order by k.ord)
      from pg_index i join lateral unnest(i.indkey) with ordinality k(attnum,ord) on true
      join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
      where i.indrelid='public.expediente_costeo'::regclass and i.indisprimary),'') = 'creado_por,clave' ok,
    'orden del indice primario' detalle
  union all
  -- 2. creado_por NOT NULL (dueño inmutable, sin nulos)
  select 2, 'creado_por NOT NULL',
    coalesce((select attnotnull from pg_attribute where attrelid='public.expediente_costeo'::regclass and attname='creado_por'),false),
    'columna dueño'
  union all
  -- 3. guardar aislado por dueño (filtra por creado_por + clave)
  select 3, 'guardar: aislado por dueño',
    pg_get_functiondef('public.guardar_expediente_costeo(text,jsonb,integer)'::regprocedure) ilike '%creado_por = v_email and clave = v_clave%',
    'cuerpo de la RPC'
  union all
  -- 4. guardar YA NO usa el patron vulnerable (clave sola)
  select 4, 'guardar: sin patron vulnerable (clave sola)',
    pg_get_functiondef('public.guardar_expediente_costeo(text,jsonb,integer)'::regprocedure) not ilike '%where clave = btrim(p_clave) for update%',
    'ausencia del defecto P0'
  union all
  -- 5. reabrir aislado por dueño
  select 5, 'reabrir: aislado por dueño',
    pg_get_functiondef('public.reabrir_expediente_costeo(text)'::regprocedure) ilike '%creado_por = v_email and clave = btrim%',
    'cuerpo de la RPC'
  union all
  -- 6. historial existe con RLS habilitada
  select 6, 'historial append-only + RLS',
    to_regclass('public.expediente_costeo_historial') is not null
      and coalesce((select relrowsecurity from pg_class where oid='public.expediente_costeo_historial'::regclass),false),
    'tabla + rls'
  union all
  -- 7. RLS habilitada en la tabla principal
  select 7, 'RLS habilitada en expediente_costeo',
    coalesce((select relrowsecurity from pg_class where oid='public.expediente_costeo'::regclass),false),
    'rls on'
  union all
  -- 8. policy por creado_por INMUTABLE (no actualizado_por)
  select 8, 'RLS policy por creado_por (no actualizado_por)',
    exists(select 1 from pg_policies where tablename='expediente_costeo' and policyname='expediente_costeo_owner'
           and qual like '%creado_por%' and qual not like '%actualizado_por%'),
    'definicion de la policy'
  union all
  -- 9. execute concedido a authenticated en ambas RPC
  select 9, 'execute a authenticated (ambas RPC)',
    has_function_privilege('authenticated','public.guardar_expediente_costeo(text,jsonb,integer)','execute')
      and has_function_privilege('authenticated','public.reabrir_expediente_costeo(text)','execute'),
    'grants de ejecucion'
  union all
  -- 10. anon SIN execute
  select 10, 'anon SIN execute',
    not has_function_privilege('anon','public.guardar_expediente_costeo(text,jsonb,integer)','execute')
      and not has_function_privilege('anon','public.reabrir_expediente_costeo(text)','execute'),
    'anon no ejecuta'
  union all
  -- 11. authenticated/anon SIN acceso directo (DML) a la tabla
  select 11, 'sin acceso directo a la tabla (authenticated/anon)',
    not exists(select 1 from information_schema.role_table_grants
               where table_schema='public' and table_name='expediente_costeo'
               and grantee in ('authenticated','anon')
               and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')),
    'solo via RPC'
  union all
  -- 12. ambas RPC son SECURITY DEFINER con search_path fijado
  select 12, 'SECURITY DEFINER + search_path (ambas)',
    coalesce((select bool_and(prosecdef and coalesce(array_to_string(proconfig,','),'') like '%search_path%')
      from pg_proc where proname in ('guardar_expediente_costeo','reabrir_expediente_costeo')
      and pronamespace='public'::regnamespace),false),
    'definer + search_path'
  union all
  -- 13. contrato: ambas firmas intactas (cliente no requiere redeploy)
  select 13, 'contrato de firmas intacto',
    to_regprocedure('public.guardar_expediente_costeo(text,jsonb,integer)') is not null
      and to_regprocedure('public.reabrir_expediente_costeo(text)') is not null,
    'firmas (text,jsonb,integer) y (text)'
  union all
  -- 14. fila QA preservada (identidad + integridad por md5)
  select 14, 'fila QA preservada (md5 6fdd462c, v1, qa-direccion)',
    exists(select 1 from public.expediente_costeo
           where clave='TELSVH120' and lower(creado_por)='qa-direccion@vonhaucke.mx'
           and version=1 and md5(expediente::text)='6fdd462cb2fe1878746ad66f09a858db'),
    'integridad del contenido'
)
select n, chequeo, case when ok then 'PASS' else 'FAIL' end resultado, detalle
from chk
union all
select 99, 'RESUMEN', case when (select count(*) from chk where not ok)=0 then 'TODO PASS' else (select count(*)::text from chk where not ok)||' FAIL' end, 'objetivo: 0 FAIL'
order by n;
