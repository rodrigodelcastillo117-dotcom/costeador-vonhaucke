-- Línea base de producción para el gate 9.5 (SOLO LECTURA). Se corre igual antes y después: el diff de la salida es el drift.
-- Uso: pegarla en el SQL editor (o execute_sql) del proyecto mtuvnbgljwbsaizjjgzs y guardar la fila JSON. Prechecks P4–P6, P9, P10 de §5.1.
select jsonb_build_object(
 'migraciones_ultimas', (select jsonb_agg(v order by v desc) from (select version||' '||coalesce(name,'') v from supabase_migrations.schema_migrations order by version desc limit 3) t),
 'pg', current_setting('server_version'),
 'postgrest', (select jsonb_agg(distinct application_name) from pg_stat_activity where usename = 'authenticator'),
 'catalogo_vigente', jsonb_build_object(
    'relacl', (select relacl::text from pg_class where oid = 'public.catalogo_vigente'::regclass),
    'md5_def', md5(pg_get_viewdef('public.catalogo_vigente'::regclass, true)),
    'tiene_precio_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='catalogo_vigente' and column_name='precio_id'),
    'dependientes', (select jsonb_agg(case when d.classid = 'pg_proc'::regclass then d.objid::regprocedure::text else (select ev_class::regclass::text from pg_rewrite where oid = d.objid) end) from pg_depend d where ((d.refclassid = 'pg_class'::regclass and d.refobjid = 'public.catalogo_vigente'::regclass) or (d.refclassid = 'pg_type'::regclass and d.refobjid = (select reltype from pg_class where oid = 'public.catalogo_vigente'::regclass))) and not (d.classid = 'pg_rewrite'::regclass and (select ev_class from pg_rewrite where oid = d.objid) = 'public.catalogo_vigente'::regclass) and d.deptype <> 'i'),
    'dependientes_funciones', (select jsonb_agg(distinct p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private_api') and p.prosrc ~ 'catalogo_vigente')),
 'md5_motor', jsonb_build_object(
    'private_api.insumo_motor', md5(pg_get_functiondef('private_api.insumo_motor'::regproc)),
    'private_api.catalogo_motor', md5(pg_get_functiondef('private_api.catalogo_motor(boolean, text[])'::regprocedure))),
 'producto_version_economia', (select jsonb_build_object('filas', count(*), 'md5', md5(string_agg(concat_ws('|', producto_version_id, costo_oficial_referencia, formula_version, fuente, actualizado), ',' order by producto_version_id))) from public.producto_version_economia),
 'objetos_ventana', jsonb_build_object(
    'actualizar_cotizacion_segura_3arg', to_regprocedure('public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)') is not null,
    'adjuntar_costeo_a_partida', exists(select 1 from pg_proc where proname = 'adjuntar_costeo_a_partida'),
    'promesa_partida', exists(select 1 from pg_proc where proname = 'promesa_partida'),
    'spec_tecnica', exists(select 1 from pg_proc where proname in ('spec_tecnica','huella_spec_tecnica')),
    'cargar_costos_oficiales', exists(select 1 from pg_proc where proname = 'cargar_costos_oficiales'),
    'activar_autoridad_costeo', exists(select 1 from pg_proc where proname = 'activar_autoridad_costeo'),
    'politica_emision_autoridad', to_regclass('private_api.politica_emision_autoridad') is not null,
    'costeos_servidor', to_regclass('public.costeos_servidor') is not null,
    'partida_costeo_vigente', to_regclass('public.partida_costeo_vigente') is not null,
    'cols_promesa_spec', (select count(*) from information_schema.columns where table_name = 'costeos_servidor' and (column_name like 'promesa\_%' or column_name like 'spec\_tecnica\_%')),
    'funciones_40001', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private_api') and p.prosrc ~ '40001')),
 'cuentas_no_humanas', jsonb_build_object('filas', (select count(*) from public.cuentas_no_humanas), 'comentario', obj_description('public.cuentas_no_humanas'::regclass, 'pg_class')),
 'precios', jsonb_build_object('total', (select count(*) from public.insumo_precios),
    'aprobado', (select count(*) from public.insumo_precios where estado = 'aprobado'),
    'propuesto', (select count(*) from public.insumo_precios where estado = 'propuesto'),
    'firmas_humanas', (select count(*) from public.aprobaciones_precio_historial))
) as baseline;
