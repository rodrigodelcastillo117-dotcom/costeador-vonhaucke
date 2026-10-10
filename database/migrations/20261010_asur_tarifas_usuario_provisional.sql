-- ASUR 2026-10-10. Explicitly authorized user ESTIMATE, NOT an ERP purchase.
-- Idempotent and additive; never marks as approved or claims purchase evidence.
BEGIN;
SELECT pg_advisory_xact_lock(20261010, 3800);
WITH tarifas(insumo_id, precio, unidad) AS (
 VALUES ('solid-surface', 3450::numeric, 'm2'),
        ('solid-surface-azul', 3800::numeric, 'm2'),
        ('adhesivo-solid-surface', 1050::numeric, 'pza')
), elegibles AS (
 SELECT t.* FROM tarifas t
 JOIN public.insumos_catalogo c ON c.id=t.insumo_id AND c.activo
 WHERE c.unidad_costeo=t.unidad AND t.precio > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.insumo_precios p
     WHERE p.insumo_id=t.insumo_id AND p.source_system='user_authorized_estimate'
       AND p.source_document='ASUR_tarifa_referencia_20261010'
       AND p.vigente_hasta IS NULL
   )
)
INSERT INTO public.insumo_precios (
 insumo_id,precio,unidad_compra,precio_compra,factor_conversion,
 fuente,evidencia,estado,confidence,evidence_status,
 requiere_validacion_compras,contract_status,creado_por,
 vigente_desde,source_price,source_currency,source_unit,source_units_per_cost_unit,
 cost_unit,cost_unit_price_mxn,source_system,source_document,source_record_id,source_hash
)
SELECT t.insumo_id,t.precio,t.unidad,t.precio,1,
 'Tarifa de referencia ASUR autorizada por usuario (10/oct/2026); NO factura ni última compra',
 'Importe de mercado que el usuario autorizó para estimación. Sin orden de compra del proveedor.',
 'propuesto','baja','sin_evidencia',
 true,'LEGACY_UNMIGRATED','user_authorized_assumption_20261010',
 DATE '2026-10-10',t.precio,'MXN',t.unidad,1,t.unidad,t.precio,
 'user_authorized_estimate','ASUR_tarifa_referencia_20261010',t.insumo_id,
 md5('ASUR_tarifa_referencia_20261010:'||t.insumo_id||':'||t.precio::text)
FROM elegibles t;
COMMIT;
-- For audit after migration:
-- select insumo_id,precio,estado,evidence_status,source_system,source_document
-- from public.insumo_precios where source_document='ASUR_tarifa_referencia_20261010';
