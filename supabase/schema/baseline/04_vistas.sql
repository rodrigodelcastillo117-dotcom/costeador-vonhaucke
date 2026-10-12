-- ============================================================================
-- Snapshot de SÓLO LECTURA de mtuvnbgljwbsaizjjgzs, 2026-10-10.
-- Generado con SELECTs sobre pg_catalog. NO es una migración: no aplicar.
-- Regenerar al cierre de cada bloque.
-- Archivo: 04_vistas.sql
-- Contenido: Vistas y vistas materializadas del esquema public (pg_get_viewdef) con reloptions y si usan security_invoker.
-- ============================================================================

-- ---------- VISTA: public.catalogo_vigente ----------
-- reloptions: security_invoker=true
-- security_invoker: SÍ
CREATE OR REPLACE VIEW public.catalogo_vigente WITH (security_invoker=true) AS
 WITH ranked AS (
         SELECT p.id,
            p.insumo_id,
            p.precio,
            p.unidad_compra,
            p.precio_compra,
            p.factor_conversion,
            p.propiedades,
            p.proveedor,
            p.fuente,
            p.evidencia,
            p.vigente_desde,
            p.vigente_hasta,
            p.estado,
            p.creado_por,
            p.creado_en,
            p.confidence,
            p.evidence_status,
            p.approved_by,
            p.approved_at,
            p.requiere_validacion_compras,
            c.nombre,
            c.seccion,
            c.clasificacion,
            row_number() OVER (PARTITION BY p.insumo_id ORDER BY (
                CASE p.estado
                    WHEN 'aprobado'::text THEN 0
                    WHEN 'propuesto_validado'::text THEN 1
                    WHEN 'propuesto'::text THEN 2
                    ELSE 3
                END), (
                CASE p.confidence
                    WHEN 'alta'::text THEN 0
                    WHEN 'media'::text THEN 1
                    ELSE 2
                END), p.vigente_desde DESC NULLS LAST, p.id DESC) AS rn
           FROM insumo_precios p
             JOIN insumos_catalogo c ON c.id = p.insumo_id
          WHERE p.vigente_hasta IS NULL AND COALESCE(c.activo, true) = true
        )
 SELECT insumo_id,
    nombre,
    seccion,
    clasificacion,
    precio,
    unidad_compra,
    precio_compra,
    factor_conversion,
    propiedades,
    estado,
    evidence_status,
    confidence,
    requiere_validacion_compras,
    estado = 'aprobado'::text AND NOT requiere_validacion_compras AS certificable,
    fuente,
    evidencia,
    vigente_desde
   FROM ranked
  WHERE rn = 1;
COMMENT ON VIEW public.catalogo_vigente IS 'LEGACY_COMPATIBILITY_VIEW: rn=1 puede desempatar arbitrariamente. NO es autoridad de CertifiedCostSnapshot. Usar resolve_canonical_price().';

-- ---------- VISTA: public.cotizaciones_integridad ----------
-- reloptions: security_invoker=true
-- security_invoker: SÍ
CREATE OR REPLACE VIEW public.cotizaciones_integridad WITH (security_invoker=true) AS
 SELECT c.id,
    c.folio,
    c.folio_oficial,
    c.cliente,
    c.estado,
    count(*) FILTER (WHERE clasifica_partida(p.value) = 'QTY_INVALIDA'::text) AS qty_invalida,
    count(*) FILTER (WHERE clasifica_partida(p.value) = 'COSTO_DESCONOCIDO'::text) AS costo_desconocido,
    count(*) FILTER (WHERE clasifica_partida(p.value) = 'COSTO_CONOCIDO'::text) AS costo_conocido,
    count(p.value) AS renglones
   FROM cotizaciones c
     LEFT JOIN LATERAL jsonb_array_elements(c.partidas) p(value) ON true
  GROUP BY c.id;
COMMENT ON VIEW public.cotizaciones_integridad IS NULL;

-- ---------- VISTA: public.proyectos_salud ----------
-- reloptions: security_invoker=true
-- security_invoker: SÍ
CREATE OR REPLACE VIEW public.proyectos_salud WITH (security_invoker=true) AS
 SELECT id,
    nombre,
    etapa,
    vendedor_responsable,
    proxima_accion,
    fecha_proxima_accion,
    (etapa <> ALL (ARRAY['GANADA'::text, 'PERDIDA'::text, 'SUSPENDIDA'::text])) AND proxima_accion IS NULL AS activo_sin_proxima_accion
   FROM proyectos;
COMMENT ON VIEW public.proyectos_salud IS NULL;
