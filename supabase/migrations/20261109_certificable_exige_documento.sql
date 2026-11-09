-- ============================================================================
--  P1 · APRIETE FAIL-CLOSED: `certificable` EXIGE DOCUMENTO DE RESPALDO (2026-11-09).
--  PROPUESTA — NO APLICADA A PRODUCCIÓN. Recrea una vista productiva; aplicar sólo
--  con autorización explícita de Dirección.
--
--  Hueco (auditoría 2026-11-08, verificado 2026-11-09): 140 precios eran
--  `certificable = true` SIN `source_document` — un costo "oficial certificado"
--  sin documento estructurado de origen. La regla de la vista no lo exigía.
--
--  Este cambio AÑADE la condición `source_document presente` a la certificación
--  (y a `estatus_certificacion`). Es un APRIETE, no relaja nada:
--    · un precio sin documento pasa de CERTIFICADO → PRELIMINAR,
--    · SIGUE costeando (el precio se usa igual), pero NO certifica hasta documentarse,
--    · NO cambia la SELECCIÓN del precio (misma precedencia estado→confidence→
--      vigente_desde→id) ni ningún importe. Mismas columnas de salida (CREATE OR
--      REPLACE válido).
--
--  ROLLBACK: recrear la vista sin la condición de `source_document` (la definición
--  inmediatamente anterior a esta migración; está en el baseline del esquema).
-- ============================================================================
create or replace view public.catalogo_vigente as
 with ranked as (
   select p.id, p.insumo_id, p.precio, p.unidad_compra, p.precio_compra, p.factor_conversion,
          p.propiedades, p.proveedor, p.fuente, p.evidencia, p.vigente_desde, p.vigente_hasta,
          p.estado, p.creado_por, p.creado_en, p.confidence, p.evidence_status, p.approved_by,
          p.approved_at, p.requiere_validacion_compras, p.source_document,
          c.nombre, c.seccion, c.clasificacion,
          row_number() over (partition by p.insumo_id order by
            (case p.estado when 'aprobado' then 0 when 'propuesto_validado' then 1 when 'propuesto' then 2 else 3 end),
            (case p.confidence when 'alta' then 0 when 'media' then 1 else 2 end),
            p.vigente_desde desc nulls last, p.id desc) as rn
     from insumo_precios p
     join insumos_catalogo c on c.id = p.insumo_id
    where p.vigente_hasta is null and coalesce(c.activo, true) = true
 )
 select insumo_id, nombre, seccion, clasificacion, precio, unidad_compra, precio_compra,
        factor_conversion, propiedades, estado, evidence_status, confidence, requiere_validacion_compras,
        (estado = 'aprobado'::text
          and not requiere_validacion_compras
          and vigente_desde is not null
          and vigente_desde >= (current_date - make_interval(months => 24))
          and nullif(btrim(source_document), ''::text) is not null) as certificable,
        fuente, evidencia, vigente_desde, id as precio_id,
        current_date - vigente_desde as antiguedad_dias,
        case
          when (estado = 'aprobado'::text
                and not requiere_validacion_compras
                and vigente_desde is not null
                and vigente_desde >= (current_date - make_interval(months => 24))
                and nullif(btrim(source_document), ''::text) is not null)
          then 'CERTIFICADO'::text else 'PRELIMINAR'::text
        end as estatus_certificacion
   from ranked
  where rn = 1;
