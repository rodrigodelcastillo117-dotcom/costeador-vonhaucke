-- ============================================================================
--  CATÁLOGO · gaveta Modulor con cojín al precio de los archiveros (Rodrigo, 2026-10-20)
--  `p9-modulor-gaveta-9460` (producto 1761) es el archivero registro lateral Modulor 1200 con
--  cojín encima; "el cojín no mueve el precio". Se iguala a MOAHCL4I/DABSJ: $9,460 → $8,132.
--  Se cierra el renglón vigente y se abre uno nuevo (un solo precio vigente por versión).
--  Idempotente. No toca ningún otro precio.
-- ============================================================================
begin;

update public.lista_precio_items i set vigencia_hasta = date '2026-10-19'
from public.productos p
where p.source_type = 'banco' and p.source_ref = 'p9-modulor-gaveta-9460'
  and i.producto_version_id = p.version_tecnica_vigente_id
  and i.vigencia_hasta is null and i.precio_lista = 9460;

insert into public.lista_precio_items (lista_precio_id, producto_id, producto_version_id, precio_lista, moneda, vigencia_desde, piso_minimo, provenance)
select 1, p.id, p.version_tecnica_vigente_id, 8132, 'MXN', date '2026-10-20', null,
       'banco:p9-modulor-gaveta-9460 · igual a archiveros Modulor (2610022 x0.95)'
from public.productos p
where p.source_type = 'banco' and p.source_ref = 'p9-modulor-gaveta-9460'
  and not exists (select 1 from public.lista_precio_items i
                  where i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null);

commit;

-- Verificación (debe devolver 1 fila con 8132):
select p.source_ref, p.id, i.id item, i.precio_lista
from productos p join lista_precio_items i on i.producto_version_id = p.version_tecnica_vigente_id and i.vigencia_hasta is null
where p.source_ref = 'p9-modulor-gaveta-9460';
