-- ============================================================================
-- Snapshot de SÓLO LECTURA de mtuvnbgljwbsaizjjgzs, 2026-10-10.
-- Generado con SELECTs sobre pg_catalog. NO es una migración: no aplicar.
-- Regenerar al cierre de cada bloque.
-- Archivo: 05_triggers.sql
-- Contenido: Triggers no internos sobre tablas de public (pg_get_triggerdef). Nota: dos triggers ejecutan funciones de private_api.
-- ============================================================================

-- public.aprendizajes . trg_aprendizajes_autor  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_aprendizajes_autor BEFORE INSERT OR UPDATE ON aprendizajes FOR EACH ROW EXECUTE FUNCTION aprendizajes_autor();

-- public.aprendizajes . trg_aprendizajes_revision_gate  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_aprendizajes_revision_gate BEFORE INSERT OR UPDATE ON aprendizajes FOR EACH ROW EXECUTE FUNCTION aprendizajes_revision_gate();

-- public.cotizaciones . trg_guard_cotizacion_estado_directo  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_guard_cotizacion_estado_directo BEFORE INSERT OR UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION private_api.guard_cotizacion_estado_directo();

-- public.cotizaciones . trg_normalize_economics_status  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_normalize_economics_status BEFORE INSERT OR UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION normalize_economics_on_cotizacion_write();

-- public.cotizaciones . trg_pin_product_versions  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_pin_product_versions BEFORE INSERT OR UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION pin_product_versions_on_cotizacion_write();

-- public.cotizaciones . trg_strip_seller_economics  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_strip_seller_economics BEFORE INSERT OR UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION strip_seller_economics_on_cotizacion_write();

-- public.cotizaciones_revisiones . trg_revisiones_autor  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_revisiones_autor BEFORE INSERT OR UPDATE ON cotizaciones_revisiones FOR EACH ROW EXECUTE FUNCTION revisiones_autor();

-- public.cotizaciones_revisiones . trg_strip_seller_economics_revision  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_strip_seller_economics_revision BEFORE INSERT OR UPDATE ON cotizaciones_revisiones FOR EACH ROW EXECUTE FUNCTION strip_seller_economics_on_revision_write();

-- public.insumo_mapeos_externos . trg_calc_mapeo_source_hash  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_calc_mapeo_source_hash BEFORE INSERT ON insumo_mapeos_externos FOR EACH ROW EXECUTE FUNCTION calc_mapeo_source_hash();

-- public.insumo_mapeos_externos . trg_guard_mapeo  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_guard_mapeo BEFORE INSERT OR UPDATE ON insumo_mapeos_externos FOR EACH ROW EXECUTE FUNCTION guard_mapeo_externo();

-- public.insumo_precios . trg_calc_source_hash  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_calc_source_hash BEFORE INSERT ON insumo_precios FOR EACH ROW EXECUTE FUNCTION calc_source_hash();

-- public.insumo_precios . trg_insumo_precios_append_only  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_insumo_precios_append_only BEFORE DELETE OR UPDATE ON insumo_precios FOR EACH ROW EXECUTE FUNCTION insumo_precios_append_only();

-- public.insumo_precios . trg_precio_no_autofirma  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_precio_no_autofirma BEFORE INSERT OR UPDATE ON insumo_precios FOR EACH ROW EXECUTE FUNCTION guard_precio_no_autofirma();

-- public.insumo_precios . trg_sync_precio_legacy  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_sync_precio_legacy BEFORE INSERT OR UPDATE ON insumo_precios FOR EACH ROW EXECUTE FUNCTION sync_precio_legacy();

-- public.producto_versiones . trg_guard_delete_producto_version  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_guard_delete_producto_version BEFORE DELETE ON producto_versiones FOR EACH ROW EXECUTE FUNCTION guard_delete_producto_version();

-- public.producto_versiones . trg_guard_producto_version  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_guard_producto_version BEFORE INSERT OR UPDATE ON producto_versiones FOR EACH ROW EXECUTE FUNCTION guard_producto_version();

-- public.producto_versiones . trg_producto_version_spatial_spec  (tgenabled=O; O=habilitado origin/local, D=deshabilitado, R=replica, A=always)
CREATE TRIGGER trg_producto_version_spatial_spec BEFORE INSERT ON producto_versiones FOR EACH ROW EXECUTE FUNCTION private_api.canonicalizar_spatial_spec_producto_version();
