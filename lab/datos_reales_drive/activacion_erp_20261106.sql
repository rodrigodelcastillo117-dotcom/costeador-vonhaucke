-- ============================================================================
-- Activación de insumos ERP con precio CERTIFICADO pero activo=false.
-- Aplicada en prod (Supabase mtuvnbgljwbsaizjjgzs) el 2026-11-06 como migración
-- `activar_insumos_erp_con_precio_20261106`. Autorizada por Dirección (Rodrigo).
-- Motivo: buscar_insumos_motor/catalogo_vigente filtran activo=true; estos precios
-- reales eran invisibles para el puente ERP. 1,108 prendidos (18 compra reciente,
-- 1,090 <2024). La frescura del motor marca los viejos; nunca 'certificado' en silencio.
-- ============================================================================

-- APLICADO (para referencia / reproducción):
create table if not exists public._backup_activacion_erp_20261106 as
with precio_vig as (
  select insumo_id, max(vigente_desde) as ult_precio
  from insumo_precios where estado='aprobado' and vigente_hasta is null
  group by insumo_id
)
select c.id, c.activo as activo_antes, now() as respaldado_en
from insumos_catalogo c
join precio_vig p on p.insumo_id = c.id
where not c.activo;

update insumos_catalogo c set activo = true
where c.id in (select id from public._backup_activacion_erp_20261106) and not c.activo;

-- ============================================================================
-- REVERT (si se necesita deshacer): vuelve a apagar EXACTAMENTE los 1,108 prendidos.
-- ============================================================================
-- update insumos_catalogo set activo = false
-- where id in (select id from public._backup_activacion_erp_20261106);
