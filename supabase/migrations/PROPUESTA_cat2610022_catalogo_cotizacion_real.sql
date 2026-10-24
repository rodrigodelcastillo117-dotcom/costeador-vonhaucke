-- ============================================================================
--  CATÁLOGO · cotización real A-2610022-01 (20-oct-2026, asesor Edgar Serna)
--  Rodrigo (2026-10-20): "agrega todo, y hazlo con un 5% abajo del precio que dice.
--  sobre GAMMA E, revisa que sí sea la GAMMA E y no la GAMMA".
--
--  1) Seis productos que la cotización vende y el catálogo no tenía, a precio de
--     la cotización × 0.95 (Lista Base V1, id 1):
--       FXESCCM24M19ABS  FLEX 1200 rodante c/charola y cajón   3,300.00 → 3,135.00  (línea)
--       MOAHCL4IABSJ     Archivero Modulor 1200, izquierdo     8,560.00 → 8,132.00  (banco)
--       MOAHCL4DABSJ     Archivero Modulor 1200, derecho       8,560.00 → 8,132.00  (banco)
--       Mesa juntas APP 3000×1200, 8 usuarios                 13,200.00 → 12,540.00 (banco)
--       Mesa juntas APP redonda Ø1500, 6 usuarios             15,400.00 → 14,630.00 (banco)
--       Mesa alta ALBA 4000×1030×1200, 10 usuarios            21,092.00 → 20,037.40 (banco)
--  2) GAMMA-E: la silla que el plano pone sola (`silla-gamma-e`) estaba a $4,140
--     (2508040, mar-2026) mientras el banco, la búsqueda y Voni la daban a $3,990
--     (226050047, may-2026; la cotización de octubre también la vende a $3,990).
--     Se cierra el renglón de $4,140 y se abre uno de $3,990: una sola silla, un
--     solo precio. (GAMMA ≠ GAMMA-E: la GAMMA es base de aluminio y asiento en
--     mesh — ERP erp-gammaem —; ninguno de estos productos es la GAMMA.)
--
--  Idempotente: si ya se aplicó, no duplica nada. No toca ningún otro precio.
-- ============================================================================
create temp table _nuevos (
  source_type text, source_ref text, codigo text, nombre text, familia text,
  legacy_meta jsonb, dimensiones jsonb, precio numeric, piso numeric
);

insert into _nuevos values
 ('linea','FXESCCM24M19ABS','FXESCCM24M19ABS',
  'ESCRITORIO RECTANGULAR DE 1200 X 751 mm MODELO FLEX OPG, RODANTE CON ESTRUCTURA PLEGABLE Y CUBIERTA DE 1200 mm CON CHAROLA Y CAJON; EN MELAMINA CANTO ABS -- FXESCCM24M19ABS',
  'FLEX', '{"cc":"FXESCCM24M19ABS","piso":3135,"ruta":"flex","precio_v1":3135,"fuente":"2610022 x0.95"}',
  '{"estado":"PRELIMINAR","fuente":"CATALOGO_TEXTO:nombre_intelisis","ancho_mm":1200,"fondo_mm":751,"evidencia":"ESCRITORIO RECTANGULAR DE 1200 X 751 mm MODELO FLEX OPG, RODANTE -- FXESCCM24M19ABS","derivado_por":"cotizacion_2610022"}',
  3135.00, 3135.00),
 ('banco','p9-modulor-archivero-izq-8132','MOAHCL4IABSJ','Modulor · Archivero registro lateral izquierdo', null,
  '{"tipo":"guarda","fuente":"2610022","material":"metálico, frentes en melamina canto ABS, cajón papelero, cajón archivero, jaladeras, cerradura","categoria":"Guardas y archivo","precio_v1":8132}',
  null, 8132.00, null),
 ('banco','p9-modulor-archivero-der-8132','MOAHCL4DABSJ','Modulor · Archivero registro lateral derecho', null,
  '{"tipo":"guarda","fuente":"2610022","material":"metálico, frentes en melamina canto ABS, cajón papelero, cajón archivero, jaladeras, cerradura","categoria":"Guardas y archivo","precio_v1":8132}',
  null, 8132.00, null),
 ('banco','p9-app-mesa-de-juntas-12540',null,'App · Mesa de juntas', null,
  '{"tipo":"mesa","fuente":"2610022","material":"cubiertas en melamina ABS, estructura y acometida metálica, 2 cajas eléctricas LUM-LIS (2 contactos y 1 USB)","categoria":"Mesas de juntas","precio_v1":12540}',
  null, 12540.00, null),
 ('banco','p9-app-mesa-de-juntas-redonda-14630',null,'App · Mesa de juntas redonda', null,
  '{"tipo":"mesa","fuente":"2610022","material":"cubierta en melamina ABS, estructura metálica, caja eléctrica LUM-LIS (2 contactos y 1 USB), maneja cables","categoria":"Mesas de juntas","precio_v1":14630}',
  null, 14630.00, null),
 ('banco','p9-alba-mesa-alta-20037',null,'Alba · Mesa alta', null,
  '{"tipo":"mesa","fuente":"2610022","material":"cubierta en melamina cantos ABS, estructura metálica","categoria":"Mesas y complementos","precio_v1":20037.4}',
  null, 20037.40, null);

-- productos
insert into public.productos (codigo, nombre, familia, source_type, source_ref, estado, activo, creado_por, legacy_meta)
select n.codigo, n.nombre, n.familia, n.source_type, n.source_ref, 'activo', true, 'cotizacion_2610022', n.legacy_meta
from _nuevos n
on conflict (source_type, source_ref) do nothing;

-- una versión base aprobada por producto (sólo si aún no tiene)
insert into public.producto_versiones (producto_id, etiqueta, dimensiones, estado_tecnico)
select p.id, 'base', n.dimensiones, 'aprobado'
from _nuevos n join public.productos p on p.source_type = n.source_type and p.source_ref = n.source_ref
where not exists (select 1 from public.producto_versiones v where v.producto_id = p.id);

update public.productos p set version_tecnica_vigente_id = v.id, actualizado = now()
from _nuevos n, public.producto_versiones v
where p.source_type = n.source_type and p.source_ref = n.source_ref
  and v.producto_id = p.id and p.version_tecnica_vigente_id is null;

-- un renglón vigente de precio por versión
insert into public.lista_precio_items (lista_precio_id, producto_id, producto_version_id, precio_lista, moneda, vigencia_desde, piso_minimo, provenance)
select 1, p.id, p.version_tecnica_vigente_id, n.precio, 'MXN', date '2026-10-20', n.piso,
       n.source_type || ':' || n.source_ref || ' · cotizacion 2610022 x0.95'
from _nuevos n join public.productos p on p.source_type = n.source_type and p.source_ref = n.source_ref
where not exists (select 1 from public.lista_precio_items i
                  where i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null);

-- GAMMA-E canónica (`silla-gamma-e`, producto 1927): 4,140 → 3,990
update public.lista_precio_items i set vigencia_hasta = date '2026-10-19'
from public.productos p
where p.source_type = 'banco' and p.source_ref = 'silla-gamma-e'
  and i.producto_version_id = p.version_tecnica_vigente_id
  and i.vigencia_hasta is null and i.precio_lista = 4140;

insert into public.lista_precio_items (lista_precio_id, producto_id, producto_version_id, precio_lista, moneda, vigencia_desde, piso_minimo, provenance)
select 1, p.id, p.version_tecnica_vigente_id, 3990, 'MXN', date '2026-10-20', null,
       'banco:silla-gamma-e · precio vigente GAMMA-E (226050047 / 2610022)'
from public.productos p
where p.source_type = 'banco' and p.source_ref = 'silla-gamma-e'
  and not exists (select 1 from public.lista_precio_items i
                  where i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null);

drop table _nuevos;

-- Verificación (debe devolver 7 filas, cada una con un solo precio vigente):
-- select p.source_ref, p.id, p.version_tecnica_vigente_id, i.id item, i.precio_lista, i.piso_minimo
-- from productos p join lista_precio_items i on i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null
-- where p.source_ref in ('FXESCCM24M19ABS','p9-modulor-archivero-izq-8132','p9-modulor-archivero-der-8132',
--   'p9-app-mesa-de-juntas-12540','p9-app-mesa-de-juntas-redonda-14630','p9-alba-mesa-alta-20037','silla-gamma-e');
