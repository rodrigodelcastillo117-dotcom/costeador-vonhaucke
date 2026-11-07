-- COBERTURA DE PRECIOS VIGENTES POR CLAVE (bloque 4, orden #4) · SOLO LECTURA.
-- Una clave es CERTIFICABLE por materiales sólo cuando el 100% de su costo de material
-- tiene precio VIGENTE del catálogo (no histórico, no requiere_validacion_compras).
-- Re-correr conforme Compras cargue precios: la cobertura sube hacia 100%.
-- Medición 2026-11-07: ENTCBCALP 58.3% · COPETE 35.3% · Horizontal 0% (sin insumoId) → ninguna certificable.
with lin as (
  select pm.clave, (l->>'insumoId') as insumo_id,
         coalesce((l->>'precioConfirmado')::numeric,0) * coalesce((l->>'cantidad')::numeric,0) as costo_linea
  from producto_maestro pm, jsonb_array_elements(pm.lineas) l
  where pm.tipo_bom = 'BOM_DETALLADO_VERIFICADO'
),
precio as (
  select insumo_id,
         max(case when precio>0 and coalesce(requiere_validacion_compras,false)=false then 1 else 0 end) as tiene_vigente
  from insumo_precios group by insumo_id
)
select l.clave,
  round(sum(l.costo_linea),2) as material_total,
  round(sum(l.costo_linea) filter (where coalesce(p.tiene_vigente,0)=1),2) as material_vigente,
  round(100.0*sum(l.costo_linea) filter (where coalesce(p.tiene_vigente,0)=1)/nullif(sum(l.costo_linea),0),1) as pct_cobertura_vigente,
  (sum(l.costo_linea) filter (where coalesce(p.tiene_vigente,0)=1) >= sum(l.costo_linea) - 0.01) as certificable_por_materiales
from lin l left join precio p on p.insumo_id = l.insumo_id
group by l.clave order by l.clave;
