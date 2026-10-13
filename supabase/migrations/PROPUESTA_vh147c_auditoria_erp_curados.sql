-- ============================================================================
--  PROPUESTA · VH-147c · auditoría de los precios ERP que viven en insumos CURADOS (clasificacion ≠ 'erp').
--  ⚠️ NO APLICAR sin autorización de Dirección. Requiere PROPUESTA_vh147 aplicada antes (usa precio_id, actualidad,
--  validez y politica_version de catalogo_vigente). Análisis: docs/auditoria/ERP_110_AUDITORIA.md; registros:
--  docs/auditoria/erp_110_registros.json. Probada en base aislada por supabase/tests/erpPolitica.test.js.
--
--  Contexto (producción, SELECT 2026-10-13): 110 filas `insumo_precios` con source_system='erp_intelisis', vigentes, en
--  insumos con clasificacion 'nuevo' (105) o 'vigente' (5). Son el lote A11 (ids 370–479,
--  supabase/datos/2026-10-12_a11_certificacion_erp.sql): precio de última compra ERP puesto a insumos del catálogo
--  CURADO. No hay incoherencia de precio con la política (103 aprobados con compra ≤ 24 m, 7 propuesto_validado > 24 m),
--  pero sí cinco riesgos de etiqueta/duplicidad/caducidad que esta propuesta hace VISIBLES sin tocar datos.
--
--  QUÉ HACE (parte A, sólo lectura): vista private_api.auditoria_erp_curados con categoría y banderas por fila.
--  QUÉ NO HACE: no cambia precio, estado, clasificacion, aprobación ni vigencia de ninguna fila.
--   · NO se reclasifica a 'erp': clasificacion <> 'erp' es lo que mete a estos insumos al catálogo curado que ven la IA
--     (analizar-mueble filtra clasificacion=neq.erp) y el motor por defecto (catalogo_motor p_incluir_erp=false).
--     Reclasificarlos los sacaría del catálogo de VONI. La procedencia se lee de `origen_precio` (VH-147b), no de aquí.
--  Parte B (OPCIONAL, comentada): cerrar la vigencia de los precios LEGACY duplicados. Requiere decisión explícita.
-- ============================================================================
begin;

create or replace view private_api.auditoria_erp_curados with (security_invoker = true) as
with erp as (
  select p.id as precio_id, p.insumo_id, c.nombre, c.clasificacion, c.seccion, c.unidad_costeo, c.atributos,
         p.estado, p.cost_unit_price_mxn as precio_mxn, p.source_unit, p.cost_unit, p.source_record_id,
         p.vigente_desde as ultima_compra, p.approved_by, p.approved_at, p.creado_por
  from public.insumo_precios p
  join public.insumos_catalogo c on c.id = p.insumo_id
  where p.vigente_hasta is null
    and p.source_system = 'erp_intelisis'
    and c.clasificacion is distinct from 'erp'
), eval as (
  select e.*, v.politica_version, v.ventana_actualidad_meses, v.actualidad, v.validez, v.certificable,
         v.precio_id as precio_id_en_vista,
         (e.ultima_compra + make_interval(months => v.ventana_actualidad_meses))::date + 1 as sale_de_ventana
  from erp e
  left join public.catalogo_vigente v on v.insumo_id = e.insumo_id
)
select x.precio_id, x.insumo_id, x.nombre, x.clasificacion, x.seccion, x.estado, x.precio_mxn, x.ultima_compra,
       x.sale_de_ventana, x.politica_version, x.actualidad, x.validez, x.certificable,
       case
         when x.estado = 'aprobado' and x.actualidad = 'VIGENTE' then 'A_APROBADO_EN_VENTANA'
         when x.estado = 'aprobado' then 'A2_APROBADO_FUERA_DE_VENTANA'          -- certifica por aprobación; compra ya antigua
         when x.actualidad = 'ANTIGUO' then 'B_PRELIMINAR_FUERA_DE_VENTANA'
         else 'C_DOCUMENTADO_EN_VENTANA_SIN_APROBAR'
       end as categoria,
       array_remove(array[
         'CLASIFICACION_NO_ERP',
         case when exists (select 1 from public.insumo_precios o where o.insumo_id = x.insumo_id and o.vigente_hasta is null
                             and o.id <> x.precio_id and o.contract_status = 'LEGACY_UNMIGRATED') then 'PRECIO_LEGACY_ABIERTO' end,
         case when exists (select 1 from public.insumo_precios o where o.insumo_id = x.insumo_id and o.vigente_hasta is null
                             and o.id <> x.precio_id and o.contract_status = 'DATA_TRUTH_V1'
                             and o.source_system is distinct from 'erp_intelisis') then 'OTRO_DATA_TRUTH_ABIERTO' end,
         case when exists (select 1 from public.insumo_precios o where o.vigente_hasta is null and o.insumo_id <> x.insumo_id
                             and o.source_system = 'erp_intelisis' and o.source_record_id = x.source_record_id) then 'ALIAS_REGISTRO_COMPARTIDO' end,
         case when x.unidad_costeo = 'hoja' and jsonb_typeof(x.atributos -> 'formato') is distinct from 'object' then 'HOJA_SIN_FORMATO' end,
         case when x.source_unit is distinct from x.cost_unit then 'UNIDAD_ERP_DISTINTA' end,
         case when x.estado = 'aprobado' and x.sale_de_ventana <= (current_date + interval '12 months')::date then 'APROBADO_SALE_DE_VENTANA_LE_12M' end,
         case when x.precio_id_en_vista is distinct from x.precio_id then 'NO_GANA_EN_VISTA' end
       ], null) as banderas
from eval x;

comment on view private_api.auditoria_erp_curados is
  'VH-147c · precios ERP (erp_intelisis) vigentes en insumos curados (clasificacion <> erp): categoría por política activa y banderas de riesgo. Sólo lectura.';
revoke all on private_api.auditoria_erp_curados from public, anon, authenticated;
grant select on private_api.auditoria_erp_curados to service_role;

-- Consultas sugeridas (sólo lectura):
--   select categoria, count(*) from private_api.auditoria_erp_curados group by 1 order by 1;
--   select b, count(*) from private_api.auditoria_erp_curados, unnest(banderas) b group by 1 order by 2 desc;
--   Esperado 2026-10-13: A_APROBADO_EN_VENTANA 103 · B_PRELIMINAR_FUERA_DE_VENTANA 7; banderas CLASIFICACION_NO_ERP 110,
--   PRECIO_LEGACY_ABIERTO 109, APROBADO_SALE_DE_VENTANA_LE_12M 27, OTRO_DATA_TRUTH_ABIERTO 8, ALIAS_REGISTRO_COMPARTIDO 4,
--   UNIDAD_ERP_DISTINTA 3, HOJA_SIN_FORMATO 2, NO_GANA_EN_VISTA 0.
commit;

-- ============================================================================
--  PARTE B (OPCIONAL, NO incluida en el begin/commit de arriba). Cerrar la vigencia de los precios LEGACY_UNMIGRATED
--  que conviven abiertos con un precio ERP APROBADO del mismo insumo curado (102 hoy = 109 con LEGACY abierto menos los 7
--  de categoría B, que se dejan). NO cambia ningún precio: sólo pone
--  vigente_hasta (el trigger append-only lo permite en filas no aprobadas; la fila queda como historia).
--  Por qué: hoy la vista elige el ERP (aprobado/alta), pero si un día se cierra o revoca el ERP, la lista LEGACY
--  (fecha de carga 2026-10-01, sin documento) vuelve a ser "el precio" en silencio.
--  Por qué NO aplicarla sin pensar: los 7 de categoría B son PRELIMINAR por antigüedad (compras 2016–2024); su LEGACY
--  es la lista de Compras del 2026-08 (referenciada). Dirección puede preferir conservar esa referencia para re-cotizar.
--  Quitar el prefijo "-- " entre los marcadores y ejecutar aparte, con respaldo previo.
-- >>> OPCIONAL B VH-147c
-- begin;
-- create table if not exists private_api.respaldo_vh147c_legacy_cerrados as
--   select o.*, now() as respaldado_en from public.insumo_precios o where false;
-- insert into private_api.respaldo_vh147c_legacy_cerrados
--   select o.*, now() from public.insumo_precios o
--    where o.vigente_hasta is null and o.contract_status = 'LEGACY_UNMIGRATED'
--      and o.insumo_id in (select insumo_id from private_api.auditoria_erp_curados where categoria like 'A%');
-- update public.insumo_precios o set vigente_hasta = current_date
--  where o.vigente_hasta is null and o.contract_status = 'LEGACY_UNMIGRATED' and o.estado <> 'aprobado'
--    and o.insumo_id in (select insumo_id from private_api.auditoria_erp_curados where categoria like 'A%');
-- commit;
-- <<< FIN OPCIONAL B VH-147c
--  (Su reversa no existe por diseño: el trigger append-only impide reabrir vigente_hasta. Por eso es opcional.)
-- ============================================================================

-- ============================================================================
--  ROLLBACK VH-147c (parte A): quitar el prefijo "-- " entre los marcadores y ejecutar aparte.
-- >>> ROLLBACK VH-147c
-- begin;
-- drop view if exists private_api.auditoria_erp_curados;
-- commit;
-- <<< FIN ROLLBACK VH-147c
-- ============================================================================
