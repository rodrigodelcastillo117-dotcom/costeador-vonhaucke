-- ============================================================================
--  PROPUESTA · VH-146b · formato de hoja (4×8 / 5×8) en hojas ERP de tablero. Sustituye a PROPUESTA_vh146.
--  ⚠️ NO APLICAR sin autorización EXPRESA de Dirección. Prefijo PROPUESTA_ para que `supabase db push` no la tome.
--
--  Endurecida según la auditoría externa del 14-oct-2026 (sección 4):
--   1. Sólo nombres con "4 X 8" / "5 X 8" EXPLÍCITO. Sin los respaldos por decimales (1.22 / 2.44 / 1.525): medido en
--      producción (solo lectura, 14-oct) los 247 candidatos lo traen explícito, así que no hacen falta y sólo añaden riesgo.
--   2. ACRÍLICO FUERA (16 filas): no hay precedente en el catálogo de acrílico con `formato` + `fraccion`; queda para
--      decisión de Compras.
--   3. Lista CONGELADA: los ids exactos se guardan en el respaldo con su nombre y familia ANTES del UPDATE.
--   4. El UPDATE vuelve a exigir familia, unidad, patrón y "sin formato": no confía sólo en que el id esté respaldado.
--   5. Respaldo + update + verificaciones en UNA transacción; si una verificación falla, se aborta todo (raise).
--   6. Verifica AME28152 (melamina 28 mm, 5×8) → 1525 × 2440 mm.
--   7. Verifica que NO cambia ningún precio (insumo_precios intacto) ni otra columna que `atributos`.
--   8. El rollback es SÓLO para la misma ventana: restaura una fila únicamente si sus atributos siguen siendo
--      exactamente los que puso esta migración (no pisa cambios posteriores).
--
--  Alcance esperado al 14-oct-2026: 231 filas = 247 − 16 acrílicos → 4×8: 200 (chapa 4, HPL 83, MDF 38, melamina 75);
--  5×8: 31 (MDF 2, melamina 29). Si la cuenta real difiere de 231, la transacción se aborta: hay que volver a medir.
-- ============================================================================
begin;

create table if not exists private_api.respaldo_vh146b_atributos (
  id text primary key,
  nombre text not null,
  familia text not null,
  atributos_antes jsonb,
  atributos_despues jsonb,
  formato_asignado text not null check (formato_asignado in ('4x8', '5x8')),
  respaldado_en timestamptz not null default now()
);

-- Huella de precios ANTES (para probar que no cambian).
create temporary table _vh146b_precios_antes on commit drop as
  select md5(string_agg(t::text, '|' order by t.id)) as huella from public.insumo_precios t;

-- 1) Lista congelada.
with candidatos as (
  select c.id, c.nombre, c.familia, c.atributos,
         case when c.nombre ~* '(^|[^0-9])5\s*''?\s*x\s*''?\s*8($|[^0-9])' then '5x8'
              when c.nombre ~* '(^|[^0-9])4\s*''?\s*x\s*''?\s*8($|[^0-9])' then '4x8' end as fmt
    from public.insumos_catalogo c
   where c.clasificacion = 'erp'
     and c.unidad_costeo = 'hoja'
     and c.familia in ('melamina', 'mdf', 'laminado_hpl', 'chapa_madera')     -- acrílico fuera (punto 2)
     and jsonb_typeof(c.atributos -> 'formato') is distinct from 'object'
)
insert into private_api.respaldo_vh146b_atributos (id, nombre, familia, atributos_antes, formato_asignado)
select id, nombre, familia, atributos, fmt from candidatos where fmt is not null
on conflict (id) do nothing;

do $$ declare n int; begin
  select count(*) into n from private_api.respaldo_vh146b_atributos;
  if n <> 231 then raise exception 'VH-146b: se esperaban 231 candidatos y hay %. Volver a medir antes de aplicar.', n; end if;
end $$;

-- 2) Backfill con re-verificación de condiciones (punto 4).
update public.insumos_catalogo c
   set atributos = coalesce(c.atributos, '{}'::jsonb) || jsonb_build_object(
         'fraccion', true,
         'mermaCorte', 6,
         'formato', case r.formato_asignado
           when '5x8' then '{"tipo":"tablero","nombre":"tablero 1.52 x 2.44","corto":"tablero 5x8","medida":3.721,"largoMM":2440,"anchoMM":1525}'::jsonb
           else           '{"tipo":"tablero","nombre":"tablero 1.22 x 2.44","corto":"tablero","medida":2.9768,"largoMM":2440,"anchoMM":1220}'::jsonb
         end)
  from private_api.respaldo_vh146b_atributos r
 where r.id = c.id
   and c.clasificacion = 'erp' and c.unidad_costeo = 'hoja'
   and c.familia = r.familia and c.nombre = r.nombre
   and jsonb_typeof(c.atributos -> 'formato') is distinct from 'object';

update private_api.respaldo_vh146b_atributos r set atributos_despues = c.atributos
  from public.insumos_catalogo c where c.id = r.id;

-- 3) Verificaciones (abortan la transacción si fallan).
do $$ declare n int; f jsonb; begin
  select count(*) into n from private_api.respaldo_vh146b_atributos r join public.insumos_catalogo c on c.id = r.id
   where jsonb_typeof(c.atributos -> 'formato') = 'object' and (c.atributos ->> 'fraccion')::boolean;
  if n <> 231 then raise exception 'VH-146b: sólo % de 231 quedaron con formato.', n; end if;

  select c.atributos -> 'formato' into f from public.insumos_catalogo c
   where c.nombre ilike '%AME28152%' and c.clasificacion = 'erp' order by c.id limit 1;
  if f is null or (f ->> 'anchoMM')::int <> 1525 or (f ->> 'largoMM')::int <> 2440 then
    raise exception 'VH-146b: AME28152 no quedó como 5×8 (1525×2440): %', f; end if;

  if (select md5(string_agg(t::text, '|' order by t.id)) from public.insumo_precios t) <> (select huella from _vh146b_precios_antes) then
    raise exception 'VH-146b: cambió insumo_precios; esta migración sólo debe tocar atributos.'; end if;
end $$;

-- Resumen (solo lectura).
select formato_asignado, familia, count(*) from private_api.respaldo_vh146b_atributos group by 1, 2 order by 1, 2;
commit;

-- ============================================================================
--  ROLLBACK (SÓLO dentro de la misma ventana). Restaura una fila únicamente si sus atributos siguen siendo los que
--  dejó VH-146b; si alguien los cambió después, NO la toca y la lista para revisión manual.
-- ----------------------------------------------------------------------------
-- Líneas ejecutables marcadas "-- RB ": quitar ese prefijo para correrlas.
-- RB begin;
-- RB select r.id, r.nombre from private_api.respaldo_vh146b_atributos r join public.insumos_catalogo c on c.id = r.id
-- RB  where c.atributos is distinct from r.atributos_despues;               -- cambiadas después: NO se restauran
-- RB update public.insumos_catalogo c set atributos = r.atributos_antes
-- RB   from private_api.respaldo_vh146b_atributos r
-- RB  where r.id = c.id and c.atributos is not distinct from r.atributos_despues;
-- RB commit;
-- ============================================================================
