-- ============================================================================
--  PROPUESTA · VH-147 · política ERP_ULTIMA_COMPRA_V1: validez histórica ≠ actualidad para costo certificado.
--  ⚠️ NO APLICAR sin autorización de Dirección. Prefijo PROPUESTA_ para que `supabase db push` no la tome.
--  Probada en base aislada (PGlite) por `supabase/tests/erpPolitica.test.js`; resultados en
--  `docs/auditoria/ERP_POLITICA_PRUEBAS.md`.
--
--  DECISIÓN 1 de Dirección (2026-10-13), que esta migración codifica:
--   · VALIDEZ (histórica): un precio ERP con documento (DATA_TRUTH_V1 + source_document + source_record_id)
--     NUNCA caduca ni se vuelve "inventado". Se sigue devolviendo con su `precio` y su fecha de última
--     compra para costear en PRELIMINAR.
--   · ACTUALIDAD (para costo CERTIFICADO): referencia 24 meses desde la última compra, salvo que exista una
--     validación comercial documentada más reciente (estado='aprobado' con approved_at/evidencia). Un precio
--     antiguo puede usarse en PRELIMINAR con su fecha visible y aviso de antigüedad; no se certifica como
--     costo de reposición vigente sin evidencia adicional.
--
--  QUÉ CAMBIA (sólo lectura/derivación; cero UPDATE de datos):
--   1. private_api.ventana_actualidad_meses() → 24 (parámetro único; cambiarlo aquí cambia la política).
--   2. Vista public.catalogo_vigente: MISMA definición de producción (baseline 04_vistas.sql) + columnas
--      AÑADIDAS al final: antiguedad_meses, actualidad, validez, motivo_no_certificable, ventana_actualidad_meses.
--      `certificable` pasa a ser:
--        (estado='aprobado' AND NOT requiere_validacion_compras)                      -- validación comercial documentada
--        OR (validez='DOCUMENTADO' AND actualidad='VIGENTE' AND precio>0 AND activo    -- compra documentada reciente
--            AND NOT requiere_validacion_compras AND moneda resuelta (MXN o FX completo) AND cost_unit=unidad_costeo)
--      No se cambia ningún `estado`; ninguna fila deja de salir en la vista.
--   3. private_api.insumo_motor(c, v): la misma salida de VH-088 + evidencia.{vigente_desde, antiguedad_meses,
--      actualidad, validez, motivo_no_certificable}. catalogo_motor/buscar_insumos_motor no cambian (la llaman).
--   4. private_api.resolver_costo_insumo(id): misma forma + las mismas 5 claves; estado_certificacion
--      'CERTIFICADO' cuando certificable (ya no exige estado='aprobado').
--  Rollback completo al final (comentado).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Parámetro de la política. IMMUTABLE: Postgres lo pliega en el plan de la vista.
-- ---------------------------------------------------------------------------
create or replace function private_api.ventana_actualidad_meses()
returns integer
language sql
immutable
as $$ select 24 $$;
comment on function private_api.ventana_actualidad_meses() is
  'VH-147 · ERP_ULTIMA_COMPRA_V1: meses desde la última compra dentro de los cuales un precio DOCUMENTADO cuenta como VIGENTE para costo certificado. Dirección 2026-10-13: 24.';

-- La vista es security_invoker: quien la lee por REST (costear-servidor, rol service_role) debe poder resolver la función.
-- Sólo service_role (servidor). authenticated no tiene SELECT sobre la vista (06_grants) y no lo necesita.
grant usage on schema private_api to service_role;
grant execute on function private_api.ventana_actualidad_meses() to service_role;
revoke execute on function private_api.ventana_actualidad_meses() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Vista. Bloque `ranked` = producción (04_vistas.sql) + columnas de procedencia leídas (no alteran el ranking).
--    CREATE OR REPLACE conserva grants y sólo AÑADE columnas al final (regla de Postgres).
-- ---------------------------------------------------------------------------
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
            -- VH-147: procedencia y moneda (sólo lectura; el ranking de abajo es el de producción)
            c.activo,
            c.unidad_costeo,
            p.contract_status,
            p.source_system,
            p.source_document,
            p.source_record_id,
            p.source_currency,
            p.fx_rate,
            p.fx_date,
            p.fx_source,
            p.cost_unit,
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
        ), politica AS (
         SELECT r.*,
            private_api.ventana_actualidad_meses() AS ventana_actualidad_meses,
            -- meses completos desde la última compra (NULL si no hay fecha)
            CASE WHEN r.vigente_desde IS NULL THEN NULL
                 ELSE (EXTRACT(year FROM age(current_date, r.vigente_desde)) * 12
                     + EXTRACT(month FROM age(current_date, r.vigente_desde)))::integer END AS antiguedad_meses,
            -- ACTUALIDAD: dentro de la ventana (inclusive) = VIGENTE; fuera o sin fecha = ANTIGUO
            CASE WHEN r.vigente_desde IS NOT NULL
                      AND r.vigente_desde >= (current_date - make_interval(months => private_api.ventana_actualidad_meses()))
                 THEN 'VIGENTE' ELSE 'ANTIGUO' END AS actualidad,
            -- VALIDEZ (histórica): DOCUMENTADO nunca caduca
            CASE WHEN r.contract_status = 'DATA_TRUTH_V1'
                      AND NULLIF(btrim(r.source_document), '') IS NOT NULL
                      AND NULLIF(btrim(r.source_record_id), '') IS NOT NULL THEN 'DOCUMENTADO'
                 WHEN r.evidence_status IN ('documentada', 'referenciada', 'concordante')
                      OR NULLIF(btrim(r.evidencia), '') IS NOT NULL
                      OR NULLIF(btrim(r.fuente), '') IS NOT NULL THEN 'REFERENCIADO'
                 ELSE 'SIN_EVIDENCIA' END AS validez,
            -- MXN, o FX completo (tasa > 0, fecha y fuente). LEGACY sin moneda declarada = MXN por convención histórica.
            (r.source_currency IS NULL OR r.source_currency = 'MXN'
              OR (r.fx_rate IS NOT NULL AND r.fx_rate > 0 AND r.fx_date IS NOT NULL AND NULLIF(btrim(r.fx_source), '') IS NOT NULL)) AS moneda_resuelta
           FROM ranked r
          WHERE r.rn = 1
        ), evaluado AS (
         SELECT q.*,
            ((q.estado = 'aprobado'::text AND NOT q.requiere_validacion_compras)
             OR (q.validez = 'DOCUMENTADO' AND q.actualidad = 'VIGENTE'
                 AND COALESCE(q.precio, 0) > 0 AND COALESCE(q.activo, true)
                 AND NOT q.requiere_validacion_compras AND q.moneda_resuelta
                 AND q.cost_unit IS NOT NULL AND q.cost_unit = q.unidad_costeo)) AS certificable
           FROM politica q
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
    certificable,
    fuente,
    evidencia,
    vigente_desde,
    -- ---- VH-147: columnas añadidas (al final, para CREATE OR REPLACE) ----
    antiguedad_meses,
    actualidad,
    validez,
    CASE
        WHEN certificable THEN NULL
        WHEN validez <> 'DOCUMENTADO' THEN
            'sin evidencia documental (' || COALESCE(contract_status, 'LEGACY_UNMIGRATED')
            || COALESCE(', ' || evidence_status, '') || '): certifica sólo con aprobación de Dirección o carga DATA_TRUTH_V1 con documento'
        WHEN requiere_validacion_compras THEN 'requiere validación de Compras'
        WHEN actualidad = 'ANTIGUO' THEN
            'última compra ' || COALESCE(vigente_desde::text, 'sin fecha') || ' (' || COALESCE(antiguedad_meses::text, '?')
            || ' meses): fuera de la ventana de actualidad de ' || ventana_actualidad_meses
            || ' meses; usable como PRELIMINAR con fecha visible, no certifica costo de reposición sin validación comercial'
        WHEN COALESCE(precio, 0) <= 0 THEN 'precio no positivo'
        WHEN NOT moneda_resuelta THEN 'moneda ' || COALESCE(source_currency, '?') || ' sin tipo de cambio documentado (fx_rate/fx_date/fx_source)'
        WHEN cost_unit IS NULL OR cost_unit <> unidad_costeo THEN
            'unidad de costo ' || COALESCE(cost_unit, '?') || ' distinta de la unidad de costeo ' || COALESCE(unidad_costeo, '?')
        ELSE 'no certificable'
    END AS motivo_no_certificable,
    ventana_actualidad_meses
   FROM evaluado;
COMMENT ON VIEW public.catalogo_vigente IS 'LEGACY_COMPATIBILITY_VIEW: rn=1 puede desempatar arbitrariamente. NO es autoridad de CertifiedCostSnapshot. Usar resolve_canonical_price(). VH-147: certificable = aprobado sin validación pendiente OR (DOCUMENTADO y VIGENTE ≤ ventana_actualidad_meses); columnas antiguedad_meses/actualidad/validez/motivo_no_certificable.';

-- ---------------------------------------------------------------------------
-- 3) insumo_motor (VH-088) + evidencia extendida. Misma forma de salida; sólo se AÑADEN claves a `evidencia`.
-- ---------------------------------------------------------------------------
create or replace function private_api.insumo_motor(c public.insumos_catalogo, v public.catalogo_vigente)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select (coalesce(c.atributos, '{}'::jsonb) - 'articulo')
    || jsonb_build_object(
      'id', c.id,
      'nombre', c.nombre,
      'seccion', coalesce(c.seccion, 'erp-otros'),
      'unidad', c.unidad_costeo,
      'precio', v.precio,
      'precioBase', v.precio,
      'moneda', 'MXN',
      'clase', coalesce(c.atributos->>'clase', 'directa'),
      'fraccion', coalesce((c.atributos->>'fraccion')::boolean, false),
      'mermaCorte', coalesce((c.atributos->>'mermaCorte')::numeric, 0),
      'veta', coalesce((c.atributos->>'veta')::boolean, false),
      'inventario', coalesce((c.atributos->>'inventario')::boolean, false),
      'formato', c.atributos->'formato',
      'actualizado', v.vigente_desde,
      'clasificacion', c.clasificacion,
      'familia', c.familia,
      'proveedor', '',
      'evidencia', jsonb_build_object(
        'estado', v.estado, 'certificable', coalesce(v.certificable, false),
        'confidence', v.confidence, 'evidence_status', v.evidence_status, 'fuente', v.fuente,
        'requiere_validacion_compras', coalesce(v.requiere_validacion_compras, false),
        -- VH-147
        'vigente_desde', v.vigente_desde,
        'antiguedad_meses', v.antiguedad_meses,
        'actualidad', v.actualidad,
        'validez', v.validez,
        'motivo_no_certificable', v.motivo_no_certificable)
    );
$$;

-- ---------------------------------------------------------------------------
-- 4) resolver_costo_insumo (baseline 08_private_api.sql) + las mismas claves.
--    estado_certificacion: CERTIFICADO cuando la vista dice certificable (política), PRELIMINAR si no y hay precio.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.resolver_costo_insumo(p_insumo_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
  c record;
  cfg jsonb;
BEGIN
  -- Guardia seller-safe: el costo NO se entrega a quien no debe verlo.
  IF NOT public.puede_editar_config() THEN
    RAISE EXCEPTION 'no autorizado: el costo de insumos es economía interna (dirección/diseño)';
  END IF;

  -- 1) Catálogo vigente (fuente con estados de certificación).
  SELECT * INTO c FROM public.catalogo_vigente WHERE insumo_id = p_insumo_id LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'insumo_id', c.insumo_id,
      'precio', c.precio,
      'moneda', COALESCE(c.propiedades->>'moneda', 'MXN'),
      'unidad', c.unidad_compra,
      'fuente', COALESCE(c.fuente, 'catalogo_vigente'),
      'evidencia', c.evidencia,
      'vigencia', c.vigente_desde,
      'certificable', c.certificable,
      'requiere_validacion', COALESCE(c.requiere_validacion_compras, false),
      'estado_certificacion',
        CASE
          WHEN c.certificable THEN 'CERTIFICADO'
          WHEN c.estado IN ('aprobado', 'propuesto_validado') THEN 'PRELIMINAR'
          WHEN c.estado = 'propuesto' THEN 'PROPUESTO'
          ELSE 'DESCONOCIDO'
        END,
      -- VH-147
      'vigente_desde', c.vigente_desde,
      'antiguedad_meses', c.antiguedad_meses,
      'actualidad', c.actualidad,
      'validez', c.validez,
      'motivo_no_certificable', c.motivo_no_certificable
    );
  END IF;

  -- 2) Config legado (lo que el motor LIVE usa hoy). Honesto: no certificado.
  SELECT datos->'insumos'->p_insumo_id INTO cfg FROM public.config WHERE id = 'vonhaucke';
  IF cfg IS NOT NULL AND cfg <> 'null'::jsonb THEN
    RETURN jsonb_build_object(
      'insumo_id', p_insumo_id,
      'precio', COALESCE((cfg->>'precio')::numeric, (cfg->>'precioBase')::numeric),
      'moneda', COALESCE(cfg->>'moneda', 'MXN'),
      'unidad', cfg->>'unidad',
      'fuente', 'config_legado',
      'evidencia', NULL,
      'vigencia', NULL,
      'certificable', false,
      'requiere_validacion', true,
      'estado_certificacion', 'CONFIG_LEGADO',
      'vigente_desde', NULL, 'antiguedad_meses', NULL, 'actualidad', NULL, 'validez', 'SIN_EVIDENCIA',
      'motivo_no_certificable', 'config legado sin documento'
    );
  END IF;

  -- 3) Desconocido: NO se inventa precio.
  RETURN jsonb_build_object(
    'insumo_id', p_insumo_id, 'precio', NULL, 'moneda', NULL, 'unidad', NULL,
    'fuente', NULL, 'evidencia', NULL, 'vigencia', NULL,
    'certificable', false, 'requiere_validacion', true,
    'estado_certificacion', 'DESCONOCIDO',
    'vigente_desde', NULL, 'antiguedad_meses', NULL, 'actualidad', NULL, 'validez', 'SIN_EVIDENCIA',
    'motivo_no_certificable', 'sin precio en catálogo ni config'
  );
END;
$function$;

-- Verificación sugerida tras aplicar (sólo lectura):
--   select certificable, actualidad, validez, count(*) from public.catalogo_vigente
--    where clasificacion = 'erp' group by 1, 2, 3 order by 1 desc, 2, 3;
--   Esperado al 2026-10-13 (§ 4 del doc): certificables ERP ≈ 1 753 aprobados + propuesto_validado con compra ≤ 24 m (0 hoy,
--   porque el cargador aprobó todo lo ≤ 24 m) → el total certificable NO cambia hoy; lo que cambia es que los 8 213
--   antiguos salen con motivo y antigüedad, y que una carga futura ≤ 24 m certifica sin pasar por aprobar_precio.
commit;

-- ============================================================================
--  ROLLBACK VH-147. Bloque comentado: quitar el prefijo "-- " de cada línea entre los marcadores y ejecutar aparte
--  (erpPolitica.test.js lo hace así y verifica que la vista vuelve a las 17 columnas de producción).
--  Un CREATE OR REPLACE VIEW no puede quitar columnas: hay que soltar insumo_motor (depende del tipo de la
--  vista), soltar la vista, recrear la de producción con sus grants y recrear las funciones de VH-088/baseline.
--  El `revoke usage on schema private_api from service_role` queda fuera a propósito: no se sabe si el rol ya
--  tenía USAGE antes (verificar con has_schema_privilege antes de revocar).
-- ============================================================================
-- >>> ROLLBACK VH-147
-- begin;
-- drop function if exists private_api.insumo_motor(public.insumos_catalogo, public.catalogo_vigente);
-- drop view if exists public.catalogo_vigente;
-- CREATE OR REPLACE VIEW public.catalogo_vigente WITH (security_invoker=true) AS
--  WITH ranked AS (
--          SELECT p.id, p.insumo_id, p.precio, p.unidad_compra, p.precio_compra, p.factor_conversion, p.propiedades,
--             p.proveedor, p.fuente, p.evidencia, p.vigente_desde, p.vigente_hasta, p.estado, p.creado_por, p.creado_en,
--             p.confidence, p.evidence_status, p.approved_by, p.approved_at, p.requiere_validacion_compras,
--             c.nombre, c.seccion, c.clasificacion,
--             row_number() OVER (PARTITION BY p.insumo_id ORDER BY (
--                 CASE p.estado WHEN 'aprobado'::text THEN 0 WHEN 'propuesto_validado'::text THEN 1 WHEN 'propuesto'::text THEN 2 ELSE 3 END), (
--                 CASE p.confidence WHEN 'alta'::text THEN 0 WHEN 'media'::text THEN 1 ELSE 2 END), p.vigente_desde DESC NULLS LAST, p.id DESC) AS rn
--            FROM insumo_precios p
--              JOIN insumos_catalogo c ON c.id = p.insumo_id
--           WHERE p.vigente_hasta IS NULL AND COALESCE(c.activo, true) = true
--         )
--  SELECT insumo_id, nombre, seccion, clasificacion, precio, unidad_compra, precio_compra, factor_conversion, propiedades,
--     estado, evidence_status, confidence, requiere_validacion_compras,
--     estado = 'aprobado'::text AND NOT requiere_validacion_compras AS certificable,
--     fuente, evidencia, vigente_desde
--    FROM ranked
--   WHERE rn = 1;
-- COMMENT ON VIEW public.catalogo_vigente IS 'LEGACY_COMPATIBILITY_VIEW: rn=1 puede desempatar arbitrariamente. NO es autoridad de CertifiedCostSnapshot. Usar resolve_canonical_price().';
-- GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.catalogo_vigente TO authenticated;
-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.catalogo_vigente TO service_role;
-- create or replace function private_api.insumo_motor(c public.insumos_catalogo, v public.catalogo_vigente)
-- returns jsonb language sql immutable set search_path to 'public' as $$
--   select (coalesce(c.atributos, '{}'::jsonb) - 'articulo')
--     || jsonb_build_object(
--       'id', c.id, 'nombre', c.nombre, 'seccion', coalesce(c.seccion, 'erp-otros'), 'unidad', c.unidad_costeo,
--       'precio', v.precio, 'precioBase', v.precio, 'moneda', 'MXN',
--       'clase', coalesce(c.atributos->>'clase', 'directa'),
--       'fraccion', coalesce((c.atributos->>'fraccion')::boolean, false),
--       'mermaCorte', coalesce((c.atributos->>'mermaCorte')::numeric, 0),
--       'veta', coalesce((c.atributos->>'veta')::boolean, false),
--       'inventario', coalesce((c.atributos->>'inventario')::boolean, false),
--       'formato', c.atributos->'formato', 'actualizado', v.vigente_desde,
--       'clasificacion', c.clasificacion, 'familia', c.familia, 'proveedor', '',
--       'evidencia', jsonb_build_object(
--         'estado', v.estado, 'certificable', coalesce(v.certificable, false),
--         'confidence', v.confidence, 'evidence_status', v.evidence_status, 'fuente', v.fuente,
--         'requiere_validacion_compras', coalesce(v.requiere_validacion_compras, false))
--     );
-- $$;
-- CREATE OR REPLACE FUNCTION private_api.resolver_costo_insumo(p_insumo_id text)
--  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- DECLARE v jsonb; c record; cfg jsonb;
-- BEGIN
--   IF NOT public.puede_editar_config() THEN
--     RAISE EXCEPTION 'no autorizado: el costo de insumos es economía interna (dirección/diseño)';
--   END IF;
--   SELECT * INTO c FROM public.catalogo_vigente WHERE insumo_id = p_insumo_id LIMIT 1;
--   IF FOUND THEN
--     RETURN jsonb_build_object(
--       'insumo_id', c.insumo_id, 'precio', c.precio, 'moneda', COALESCE(c.propiedades->>'moneda', 'MXN'),
--       'unidad', c.unidad_compra, 'fuente', COALESCE(c.fuente, 'catalogo_vigente'), 'evidencia', c.evidencia,
--       'vigencia', c.vigente_desde, 'certificable', c.certificable,
--       'requiere_validacion', COALESCE(c.requiere_validacion_compras, false),
--       'estado_certificacion',
--         CASE WHEN c.estado = 'aprobado' AND c.certificable THEN 'CERTIFICADO'
--              WHEN c.estado = 'propuesto_validado' THEN 'PRELIMINAR'
--              WHEN c.estado = 'propuesto' THEN 'PROPUESTO' ELSE 'DESCONOCIDO' END);
--   END IF;
--   SELECT datos->'insumos'->p_insumo_id INTO cfg FROM public.config WHERE id = 'vonhaucke';
--   IF cfg IS NOT NULL AND cfg <> 'null'::jsonb THEN
--     RETURN jsonb_build_object(
--       'insumo_id', p_insumo_id, 'precio', COALESCE((cfg->>'precio')::numeric, (cfg->>'precioBase')::numeric),
--       'moneda', COALESCE(cfg->>'moneda', 'MXN'), 'unidad', cfg->>'unidad', 'fuente', 'config_legado',
--       'evidencia', NULL, 'vigencia', NULL, 'certificable', false, 'requiere_validacion', true,
--       'estado_certificacion', 'CONFIG_LEGADO');
--   END IF;
--   RETURN jsonb_build_object(
--     'insumo_id', p_insumo_id, 'precio', NULL, 'moneda', NULL, 'unidad', NULL,
--     'fuente', NULL, 'evidencia', NULL, 'vigencia', NULL,
--     'certificable', false, 'requiere_validacion', true, 'estado_certificacion', 'DESCONOCIDO');
-- END;
-- $function$;
-- drop function if exists private_api.ventana_actualidad_meses();
-- commit;
-- <<< FIN ROLLBACK VH-147
