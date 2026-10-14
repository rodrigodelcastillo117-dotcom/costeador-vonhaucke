-- Holdout Intelisis v2 · huellas de TODO lo que en base de datos puede cambiar selección de precio, unidad, material o
-- certificación (reauditoría externa 14-oct, P1-02). Solo lectura. El resultado (una fila JSON) se guarda como
-- huellas_db_<fecha>.json y `node scripts/congelar_holdout.mjs --verificar --db <archivo>` lo compara con el manifiesto.
select jsonb_build_object(
  'insumo_precios', (select jsonb_build_object('filas', count(*), 'md5', md5(string_agg(concat_ws('|', id, insumo_id, precio, estado, confidence,
      vigente_desde, vigente_hasta, approved_by, approved_at, source_document, requiere_validacion_compras, unidad_compra, factor_conversion,
      precio_compra, contract_status, cost_unit, source_hash), ',' order by id))) from public.insumo_precios),
  'insumos_catalogo', (select jsonb_build_object('filas', count(*), 'md5', md5(string_agg(concat_ws('|', id, nombre, familia, clasificacion,
      seccion, atributos::text, unidad_costeo, activo), ',' order by id))) from public.insumos_catalogo),
  'config_vonhaucke', (select md5(datos::text) from public.config where id = 'vonhaucke'),
  'sql', jsonb_build_object(
    'catalogo_vigente', md5(pg_get_viewdef('public.catalogo_vigente'::regclass, true)),
    'private_api.catalogo_motor', md5(pg_get_functiondef('private_api.catalogo_motor(boolean, text[])'::regprocedure)),
    'public.catalogo_motor', md5(pg_get_functiondef('public.catalogo_motor(boolean, text[])'::regprocedure)),
    'private_api.insumo_motor', md5(pg_get_functiondef('private_api.insumo_motor'::regproc)),
    'public.buscar_insumos_motor', md5(pg_get_functiondef('public.buscar_insumos_motor(text, integer)'::regprocedure))),
  'medido_en', now()
) as huellas;
