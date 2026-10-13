-- ============================================================================
--  PROPUESTA · VH-146 · backfill de `atributos.formato` en hojas ERP de familias tablero.
--  ⚠️ NO APLICAR sin autorización de Dirección. Prefijo PROPUESTA_ para que `supabase db push` no la tome.
--  Probada en base aislada (PGlite) por `supabase/tests/formatoHojasErp.test.js`; el efecto en el motor se mide en
--  `src/motor/formatoHojaErp.test.js`; resultados en `docs/auditoria/ERP_POLITICA_PRUEBAS.md`.
--
--  POR QUÉ: P0-02 (calculo.js) bloquea —con razón— el consumo por largo×ancho de un insumo con precio POR HOJA que no
--  trae `formato` (no se inventa la conversión m² ↔ hoja). 341 hojas ERP de `cubiertas` quedaron sin formato porque el
--  patrón del cargador no reconocía `HOJA 4' X 8'` (210) ni 5×8 (31). Aquí se les asigna el MISMO objeto `formato`
--  que usa el cargador corregido (erpCarga.js TABLERO / TABLERO5X8) y el catálogo curado (insumos.js `tablero()`).
--
--  QUÉ HACE (idempotente; sólo `insumos_catalogo.atributos`, nunca precios ni estados):
--   · candidatos: clasificacion='erp', unidad_costeo='hoja', familia ∈ {melamina, mdf, laminado_hpl, chapa_madera,
--     acrilico}, SIN formato (atributos->'formato' no es objeto) y nombre que casa con los patrones de erpCarga.js:
--       5×8 primero (más específico): (^|[^0-9])5 ?'? ?x ?'? ?8(fin|[^0-9]) | 1.52 / 1.525  → tablero 1.525 × 2.44 (3.721 m²)
--       4×8 después:                  (^|[^0-9])4 ?'? ?x ?'? ?8(fin|[^0-9]) | 1.22 | 2.44    → tablero 1.22 × 2.44 (2.9768 m²)
--     Los límites de palabra (\y) evitan que "2440 X 1220 mm" o "1220" cuenten como 2.44/1.22 (igual que \b en JS).
--   · respaldo: private_api.respaldo_vh146_atributos (id, atributos originales, formato asignado, fecha) antes de tocar.
--   · asigna atributos || {fraccion:true, mermaCorte:6, formato:{…}}. `fraccion=true` es lo que hace que el motor cobre la
--     FRACCIÓN de hoja por rejilla (calculo.js comprarInsumo, rama `insumo.formato && insumo.fraccion`); en esa rama
--     `mermaCorte` NO entra en la fórmula (ver formatoHojaErp.test.js). El 6 es el valor del catálogo curado para TODOS los
--     tableros (insumos.js `tablero()`), sin respaldo técnico documentado de Producción: se copia por paridad, no por
--     evidencia. Si Dirección prefiere no fijarlo, poner 0 no cambia el costo de estas hojas.
--   · NO toca: láminas de metal (su `medida` es kg por hoja según calibre — con Compras, VH-099b), hojas ya formateadas,
--     insumos curados, hojas sin familia reconocida (quedan listadas en la verificación para Compras).
-- ============================================================================
begin;

create table if not exists private_api.respaldo_vh146_atributos (
  id text primary key,
  atributos jsonb,
  formato_asignado text not null,
  respaldado_en timestamptz not null default now()
);
comment on table private_api.respaldo_vh146_atributos is
  'VH-146 · atributos ORIGINALES de las hojas ERP a las que el backfill asignó formato. Rollback: ver el final de PROPUESTA_vh146_formato_hojas_erp.sql.';

-- 1) Respaldo de los candidatos (una sola vez por id: si ya está respaldado, se conserva el original).
with candidatos as (
  select c.id, c.atributos,
         case when c.nombre ~* '(^|[^0-9])5\s*''?\s*x\s*''?\s*8($|[^0-9])|1\.?525?\y' then '5x8'
              when c.nombre ~* '(^|[^0-9])4\s*''?\s*x\s*''?\s*8($|[^0-9])|1\.?22\y|2\.?44\y'   then '4x8'
         end as fmt
    from public.insumos_catalogo c
   where c.clasificacion = 'erp'
     and c.unidad_costeo = 'hoja'
     and coalesce(c.familia, '') in ('melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'acrilico')
     and jsonb_typeof(c.atributos -> 'formato') is distinct from 'object'
)
insert into private_api.respaldo_vh146_atributos (id, atributos, formato_asignado)
select id, atributos, fmt from candidatos where fmt is not null
on conflict (id) do nothing;

-- 2) Backfill. Sólo filas respaldadas que SIGUEN sin formato (idempotente: la segunda corrida actualiza 0).
update public.insumos_catalogo c
   set atributos = coalesce(c.atributos, '{}'::jsonb)
       || jsonb_build_object(
            'fraccion', true,
            'mermaCorte', 6,
            'formato', case r.formato_asignado
              when '5x8' then '{"tipo":"tablero","nombre":"tablero 1.52 x 2.44","corto":"tablero 5x8","medida":3.721,"largoMM":2440,"anchoMM":1525}'::jsonb
              else           '{"tipo":"tablero","nombre":"tablero 1.22 x 2.44","corto":"tablero","medida":2.9768,"largoMM":2440,"anchoMM":1220}'::jsonb
            end)
  from private_api.respaldo_vh146_atributos r
 where r.id = c.id
   and c.clasificacion = 'erp'
   and jsonb_typeof(c.atributos -> 'formato') is distinct from 'object';

-- 3) Verificación (sólo lectura). Esperado al 2026-10-13: ~241 respaldadas (≈210 de 4x8 + ≈31 de 5x8).
select r.formato_asignado, count(*) as respaldadas,
       count(*) filter (where jsonb_typeof(c.atributos -> 'formato') = 'object') as con_formato
  from private_api.respaldo_vh146_atributos r join public.insumos_catalogo c on c.id = r.id
 group by 1 order by 1;
-- Hojas ERP que SIGUEN sin formato tras el backfill (para Compras: láminas de metal, sin familia, nombres sin medida).
select c.id, c.nombre, c.familia, c.seccion
  from public.insumos_catalogo c
 where c.clasificacion = 'erp' and c.unidad_costeo = 'hoja' and c.activo
   and jsonb_typeof(c.atributos -> 'formato') is distinct from 'object'
 order by c.seccion, c.nombre;
commit;

-- ============================================================================
--  ROLLBACK VH-146. Bloque comentado: quitar el prefijo "-- " de cada línea entre los marcadores y ejecutar aparte
--  (formatoHojasErp.test.js lo hace así y verifica que `atributos` vuelve byte a byte al original).
--  La tabla de respaldo se conserva como rastro; borrarla es opcional y queda doblemente comentada.
-- ============================================================================
-- >>> ROLLBACK VH-146
-- begin;
-- update public.insumos_catalogo c
--    set atributos = r.atributos
--   from private_api.respaldo_vh146_atributos r
--  where r.id = c.id;
-- -- drop table private_api.respaldo_vh146_atributos;
-- commit;
-- <<< FIN ROLLBACK VH-146
