-- ============================================================================
-- Snapshot de SÓLO LECTURA de mtuvnbgljwbsaizjjgzs, 2026-10-10.
-- Generado con SELECTs sobre pg_catalog. NO es una migración: no aplicar.
-- Regenerar al cierre de cada bloque.
-- Archivo: 02_rls_policies.sql
-- Contenido: ENABLE/FORCE ROW LEVEL SECURITY por tabla (pg_class.relrowsecurity/relforcerowsecurity) y todas las políticas de pg_policies renderizadas como CREATE POLICY. Esquema public.
-- ============================================================================

-- ===== 1. ENABLE / FORCE ROW LEVEL SECURITY =====
ALTER TABLE public.ai_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aprendizajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aprobaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_recovery_once ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confirmaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones_backup_20261002 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones_revisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones_revisiones_backup_20261002 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente_revisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumo_mapeos_externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumo_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_precio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permitidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_version_economia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas_comerciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadow_costeo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variantes_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voni_council_events ENABLE ROW LEVEL SECURITY;

-- ai_eventos.deny_direct_client_access_ai_eventos  [PERMISSIVE, ALL]
CREATE POLICY deny_direct_client_access_ai_eventos ON public.ai_eventos
  AS PERMISSIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- aprendizajes.aprendizajes_actualiza  [PERMISSIVE, UPDATE]
CREATE POLICY aprendizajes_actualiza ON public.aprendizajes
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private_api.puede_editar_config() AS puede_editar_config) OR ((lower(usuario) = ( SELECT private_api.current_request_email() AS current_request_email)) AND (NOT aprobado_para_ia))))
  WITH CHECK ((( SELECT private_api.puede_editar_config() AS puede_editar_config) OR ((lower(usuario) = ( SELECT private_api.current_request_email() AS current_request_email)) AND (NOT aprobado_para_ia))));

-- aprendizajes.aprendizajes_escribe  [PERMISSIVE, INSERT]
CREATE POLICY aprendizajes_escribe ON public.aprendizajes
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((lower(usuario) = ( SELECT private_api.current_request_email() AS current_request_email)) AND (aprobado_para_ia = ( SELECT private_api.puede_editar_config() AS puede_editar_config))));

-- aprendizajes.aprendizajes_lee  [PERMISSIVE, SELECT]
CREATE POLICY aprendizajes_lee ON public.aprendizajes
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- aprobaciones.aprob_ins  [PERMISSIVE, INSERT]
CREATE POLICY aprob_ins ON public.aprobaciones
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((estado = 'PENDIENTE'::text) AND (solicitado_por = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) AND (EXISTS ( SELECT 1
   FROM cotizaciones c
  WHERE ((c.id = aprobaciones.cotizacion_id) AND ((c.usuario = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)))))));

-- aprobaciones.aprob_sel  [PERMISSIVE, SELECT]
CREATE POLICY aprob_sel ON public.aprobaciones
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((solicitado_por = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.es_direccion() AS es_direccion) OR (EXISTS ( SELECT 1
   FROM cotizaciones c
  WHERE ((c.id = aprobaciones.cotizacion_id) AND ((c.usuario = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)))))));

-- aprobaciones.aprob_upd  [PERMISSIVE, UPDATE]
CREATE POLICY aprob_upd ON public.aprobaciones
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (private_api.es_direccion())
  WITH CHECK (private_api.es_direccion());

-- auth_recovery_once.deny_direct_client_access_auth_recovery_once  [PERMISSIVE, ALL]
CREATE POLICY deny_direct_client_access_auth_recovery_once ON public.auth_recovery_once
  AS PERMISSIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- clientes.cli_del  [PERMISSIVE, DELETE]
CREATE POLICY cli_del ON public.clientes
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (private_api.puede_editar_config());

-- clientes.cli_ins  [PERMISSIVE, INSERT]
CREATE POLICY cli_ins ON public.clientes
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- clientes.cli_sel  [PERMISSIVE, SELECT]
CREATE POLICY cli_sel ON public.clientes
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- clientes.cli_upd  [PERMISSIVE, UPDATE]
CREATE POLICY cli_upd ON public.clientes
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- config.config_actualizar  [PERMISSIVE, UPDATE]
CREATE POLICY config_actualizar ON public.config
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (private_api.puede_editar_config())
  WITH CHECK (private_api.puede_editar_config());

-- config.config_insertar  [PERMISSIVE, INSERT]
CREATE POLICY config_insertar ON public.config
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (private_api.puede_editar_config());

-- config.config_leer  [PERMISSIVE, SELECT]
CREATE POLICY config_leer ON public.config
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- confirmaciones.confirmaciones_ins  [PERMISSIVE, INSERT]
CREATE POLICY confirmaciones_ins ON public.confirmaciones
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- confirmaciones.confirmaciones_sel  [PERMISSIVE, SELECT]
CREATE POLICY confirmaciones_sel ON public.confirmaciones
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- contactos.con_del  [PERMISSIVE, DELETE]
CREATE POLICY con_del ON public.contactos
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (private_api.puede_editar_config());

-- contactos.con_ins  [PERMISSIVE, INSERT]
CREATE POLICY con_ins ON public.contactos
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- contactos.con_sel  [PERMISSIVE, SELECT]
CREATE POLICY con_sel ON public.contactos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- contactos.con_upd  [PERMISSIVE, UPDATE]
CREATE POLICY con_upd ON public.contactos
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- cotizaciones.cotizaciones_actualiza  [PERMISSIVE, UPDATE]
CREATE POLICY cotizaciones_actualiza ON public.cotizaciones
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((usuario = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)))
  WITH CHECK (((usuario = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)));

-- cotizaciones.cotizaciones_escribe  [PERMISSIVE, INSERT]
CREATE POLICY cotizaciones_escribe ON public.cotizaciones
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((usuario = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)));

-- cotizaciones.cotizaciones_lee  [PERMISSIVE, SELECT]
CREATE POLICY cotizaciones_lee ON public.cotizaciones
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- cotizaciones.qa_fixture_isolation_cotizaciones  [RESTRICTIVE, ALL]
CREATE POLICY qa_fixture_isolation_cotizaciones ON public.cotizaciones
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (((lower(COALESCE(usuario, ''::text)) <> 'qa-direccion@vonhaucke.mx'::text) OR (( SELECT private_api.current_request_email() AS current_request_email) = 'qa-direccion@vonhaucke.mx'::text)))
  WITH CHECK (((lower(COALESCE(usuario, ''::text)) <> 'qa-direccion@vonhaucke.mx'::text) OR (( SELECT private_api.current_request_email() AS current_request_email) = 'qa-direccion@vonhaucke.mx'::text)));

-- cotizaciones_backup_20261002.deny_direct_client_access_cotizaciones_backup_20261002  [PERMISSIVE, ALL]
CREATE POLICY deny_direct_client_access_cotizaciones_backup_20261002 ON public.cotizaciones_backup_20261002
  AS PERMISSIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- cotizaciones_revisiones.revisiones_lee  [PERMISSIVE, SELECT]
CREATE POLICY revisiones_lee ON public.cotizaciones_revisiones
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- cotizaciones_revisiones_backup_20261002.deny_direct_client_access_cotizaciones_revisiones_backup_202610  [PERMISSIVE, ALL]
CREATE POLICY deny_direct_client_access_cotizaciones_revisiones_backup_202610 ON public.cotizaciones_revisiones_backup_20261002
  AS PERMISSIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- direccion.direccion_actualizar  [PERMISSIVE, UPDATE]
CREATE POLICY direccion_actualizar ON public.direccion
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (private_api.es_direccion())
  WITH CHECK (private_api.es_direccion());

-- direccion.direccion_insertar  [PERMISSIVE, INSERT]
CREATE POLICY direccion_insertar ON public.direccion
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (private_api.es_direccion());

-- direccion.direccion_leer  [PERMISSIVE, SELECT]
CREATE POLICY direccion_leer ON public.direccion
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.es_direccion());

-- escenarios.escenarios_ins  [PERMISSIVE, INSERT]
CREATE POLICY escenarios_ins ON public.escenarios
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- escenarios.escenarios_sel  [PERMISSIVE, SELECT]
CREATE POLICY escenarios_sel ON public.escenarios
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- escenarios.escenarios_upd  [PERMISSIVE, UPDATE]
CREATE POLICY escenarios_upd ON public.escenarios
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- expediente_revisiones.exprev_insert_technical  [PERMISSIVE, INSERT]
CREATE POLICY exprev_insert_technical ON public.expediente_revisiones
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((lower(p.email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (lower(p.rol) = ANY (ARRAY['direccion'::text, 'diseno'::text]))))));

-- expediente_revisiones.exprev_sel  [PERMISSIVE, SELECT]
CREATE POLICY exprev_sel ON public.expediente_revisiones
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- expedientes.exp_sel  [PERMISSIVE, SELECT]
CREATE POLICY exp_sel ON public.expedientes
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- expedientes.exp_write_delete  [PERMISSIVE, DELETE]
CREATE POLICY exp_write_delete ON public.expedientes
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((p.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) AND (p.rol = ANY (ARRAY['direccion'::text, 'diseno'::text]))))));

-- expedientes.exp_write_insert  [PERMISSIVE, INSERT]
CREATE POLICY exp_write_insert ON public.expedientes
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((p.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) AND (p.rol = ANY (ARRAY['direccion'::text, 'diseno'::text]))))));

-- expedientes.exp_write_update  [PERMISSIVE, UPDATE]
CREATE POLICY exp_write_update ON public.expedientes
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((p.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) AND (p.rol = ANY (ARRAY['direccion'::text, 'diseno'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((p.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) AND (p.rol = ANY (ARRAY['direccion'::text, 'diseno'::text]))))));

-- insumo_mapeos_externos.p_mapeo_actualiza  [PERMISSIVE, UPDATE]
CREATE POLICY p_mapeo_actualiza ON public.insumo_mapeos_externos
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (private_api.puede_editar_config())
  WITH CHECK (private_api.puede_editar_config());

-- insumo_mapeos_externos.p_mapeo_escribe  [PERMISSIVE, INSERT]
CREATE POLICY p_mapeo_escribe ON public.insumo_mapeos_externos
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (private_api.puede_editar_config());

-- insumo_mapeos_externos.p_mapeo_lee  [PERMISSIVE, SELECT]
CREATE POLICY p_mapeo_lee ON public.insumo_mapeos_externos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- insumo_precios.pre_actualiza  [PERMISSIVE, UPDATE]
CREATE POLICY pre_actualiza ON public.insumo_precios
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (private_api.puede_editar_config())
  WITH CHECK (private_api.puede_editar_config());

-- insumo_precios.pre_escribe  [PERMISSIVE, INSERT]
CREATE POLICY pre_escribe ON public.insumo_precios
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (private_api.puede_editar_config());

-- insumo_precios.pre_lee  [PERMISSIVE, SELECT]
CREATE POLICY pre_lee ON public.insumo_precios
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- insumos_catalogo.cat_actualiza  [PERMISSIVE, UPDATE]
CREATE POLICY cat_actualiza ON public.insumos_catalogo
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (private_api.puede_editar_config())
  WITH CHECK (private_api.puede_editar_config());

-- insumos_catalogo.cat_escribe  [PERMISSIVE, INSERT]
CREATE POLICY cat_escribe ON public.insumos_catalogo
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (private_api.puede_editar_config());

-- insumos_catalogo.cat_lee  [PERMISSIVE, SELECT]
CREATE POLICY cat_lee ON public.insumos_catalogo
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- lista_precio_items.pm_lpi_sel  [PERMISSIVE, SELECT]
CREATE POLICY pm_lpi_sel ON public.lista_precio_items
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- lista_precio_items.pm_lpi_w_delete  [PERMISSIVE, DELETE]
CREATE POLICY pm_lpi_w_delete ON public.lista_precio_items
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- lista_precio_items.pm_lpi_w_insert  [PERMISSIVE, INSERT]
CREATE POLICY pm_lpi_w_insert ON public.lista_precio_items
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- lista_precio_items.pm_lpi_w_update  [PERMISSIVE, UPDATE]
CREATE POLICY pm_lpi_w_update ON public.lista_precio_items
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT private_api.puede_ver_economia() AS puede_ver_economia))
  WITH CHECK (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- listas_precio.pm_lp_sel  [PERMISSIVE, SELECT]
CREATE POLICY pm_lp_sel ON public.listas_precio
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- listas_precio.pm_lp_w_delete  [PERMISSIVE, DELETE]
CREATE POLICY pm_lp_w_delete ON public.listas_precio
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- listas_precio.pm_lp_w_insert  [PERMISSIVE, INSERT]
CREATE POLICY pm_lp_w_insert ON public.listas_precio
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- listas_precio.pm_lp_w_update  [PERMISSIVE, UPDATE]
CREATE POLICY pm_lp_w_update ON public.listas_precio
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT private_api.puede_ver_economia() AS puede_ver_economia))
  WITH CHECK (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- permitidos.permitidos_modificar_delete  [PERMISSIVE, DELETE]
CREATE POLICY permitidos_modificar_delete ON public.permitidos
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT private_api.es_direccion() AS es_direccion));

-- permitidos.permitidos_modificar_insert  [PERMISSIVE, INSERT]
CREATE POLICY permitidos_modificar_insert ON public.permitidos
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private_api.es_direccion() AS es_direccion));

-- permitidos.permitidos_modificar_update  [PERMISSIVE, UPDATE]
CREATE POLICY permitidos_modificar_update ON public.permitidos
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT private_api.es_direccion() AS es_direccion))
  WITH CHECK (( SELECT private_api.es_direccion() AS es_direccion));

-- permitidos.permitidos_select  [PERMISSIVE, SELECT]
CREATE POLICY permitidos_select ON public.permitidos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.es_direccion() AS es_direccion)));

-- producto_version_economia.pm_eco_all  [PERMISSIVE, ALL]
CREATE POLICY pm_eco_all ON public.producto_version_economia
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (private_api.puede_ver_economia())
  WITH CHECK (private_api.puede_ver_economia());

-- producto_versiones.pm_ver_sel  [PERMISSIVE, SELECT]
CREATE POLICY pm_ver_sel ON public.producto_versiones
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- producto_versiones.pm_ver_w_delete  [PERMISSIVE, DELETE]
CREATE POLICY pm_ver_w_delete ON public.producto_versiones
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- producto_versiones.pm_ver_w_insert  [PERMISSIVE, INSERT]
CREATE POLICY pm_ver_w_insert ON public.producto_versiones
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- producto_versiones.pm_ver_w_update  [PERMISSIVE, UPDATE]
CREATE POLICY pm_ver_w_update ON public.producto_versiones
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT private_api.puede_editar_config() AS puede_editar_config))
  WITH CHECK (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- productos.pm_prod_sel  [PERMISSIVE, SELECT]
CREATE POLICY pm_prod_sel ON public.productos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- productos.pm_prod_w_delete  [PERMISSIVE, DELETE]
CREATE POLICY pm_prod_w_delete ON public.productos
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- productos.pm_prod_w_insert  [PERMISSIVE, INSERT]
CREATE POLICY pm_prod_w_insert ON public.productos
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- productos.pm_prod_w_update  [PERMISSIVE, UPDATE]
CREATE POLICY pm_prod_w_update ON public.productos
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT private_api.puede_editar_config() AS puede_editar_config))
  WITH CHECK (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- proyecto_actividades.act_ins  [PERMISSIVE, INSERT]
CREATE POLICY act_ins ON public.proyecto_actividades
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM proyectos pr
  WHERE ((pr.id = proyecto_actividades.proyecto_id) AND ((pr.vendedor_responsable = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config))))));

-- proyecto_actividades.act_sel  [PERMISSIVE, SELECT]
CREATE POLICY act_sel ON public.proyecto_actividades
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM proyectos pr
  WHERE ((pr.id = proyecto_actividades.proyecto_id) AND ((pr.vendedor_responsable = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config))))));

-- proyectos.pr_del  [PERMISSIVE, DELETE]
CREATE POLICY pr_del ON public.proyectos
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (private_api.puede_editar_config());

-- proyectos.pr_ins  [PERMISSIVE, INSERT]
CREATE POLICY pr_ins ON public.proyectos
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((vendedor_responsable = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)));

-- proyectos.pr_sel  [PERMISSIVE, SELECT]
CREATE POLICY pr_sel ON public.proyectos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((vendedor_responsable = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)));

-- proyectos.pr_upd  [PERMISSIVE, UPDATE]
CREATE POLICY pr_upd ON public.proyectos
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((vendedor_responsable = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)))
  WITH CHECK (((vendedor_responsable = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR ( SELECT private_api.puede_editar_config() AS puede_editar_config)));

-- proyectos.qa_fixture_isolation_projects  [RESTRICTIVE, ALL]
CREATE POLICY qa_fixture_isolation_projects ON public.proyectos
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (((lower(COALESCE(creado_por, ''::text)) <> 'qa-direccion@vonhaucke.mx'::text) OR (( SELECT private_api.current_request_email() AS current_request_email) = 'qa-direccion@vonhaucke.mx'::text)))
  WITH CHECK (((lower(COALESCE(creado_por, ''::text)) <> 'qa-direccion@vonhaucke.mx'::text) OR (( SELECT private_api.current_request_email() AS current_request_email) = 'qa-direccion@vonhaucke.mx'::text)));

-- reglas.reglas_escribir_delete  [PERMISSIVE, DELETE]
CREATE POLICY reglas_escribir_delete ON public.reglas
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((lower(p.email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (p.rol = ANY (ARRAY['direccion'::text, 'diseno'::text]))))));

-- reglas.reglas_escribir_insert  [PERMISSIVE, INSERT]
CREATE POLICY reglas_escribir_insert ON public.reglas
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((lower(p.email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (p.rol = ANY (ARRAY['direccion'::text, 'diseno'::text]))))));

-- reglas.reglas_escribir_update  [PERMISSIVE, UPDATE]
CREATE POLICY reglas_escribir_update ON public.reglas
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((lower(p.email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (p.rol = ANY (ARRAY['direccion'::text, 'diseno'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM permitidos p
  WHERE ((lower(p.email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (p.rol = ANY (ARRAY['direccion'::text, 'diseno'::text]))))));

-- reglas.reglas_leer  [PERMISSIVE, SELECT]
CREATE POLICY reglas_leer ON public.reglas
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- reglas_comerciales.rc_sel  [PERMISSIVE, SELECT]
CREATE POLICY rc_sel ON public.reglas_comerciales
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_ver_economia());

-- reglas_comerciales.rc_w_delete  [PERMISSIVE, DELETE]
CREATE POLICY rc_w_delete ON public.reglas_comerciales
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- reglas_comerciales.rc_w_insert  [PERMISSIVE, INSERT]
CREATE POLICY rc_w_insert ON public.reglas_comerciales
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- reglas_comerciales.rc_w_update  [PERMISSIVE, UPDATE]
CREATE POLICY rc_w_update ON public.reglas_comerciales
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT private_api.puede_ver_economia() AS puede_ver_economia))
  WITH CHECK (( SELECT private_api.puede_ver_economia() AS puede_ver_economia));

-- render_eventos.deny_direct_client_access_render_eventos  [PERMISSIVE, ALL]
CREATE POLICY deny_direct_client_access_render_eventos ON public.render_eventos
  AS PERMISSIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- renders.renders_delete_owner_or_privileged  [PERMISSIVE, DELETE]
CREATE POLICY renders_delete_owner_or_privileged ON public.renders
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((( SELECT private_api.puede_editar_config() AS puede_editar_config) OR (lower(COALESCE(creado_por, ''::text)) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))));

-- renders.renders_insert_owner_or_privileged  [PERMISSIVE, INSERT]
CREATE POLICY renders_insert_owner_or_privileged ON public.renders
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private_api.puede_editar_config() AS puede_editar_config) OR (lower(COALESCE(creado_por, ''::text)) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))));

-- renders.renders_select_owner_or_privileged  [PERMISSIVE, SELECT]
CREATE POLICY renders_select_owner_or_privileged ON public.renders
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((( SELECT private_api.puede_editar_config() AS puede_editar_config) OR (lower(COALESCE(creado_por, ''::text)) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))));

-- renders.renders_update_owner_or_privileged  [PERMISSIVE, UPDATE]
CREATE POLICY renders_update_owner_or_privileged ON public.renders
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private_api.puede_editar_config() AS puede_editar_config) OR (lower(COALESCE(creado_por, ''::text)) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))))
  WITH CHECK ((( SELECT private_api.puede_editar_config() AS puede_editar_config) OR (lower(COALESCE(creado_por, ''::text)) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))));

-- shadow_costeo.shadow_insert  [PERMISSIVE, INSERT]
CREATE POLICY shadow_insert ON public.shadow_costeo
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- shadow_costeo.shadow_select_dir  [PERMISSIVE, SELECT]
CREATE POLICY shadow_select_dir ON public.shadow_costeo
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.es_direccion());

-- variantes_producto.pm_var_sel  [PERMISSIVE, SELECT]
CREATE POLICY pm_var_sel ON public.variantes_producto
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- variantes_producto.pm_var_w_delete  [PERMISSIVE, DELETE]
CREATE POLICY pm_var_w_delete ON public.variantes_producto
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- variantes_producto.pm_var_w_insert  [PERMISSIVE, INSERT]
CREATE POLICY pm_var_w_insert ON public.variantes_producto
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- variantes_producto.pm_var_w_update  [PERMISSIVE, UPDATE]
CREATE POLICY pm_var_w_update ON public.variantes_producto
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT private_api.puede_editar_config() AS puede_editar_config))
  WITH CHECK (( SELECT private_api.puede_editar_config() AS puede_editar_config));

-- voni_council_events.voni_council_events_read  [PERMISSIVE, SELECT]
CREATE POLICY voni_council_events_read ON public.voni_council_events
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (private_api.puede_editar_config());

-- ===== 2. TABLAS CON RLS HABILITADO Y CERO POLÍTICAS (deny-all implícito; sólo service_role/owner) =====
--   (ninguna)

-- ===== 3. TABLAS SIN RLS =====
--   (ninguna)
