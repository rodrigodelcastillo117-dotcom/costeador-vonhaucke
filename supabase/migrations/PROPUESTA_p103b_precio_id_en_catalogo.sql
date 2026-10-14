-- ============================================================================
--  PROPUESTA · P1-03b (reauditoría externa 14-oct) · el catálogo ENTREGA el precio_id exacto que eligió.
--  ⚠️ PROPUESTA, NO MIGRACIÓN: no aplicar sin autorización expresa de Dirección.
--
--  Antes: la vista catalogo_vigente elegía UNA fila de insumo_precios por insumo pero no exponía su id; la Edge, para
--  saber qué precio aprobar/verificar, re-elegía la fila en JavaScript con el MISMO orden. Hoy coincide (verificado),
--  pero son dos copias de la regla: si alguien cambia la vista y no el JS, el motor usa una fila y la aprobación mira
--  otra. Ahora la vista agrega la columna `precio_id` (al FINAL: CREATE OR REPLACE VIEW sólo permite agregar) y
--  insumo_motor la entrega como `precioId`. La Edge usa ese id; la re-elección en JS queda sólo como respaldo marcado.
--  Sin cambios de datos, de precios ni de permisos. El cuerpo de la vista es el de producción (baseline) + 1 columna.
-- ============================================================================
begin;

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
    vigente_desde,
    id AS precio_id
   FROM ranked
  WHERE rn = 1;

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
      'precioId', v.precio_id,
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
        'requiere_validacion_compras', coalesce(v.requiere_validacion_compras, false))
    );
$$;

commit;

-- ROLLBACK COMPLETO (líneas `-- RB `; reauditoría GO/NO-GO 14-oct): devuelve la vista y insumo_motor a producción.
-- Antes sólo restauraba insumo_motor y dejaba la columna precio_id en la vista ("no se automatiza"): no era un rollback
-- completo. Una vista no pierde columnas con CREATE OR REPLACE, así que se borra y se recrea con el cuerpo de producción
-- (baseline/04_vistas.sql), su comentario y su ACL. SIN CASCADE: en producción el único dependiente de catalogo_vigente
-- es private_api.insumo_motor (pg_depend, medido 14-oct); si aparece otro, el DROP falla y no se revierte nada.
-- ACL de producción (14-oct): postgres=arwdDxtm, authenticated=awdDxtm (SIN select), service_role=arwdDxtm.
-- Probado en supabase/tests/cadenaVentanaRollback.test.js (cadena completa, comparación del catálogo de la base).
-- RB begin;
-- RB drop function private_api.insumo_motor(public.insumos_catalogo, public.catalogo_vigente);
-- RB drop view public.catalogo_vigente;
-- RB CREATE VIEW public.catalogo_vigente WITH (security_invoker=true) AS
-- RB  WITH ranked AS (
-- RB          SELECT p.id,
-- RB             p.insumo_id,
-- RB             p.precio,
-- RB             p.unidad_compra,
-- RB             p.precio_compra,
-- RB             p.factor_conversion,
-- RB             p.propiedades,
-- RB             p.proveedor,
-- RB             p.fuente,
-- RB             p.evidencia,
-- RB             p.vigente_desde,
-- RB             p.vigente_hasta,
-- RB             p.estado,
-- RB             p.creado_por,
-- RB             p.creado_en,
-- RB             p.confidence,
-- RB             p.evidence_status,
-- RB             p.approved_by,
-- RB             p.approved_at,
-- RB             p.requiere_validacion_compras,
-- RB             c.nombre,
-- RB             c.seccion,
-- RB             c.clasificacion,
-- RB             row_number() OVER (PARTITION BY p.insumo_id ORDER BY (
-- RB                 CASE p.estado
-- RB                     WHEN 'aprobado'::text THEN 0
-- RB                     WHEN 'propuesto_validado'::text THEN 1
-- RB                     WHEN 'propuesto'::text THEN 2
-- RB                     ELSE 3
-- RB                 END), (
-- RB                 CASE p.confidence
-- RB                     WHEN 'alta'::text THEN 0
-- RB                     WHEN 'media'::text THEN 1
-- RB                     ELSE 2
-- RB                 END), p.vigente_desde DESC NULLS LAST, p.id DESC) AS rn
-- RB            FROM insumo_precios p
-- RB              JOIN insumos_catalogo c ON c.id = p.insumo_id
-- RB           WHERE p.vigente_hasta IS NULL AND COALESCE(c.activo, true) = true
-- RB         )
-- RB  SELECT insumo_id,
-- RB     nombre,
-- RB     seccion,
-- RB     clasificacion,
-- RB     precio,
-- RB     unidad_compra,
-- RB     precio_compra,
-- RB     factor_conversion,
-- RB     propiedades,
-- RB     estado,
-- RB     evidence_status,
-- RB     confidence,
-- RB     requiere_validacion_compras,
-- RB     estado = 'aprobado'::text AND NOT requiere_validacion_compras AS certificable,
-- RB     fuente,
-- RB     evidencia,
-- RB     vigente_desde
-- RB    FROM ranked
-- RB   WHERE rn = 1;;
-- RB COMMENT ON VIEW public.catalogo_vigente IS 'LEGACY_COMPATIBILITY_VIEW: rn=1 puede desempatar arbitrariamente. NO es autoridad de CertifiedCostSnapshot. Usar resolve_canonical_price().';
-- RB revoke all on table public.catalogo_vigente from public, anon, authenticated, service_role;
-- RB grant all on table public.catalogo_vigente to service_role;
-- RB grant all on table public.catalogo_vigente to authenticated;
-- RB revoke select on table public.catalogo_vigente from authenticated;
-- RB create or replace function private_api.insumo_motor(c public.insumos_catalogo, v public.catalogo_vigente)
-- RB returns jsonb
-- RB language sql
-- RB immutable
-- RB set search_path to 'public'
-- RB as $$
-- RB   select (coalesce(c.atributos, '{}'::jsonb) - 'articulo')
-- RB     || jsonb_build_object(
-- RB       'id', c.id,
-- RB       'nombre', c.nombre,
-- RB       'seccion', coalesce(c.seccion, 'erp-otros'),
-- RB       'unidad', c.unidad_costeo,
-- RB       'precio', v.precio,
-- RB       'precioBase', v.precio,
-- RB       'moneda', 'MXN',
-- RB       'clase', coalesce(c.atributos->>'clase', 'directa'),
-- RB       'fraccion', coalesce((c.atributos->>'fraccion')::boolean, false),
-- RB       'mermaCorte', coalesce((c.atributos->>'mermaCorte')::numeric, 0),
-- RB       'veta', coalesce((c.atributos->>'veta')::boolean, false),
-- RB       'inventario', coalesce((c.atributos->>'inventario')::boolean, false),
-- RB       'formato', c.atributos->'formato',
-- RB       'actualizado', v.vigente_desde,
-- RB       'clasificacion', c.clasificacion,
-- RB       'familia', c.familia,
-- RB       'proveedor', '',
-- RB       'evidencia', jsonb_build_object(
-- RB         'estado', v.estado, 'certificable', coalesce(v.certificable, false),
-- RB         'confidence', v.confidence, 'evidence_status', v.evidence_status, 'fuente', v.fuente,
-- RB         'requiere_validacion_compras', coalesce(v.requiere_validacion_compras, false))
-- RB     );
-- RB $$;
-- RB commit;
