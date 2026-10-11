-- ============================================================================
-- Snapshot de SÓLO LECTURA de mtuvnbgljwbsaizjjgzs, 2026-10-10.
-- Generado con SELECTs sobre pg_catalog. NO es una migración: no aplicar.
-- Regenerar al cierre de cada bloque.
-- Archivo: 06_grants.sql
-- Contenido: Privilegios sobre tablas (information_schema.role_table_grants) y funciones (routine_privileges) para anon, authenticated, service_role y PUBLIC; más pg_default_acl.
-- ============================================================================

-- ===== 1. PRIVILEGIOS SOBRE TABLAS Y VISTAS (roles anon, authenticated, service_role, PUBLIC) =====
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_eventos TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.aprendizajes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.aprendizajes TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.aprobaciones TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.aprobaciones TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.auth_recovery_once TO service_role;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.catalogo_vigente TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.catalogo_vigente TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.clientes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.clientes TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.config TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.config TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.confirmaciones TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.confirmaciones TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.contactos TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.contactos TO service_role;
GRANT DELETE, INSERT, UPDATE ON TABLE public.cotizaciones TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cotizaciones TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cotizaciones_backup_20261002 TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cotizaciones_integridad TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cotizaciones_integridad TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cotizaciones_revisiones TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cotizaciones_revisiones TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cotizaciones_revisiones_backup_20261002 TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.direccion TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.direccion TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.escenarios TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.escenarios TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.expediente_revisiones TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.expediente_revisiones TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.expedientes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.expedientes TO service_role;
GRANT INSERT, SELECT, UPDATE ON TABLE public.insumo_mapeos_externos TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.insumo_mapeos_externos TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.insumo_precios TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.insumo_precios TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.insumos_catalogo TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.insumos_catalogo TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.lista_precio_items TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.lista_precio_items TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.listas_precio TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.listas_precio TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.permitidos TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.permitidos TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.producto_version_economia TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.producto_version_economia TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.producto_versiones TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.producto_versiones TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.productos TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.productos TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.proyecto_actividades TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.proyecto_actividades TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.proyectos TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.proyectos TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.proyectos_salud TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.proyectos_salud TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.reglas TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.reglas TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.reglas_comerciales TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.reglas_comerciales TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.render_eventos TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.renders TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.renders TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.shadow_costeo TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.shadow_costeo TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.variantes_producto TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.variantes_producto TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.voni_council_events TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.voni_council_events TO service_role;

-- ===== 2. PRIVILEGIOS SOBRE FUNCIONES (roles anon, authenticated, service_role, PUBLIC) =====
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.aprendizajes_autor() TO service_role;
GRANT EXECUTE ON FUNCTION public.aprendizajes_revision_gate() TO service_role;
GRANT EXECUTE ON FUNCTION public.aprobar_mapeo_externo(p_mapeo_id bigint, p_nota text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_mapeo_externo(p_mapeo_id bigint, p_nota text) TO service_role;
GRANT EXECUTE ON FUNCTION public.aprobar_precio(p_precio_id bigint, p_nota text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_precio(p_precio_id bigint, p_nota text) TO service_role;
GRANT EXECUTE ON FUNCTION public.asignar_folio_oficial(p_cotizacion_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asignar_folio_oficial(p_cotizacion_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.bom_hash_de_revision(p_rev_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.calc_mapeo_source_hash() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_mapeo_source_hash() TO service_role;
GRANT EXECUTE ON FUNCTION public.calc_source_hash() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_source_hash() TO service_role;
GRANT EXECUTE ON FUNCTION public.cerrar_vigencia_precio(p_insumo_id text, p_fecha date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_vigencia_precio(p_insumo_id text, p_fecha date) TO service_role;
GRANT EXECUTE ON FUNCTION public.certificar_version(p_pv_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.certificar_version(p_pv_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.clasifica_partida(p jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clasifica_partida(p jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cocrear_seguro(p_expediente_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cocrear_seguro(p_expediente_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.config_para_rol() TO authenticated;
GRANT EXECUTE ON FUNCTION public.config_para_rol() TO service_role;
GRANT EXECUTE ON FUNCTION public.config_sanitizada(datos jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.config_sanitizada(datos jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cotizacion_emitible(p_cotizacion_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cotizacion_emitible(p_cotizacion_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.cotizacion_revisiones_seguras(p_cotizacion_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cotizacion_revisiones_seguras(p_cotizacion_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.cotizacion_segura(p_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cotizacion_segura(p_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.cotizaciones_mias(p_limite integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cotizaciones_mias(p_limite integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cotizaciones_seguras() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cotizaciones_seguras() TO service_role;
GRANT EXECUTE ON FUNCTION public.crear_cotizacion_segura(p_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_cotizacion_segura(p_payload jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.emitir_revision(p_cotizacion_id bigint, p_snapshot jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_revision(p_cotizacion_id bigint, p_snapshot jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.emitir_revision_v2(p_cotizacion_id bigint, p_snapshot jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_revision_v2(p_cotizacion_id bigint, p_snapshot jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.es_direccion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_direccion() TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_delete_producto_version() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_delete_producto_version() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_mapeo_externo() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_mapeo_externo() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_precio_no_autofirma() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_precio_no_autofirma() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_producto_version() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_producto_version() TO service_role;
GRANT EXECUTE ON FUNCTION public.guardar_cocrear_seguro(p_expediente_id bigint, p_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_cocrear_seguro(p_expediente_id bigint, p_payload jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hash_revision(p_snapshot jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_revision(p_snapshot jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.insumo_precios_append_only() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.insumo_precios_append_only() TO service_role;
GRANT EXECUTE ON FUNCTION public.jsonb_sin_economia(data jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jsonb_sin_economia(data jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.marcar_renders_stale_producto(p_producto_id bigint, p_except_version_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_renders_stale_producto(p_producto_id bigint, p_except_version_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.normalizar_cost_status_partidas(p_partidas jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalizar_cost_status_partidas(p_partidas jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_economics_on_cotizacion_write() TO service_role;
GRANT EXECUTE ON FUNCTION public.partidas_vendedor(p_partidas jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partidas_vendedor(p_partidas jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_product_versions_in_partidas(p_partidas jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_product_versions_on_cotizacion_write() TO service_role;
GRANT EXECUTE ON FUNCTION public.producto_cotizable(p_producto_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.producto_cotizable(p_producto_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.puede_certificar_costo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_certificar_costo() TO service_role;
GRANT EXECUTE ON FUNCTION public.puede_editar_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_editar_config() TO service_role;
GRANT EXECUTE ON FUNCTION public.puede_entrar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_entrar() TO service_role;
GRANT EXECUTE ON FUNCTION public.puede_ver_economia() TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_economia() TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_producto_desde_expediente(p_expediente_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_producto_desde_expediente(p_expediente_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_render_canonico(p_producto_id bigint, p_producto_version_id bigint, p_expediente_id bigint, p_storage_path text, p_storage_url text, p_prompt_version text, p_modo text, p_spec_hash text, p_geometry_hash text, p_inputs jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_render_canonico(p_producto_id bigint, p_producto_version_id bigint, p_expediente_id bigint, p_storage_path text, p_storage_url text, p_prompt_version text, p_modo text, p_spec_hash text, p_geometry_hash text, p_inputs jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reglas_comerciales_vigentes(p_fecha date) TO service_role;
GRANT EXECUTE ON FUNCTION public.requiere_aprobacion_snapshot(p_snapshot jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.requiere_aprobacion_snapshot(p_snapshot jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_canonical_price(p_insumo_id text, p_fecha date) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_aprobacion(p_id bigint, p_estado text, p_motivo text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_aprobacion(p_id bigint, p_estado text, p_motivo text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_costo_insumo(p_insumo_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_costo_insumo(p_insumo_id text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_precio_autorizado(p_producto_id bigint, p_version_id bigint, p_variante_id bigint, p_fecha date, p_moneda text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_precio_autorizado(p_producto_id bigint, p_version_id bigint, p_variante_id bigint, p_fecha date, p_moneda text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_precio_especial_proyecto(p_producto_id bigint, p_version_id bigint, p_fecha date, p_moneda text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_renders_canonicos(p_version_ids bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_renders_canonicos(p_version_ids bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.revisiones_autor() TO service_role;
GRANT EXECUTE ON FUNCTION public.revisiones_seguras(p_cotizacion_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisiones_seguras(p_cotizacion_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.solicitar_aprobacion(p_cotizacion_id bigint, p_revision_hash text, p_descuento numeric, p_motivo text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_aprobacion(p_cotizacion_id bigint, p_revision_hash text, p_descuento numeric, p_motivo text) TO service_role;
GRANT EXECUTE ON FUNCTION public.solicitar_aprobacion_snapshot(p_cotizacion_id bigint, p_snapshot jsonb, p_motivo text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_aprobacion_snapshot(p_cotizacion_id bigint, p_snapshot jsonb, p_motivo text) TO service_role;
GRANT EXECUTE ON FUNCTION public.spatial_specs_para_versiones(p_version_ids bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spatial_specs_para_versiones(p_version_ids bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.strip_seller_economics_on_cotizacion_write() TO service_role;
GRANT EXECUTE ON FUNCTION public.strip_seller_economics_on_revision_write() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_precio_legacy() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_precio_legacy() TO service_role;
GRANT EXECUTE ON FUNCTION public.verificar_aprobacion(p_cotizacion_id bigint, p_revision_hash text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_aprobacion(p_cotizacion_id bigint, p_revision_hash text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verificar_render_canonico(p_render_id bigint, p_geometry text, p_features text, p_finish text, p_evidence jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_render_canonico(p_render_id bigint, p_geometry text, p_features text, p_finish text, p_evidence jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.vincular_cotizacion(p_cotizacion_id bigint, p_cliente_id bigint, p_contacto_id bigint, p_proyecto_id bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_cotizacion(p_cotizacion_id bigint, p_cliente_id bigint, p_contacto_id bigint, p_proyecto_id bigint) TO service_role;

-- ===== 3. DEFAULT PRIVILEGES (pg_default_acl, todos los esquemas) =====
-- objtype: r=tabla, S=secuencia, f=función, T=tipo, n=schema. ACL en notación aclitem de PostgreSQL.
-- owner=postgres             schema=public           objtype=S  acl={postgres=rwU/postgres,service_role=rwU/postgres}
-- owner=postgres             schema=public           objtype=f  acl={postgres=X/postgres,service_role=X/postgres}
-- owner=postgres             schema=public           objtype=r  acl={postgres=arwdDxtm/postgres,anon=m/postgres,authenticated=m/postgres,service_role=arwdDxtm/postgres}
-- owner=postgres             schema=storage          objtype=S  acl={postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}
-- owner=postgres             schema=storage          objtype=f  acl={postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- owner=postgres             schema=storage          objtype=r  acl={postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
-- owner=supabase_admin       schema=extensions       objtype=S  acl={postgres=r*w*U*/supabase_admin}
-- owner=supabase_admin       schema=extensions       objtype=f  acl={postgres=X*/supabase_admin}
-- owner=supabase_admin       schema=extensions       objtype=r  acl={postgres=a*r*w*d*D*x*t*m*/supabase_admin}
-- owner=supabase_admin       schema=graphql          objtype=S  acl={postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}
-- owner=supabase_admin       schema=graphql          objtype=f  acl={postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}
-- owner=supabase_admin       schema=graphql          objtype=r  acl={postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}
-- owner=supabase_admin       schema=graphql_public   objtype=S  acl={postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}
-- owner=supabase_admin       schema=graphql_public   objtype=f  acl={postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}
-- owner=supabase_admin       schema=graphql_public   objtype=r  acl={postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}
-- owner=supabase_admin       schema=public           objtype=S  acl={postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}
-- owner=supabase_admin       schema=public           objtype=f  acl={postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}
-- owner=supabase_admin       schema=public           objtype=r  acl={postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}
-- owner=supabase_admin       schema=realtime         objtype=S  acl={postgres=rwU/supabase_admin,dashboard_user=rwU/supabase_admin}
-- owner=supabase_admin       schema=realtime         objtype=f  acl={postgres=X/supabase_admin,dashboard_user=X/supabase_admin}
-- owner=supabase_admin       schema=realtime         objtype=r  acl={postgres=a*r*wdDxtm/supabase_admin,dashboard_user=arwdDxtm/supabase_admin}
-- owner=supabase_auth_admin  schema=auth             objtype=S  acl={postgres=rwU/supabase_auth_admin,dashboard_user=rwU/supabase_auth_admin}
-- owner=supabase_auth_admin  schema=auth             objtype=f  acl={postgres=X/supabase_auth_admin,dashboard_user=X/supabase_auth_admin}
-- owner=supabase_auth_admin  schema=auth             objtype=r  acl={postgres=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}
