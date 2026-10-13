-- ============================================================================
--  PROPUESTA · VH-146 · backfill de `atributos.formato` en hojas ERP de familias tablero.
--  ⚠️ NO APLICAR sin autorización de Dirección. Nombre con prefijo PROPUESTA_ para que
--  `supabase db push` no la tome como migración ordenada.
--  Qué hace: a los insumos ERP con unidad_costeo 'hoja', familia tablero y nombre con
--  4x8 / 4' X 8' / 1.22 / 2.44 les pone formato tablero 1.22x2.44 (fraccion, merma 6 %);
--  a los 5x8, 1.525x2.44. No toca precios, estados ni insumos con formato ya asignado.
--  Rollback: restaurar `atributos` desde la tabla de respaldo que crea el paso 1.
-- ============================================================================
begin;
create table if not exists private_api.respaldo_vh146_atributos as
  select id, atributos, now() as respaldado_en from public.insumos_catalogo where false;
insert into private_api.respaldo_vh146_atributos (id, atributos)
select id, atributos from public.insumos_catalogo c
 where c.clasificacion='erp' and c.unidad_costeo='hoja'
   and coalesce(c.familia,'') in ('melamina','mdf','laminado_hpl','chapa_madera','acrilico')
   and jsonb_typeof(c.atributos->'formato') is distinct from 'object'
   and (c.nombre ~* '(^|[^0-9])4 ?''? ?X ?''? ?8([^0-9]|$)|1\.?22|2\.?44|(^|[^0-9])5 ?''? ?X ?''? ?8([^0-9]|$)|1\.?525?\b');

update public.insumos_catalogo c
   set atributos = coalesce(c.atributos,'{}'::jsonb)
       || jsonb_build_object('fraccion', true, 'mermaCorte', 6,
            'formato', case when c.nombre ~* '(^|[^0-9])5 ?''? ?X ?''? ?8([^0-9]|$)|1\.?525?\b'
              then '{"tipo":"tablero","nombre":"tablero 1.52 x 2.44","corto":"tablero 5x8","medida":3.721,"largoMM":2440,"anchoMM":1525}'::jsonb
              else '{"tipo":"tablero","nombre":"tablero 1.22 x 2.44","corto":"tablero","medida":2.9768,"largoMM":2440,"anchoMM":1220}'::jsonb end)
 where c.id in (select id from private_api.respaldo_vh146_atributos);
-- Verificación esperada (2026-10-13): ~241 filas (210 de 4x8 + 31 de 5x8).
select count(*) as actualizadas from private_api.respaldo_vh146_atributos;
commit;
-- ROLLBACK:
-- update public.insumos_catalogo c set atributos = r.atributos from private_api.respaldo_vh146_atributos r where r.id = c.id;
