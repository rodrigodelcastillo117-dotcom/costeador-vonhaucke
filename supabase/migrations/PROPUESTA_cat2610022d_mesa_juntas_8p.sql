-- ============================================================================
--  CATÁLOGO · mesa de juntas App 3000 × 1200, 8 personas, 2 cajas eléctricas, $12,540
--  Rodrigo (2026-10-20): la de 8 personas con caja eléctrica es distinta de la de $18,560 (10 personas,
--  HDMI) y es la que debe llevar una sala de juntas de 8. Hoy sólo existe como `p9-app-mesa-de-juntas-12540`
--  (fuera de la carga canónica del programa del plano), así que se da de alta como `mj-3000x1200-8p`.
--  Mismo precio que la p9 (cotización 2610022 × 0.95). Idempotente. No toca ningún otro precio.
-- ============================================================================
begin;

insert into public.productos (codigo, nombre, familia, source_type, source_ref, estado, activo, creado_por, legacy_meta)
values (null, 'Mesa de juntas App 8 personas (2 cajas eléctricas)', null, 'banco', 'mj-3000x1200-8p', 'activo', true, 'cotizacion_2610022',
  '{"tipo":"mesa","fuente":"2610022","medidas":"3000 × 1200 mm","usuarios":8,"material":"cubiertas en melamina ABS, estructura y acometida metálica, 2 cajas eléctricas LUM-LIS (2 contactos y 1 USB)","categoria":"Mesas de juntas","precio_v1":12540}'::jsonb)
on conflict (source_type, source_ref) do nothing;

insert into public.producto_versiones (producto_id, etiqueta, dimensiones, estado_tecnico)
select p.id, 'base',
  '{"estado":"PRELIMINAR","fuente":"CATALOGO_TEXTO:legacy_meta.medidas","alto_mm":null,"ancho_mm":3000,"fondo_mm":1200,"evidencia":"3000 × 1200 mm","derivado_por":"cotizacion_2610022"}'::jsonb,
  'aprobado'
from public.productos p
where p.source_type = 'banco' and p.source_ref = 'mj-3000x1200-8p'
  and not exists (select 1 from public.producto_versiones v where v.producto_id = p.id);

update public.productos p set version_tecnica_vigente_id = v.id, actualizado = now()
from public.producto_versiones v
where p.source_type = 'banco' and p.source_ref = 'mj-3000x1200-8p'
  and v.producto_id = p.id and p.version_tecnica_vigente_id is null;

insert into public.lista_precio_items (lista_precio_id, producto_id, producto_version_id, precio_lista, moneda, vigencia_desde, piso_minimo, provenance)
select 1, p.id, p.version_tecnica_vigente_id, 12540, 'MXN', date '2026-10-20', null,
       'banco:mj-3000x1200-8p · cotizacion 2610022 x0.95 (= p9-app-mesa-de-juntas-12540)'
from public.productos p
where p.source_type = 'banco' and p.source_ref = 'mj-3000x1200-8p'
  and not exists (select 1 from public.lista_precio_items i
                  where i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null);

commit;

-- Verificación (debe devolver 1 fila: producto, versión, item, 12540):
select p.id producto, p.version_tecnica_vigente_id version, i.id item, i.precio_lista
from productos p join lista_precio_items i on i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null
where p.source_ref = 'mj-3000x1200-8p';
