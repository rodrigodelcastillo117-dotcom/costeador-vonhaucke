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

-- ROLLBACK (las vistas no permiten quitar columnas con CREATE OR REPLACE: se recrean; catalogo_motor depende del tipo):
-- RB begin;
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
-- (Quitar la columna precio_id de la vista exige DROP VIEW ... CASCADE y recrear catalogo_motor/insumo_motor:
--  no se automatiza aquí; la columna adicional es inocua para los consumidores existentes.)
