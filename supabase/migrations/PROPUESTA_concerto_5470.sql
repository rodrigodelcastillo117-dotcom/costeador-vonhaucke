-- ============================================================================
--  CONCERTO a un solo precio: $5,470 (Rodrigo, 2026-10-20).
--  `silla-concerto` (producto 1925, la que pone el programa del plano) estaba a $5,140 mientras
--  `p9-silla-de-visita-concerto-5470` (banco/Voni) estaba a $5,470. Se cierra el renglón de $5,140
--  y se abre uno de $5,470. Idempotente; no toca otro precio.
-- ============================================================================
begin;

update public.lista_precio_items i set vigencia_hasta = date '2026-10-19'
from public.productos p
where p.source_type = 'banco' and p.source_ref = 'silla-concerto'
  and i.producto_version_id = p.version_tecnica_vigente_id
  and i.vigencia_hasta is null and i.precio_lista = 5140;

insert into public.lista_precio_items (lista_precio_id, producto_id, producto_version_id, precio_lista, moneda, vigencia_desde, piso_minimo, provenance)
select 1, p.id, p.version_tecnica_vigente_id, 5470, 'MXN', date '2026-10-20', null,
       'banco:silla-concerto · precio vigente CONCERTO (Dirección 2026-10-20)'
from public.productos p
where p.source_type = 'banco' and p.source_ref = 'silla-concerto'
  and not exists (select 1 from public.lista_precio_items i
                  where i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null);

commit;

-- Verificación (debe devolver 1 fila con 5470):
select p.source_ref, p.id, i.id item, i.precio_lista
from productos p join lista_precio_items i on i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null
where p.source_ref = 'silla-concerto';
