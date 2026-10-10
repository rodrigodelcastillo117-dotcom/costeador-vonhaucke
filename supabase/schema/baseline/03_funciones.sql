-- ============================================================================
-- Snapshot de SÓLO LECTURA de mtuvnbgljwbsaizjjgzs, 2026-10-10.
-- Generado con SELECTs sobre pg_catalog. NO es una migración: no aplicar.
-- Regenerar al cierre de cada bloque.
-- Archivo: 03_funciones.sql
-- Contenido: Todas las funciones del esquema public via pg_get_functiondef(oid), ordenadas por nombre. Cabecera por función indica SECURITY DEFINER/INVOKER, tipo y comentario. Las funciones de private_api NO se incluyen (ver 00_INDICE.md).
-- ============================================================================

-- ============================================================
-- FUNCIÓN: actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: aprendizajes_autor()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprendizajes_autor()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  ident text := coalesce(nullif(claims->>'email', ''), nullif(claims->>'sub', ''));
begin
  if (tg_op = 'INSERT') then
    new.usuario := ident;        -- lo pone el servidor; se ignora lo que mande el cliente
  elsif (tg_op = 'UPDATE') then
    new.usuario := old.usuario;  -- autor inmutable: no se puede cambiar ni suplantar
  end if;
  return new;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: aprendizajes_revision_gate()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprendizajes_revision_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  es_editor boolean := (SELECT private_api.puede_editar_config());
BEGIN
  IF TG_OP='INSERT' THEN
    IF es_editor THEN
      NEW.aprobado_para_ia := true;
    ELSE
      NEW.aprobado_para_ia := false;
      NEW.regla_clave := NULL;
      NEW.veces := 1;
      NEW.activo := true;
    END IF;
  ELSE
    IF NOT es_editor THEN
      IF OLD.aprobado_para_ia THEN
        RAISE EXCEPTION 'Leccion aprobada solo modificable por Diseno/Direccion'
          USING ERRCODE='42501';
      END IF;
      IF NEW.texto IS DISTINCT FROM OLD.texto OR NEW.tipo IS DISTINCT FROM OLD.tipo
        OR NEW.pedido IS DISTINCT FROM OLD.pedido
        OR NEW.propuso IS DISTINCT FROM OLD.propuso
        OR NEW.quedo IS DISTINCT FROM OLD.quedo
        OR NEW.activo IS DISTINCT FROM OLD.activo
        OR NEW.regla_clave IS DISTINCT FROM OLD.regla_clave
        OR NEW.aprobado_para_ia IS DISTINCT FROM OLD.aprobado_para_ia
        OR NEW.creado IS DISTINCT FROM OLD.creado
        OR NEW.veces < OLD.veces OR NEW.veces > OLD.veces+1 THEN
        RAISE EXCEPTION 'Solo puedes incrementar una correccion pendiente propia'
          USING ERRCODE='42501';
      END IF;
    END IF;
    NEW.usuario := OLD.usuario;
  END IF;
  RETURN NEW;
END;
$function$
;

-- ============================================================
-- FUNCIÓN: aprobar_mapeo_externo(p_mapeo_id bigint, p_nota text)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprobar_mapeo_externo(p_mapeo_id bigint, p_nota text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare m public.insumo_mapeos_externos%rowtype;
begin
  if not public.puede_certificar_costo() then raise exception 'no autorizado'; end if;
  select * into m from public.insumo_mapeos_externos where id=p_mapeo_id;
  if m.id is null then raise exception 'mapeo % inexistente', p_mapeo_id; end if;
  if m.source_document is null or m.source_record_id is null or m.source_hash is null then
    raise exception 'mapeo sin provenance minimo (source_document/source_record_id/source_hash); no aprobable'; end if;
  if m.confidence is null then raise exception 'mapeo sin confidence declarada; no aprobable'; end if;
  if m.vigente_desde is null then raise exception 'mapeo sin vigente_desde; no aprobable'; end if;
  perform set_config('vh.via_rpc_aprobacion','on', true);
  update public.insumo_mapeos_externos set estado='aprobado', approved_by=(auth.jwt()->>'email'), approved_at=now()
   where id=p_mapeo_id;
end $function$
;

-- ============================================================
-- FUNCIÓN: aprobar_precio(p_precio_id bigint, p_nota text)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprobar_precio(p_precio_id bigint, p_nota text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.insumo_precios%rowtype; v_uc text;
begin
  if not public.puede_certificar_costo() then raise exception 'no autorizado para certificar costo'; end if;
  select * into r from public.insumo_precios where id=p_precio_id;
  if r.id is null then raise exception 'precio % inexistente', p_precio_id; end if;
  if r.contract_status = 'DATA_TRUTH_V1' then
    if r.source_price is null or r.source_price <= 0
       or r.source_currency is null or btrim(r.source_currency)=''
       or r.source_unit is null or btrim(r.source_unit)=''
       or r.source_units_per_cost_unit is null or r.source_units_per_cost_unit <= 0
       or r.cost_unit is null or btrim(r.cost_unit)=''
       or r.source_system is null or btrim(r.source_system)=''
       or r.source_document is null or btrim(r.source_document)=''
       or r.source_record_id is null or btrim(r.source_record_id)=''
       or r.source_hash is null or btrim(r.source_hash)=''
       or r.vigente_desde is null
       or (r.source_currency <> 'MXN' and (r.fx_rate is null or r.fx_rate <= 0 or r.fx_date is null or r.fx_source is null or btrim(r.fx_source)='')) then
      raise exception 'observacion DATA_TRUTH_V1 incompleta: no cumple el contrato economico; no certificable';
    end if;
    select unidad_costeo into v_uc from public.insumos_catalogo where id=r.insumo_id;
    if v_uc is not null and r.cost_unit <> v_uc then
      raise exception 'cost_unit (%) != unidad_costeo (%); no certificable', r.cost_unit, v_uc; end if;
  end if;
  perform set_config('vh.via_rpc_aprobacion','on', true);
  update public.insumo_precios set estado='aprobado', approved_by=(auth.jwt()->>'email'), approved_at=now()
   where id=p_precio_id;
end $function$
;

-- ============================================================
-- FUNCIÓN: asignar_folio_oficial(p_cotizacion_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.asignar_folio_oficial(p_cotizacion_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.asignar_folio_oficial(p_cotizacion_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: bom_hash_de_revision(p_rev_id bigint)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.bom_hash_de_revision(p_rev_id bigint)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select encode(digest(convert_to(coalesce(r.bom::text,'null'),'UTF8'),'sha256'),'hex')
  from public.expediente_revisiones r where r.id = p_rev_id;
$function$
;

-- ============================================================
-- FUNCIÓN: calc_mapeo_source_hash()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calc_mapeo_source_hash()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  NEW.source_hash := encode(digest(convert_to(
    concat_ws(chr(1), NEW.source_system, NEW.source_document, NEW.source_sheet, NEW.source_record_id,
      NEW.external_key, NEW.external_option, NEW.insumo_id, NEW.identity_status),
    'UTF8'),'sha256'),'hex');
  return NEW;
end $function$
;

-- ============================================================
-- FUNCIÓN: calc_source_hash()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calc_source_hash()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  if NEW.contract_status = 'DATA_TRUTH_V1' then
    NEW.source_hash := encode(digest(convert_to(
      concat_ws(chr(1), NEW.source_system, NEW.source_document, NEW.source_record_id,
        NEW.source_price::text, NEW.source_currency, NEW.source_unit, NEW.source_units_per_cost_unit::text),
      'UTF8'),'sha256'),'hex');
  elsif NEW.source_hash is null and NEW.source_system is not null then
    NEW.source_hash := encode(digest(convert_to(
      concat_ws(chr(1), NEW.source_system, NEW.source_document, NEW.source_record_id,
        NEW.source_price::text, NEW.source_currency, NEW.source_unit, NEW.source_units_per_cost_unit::text),
      'UTF8'),'sha256'),'hex');
  end if;
  return NEW;
end $function$
;

-- ============================================================
-- FUNCIÓN: cerrar_vigencia_precio(p_insumo_id text, p_fecha date)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.cerrar_vigencia_precio(p_insumo_id text, p_fecha date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.puede_certificar_costo() then raise exception 'no autorizado'; end if;
  perform set_config('vh.via_rpc_aprobacion','on', true);
  update public.insumo_precios set vigente_hasta=p_fecha
   where insumo_id=p_insumo_id and vigente_hasta is null and vigente_desde <= p_fecha;
end $function$
;

-- ============================================================
-- FUNCIÓN: certificar_version(p_pv_id bigint)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.certificar_version(p_pv_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v public.producto_versiones%rowtype;
begin
  if not public.puede_certificar_costo() then raise exception 'no autorizado'; end if;
  select * into v from public.producto_versiones where id=p_pv_id;
  if v.expediente_revision_id is null then raise exception 'version sin expediente_revision_id (pin BOM)'; end if;
  update public.producto_versiones
     set bom_hash=public.bom_hash_de_revision(v.expediente_revision_id), estado_tecnico='certificado'
   where id=p_pv_id;
end $function$
;

-- ============================================================
-- FUNCIÓN: clasifica_partida(p jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.clasifica_partida(p jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
    when (p->>'cantidad') is null or (p->>'cantidad') !~ '^[0-9]*\.?[0-9]+$' or (p->>'cantidad')::numeric <= 0 then 'QTY_INVALIDA'
    when coalesce((p->>'precioUnitario')::numeric,0) > 0 and coalesce((p->>'costoUnitario')::numeric,0) = 0 then 'COSTO_DESCONOCIDO'
    when coalesce((p->>'costoUnitario')::numeric,0) > 0 then 'COSTO_CONOCIDO'
    else 'NO_APLICA' end;
$function$
;

-- ============================================================
-- FUNCIÓN: cocrear_seguro(p_expediente_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.cocrear_seguro(p_expediente_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.cocrear_seguro(p_expediente_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: config_para_rol()
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.config_para_rol()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.config_para_rol();
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: config_sanitizada(datos jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.config_sanitizada(datos jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select public.jsonb_sin_economia(
    coalesce(datos, '{}'::jsonb)
    || jsonb_build_object('insumos', coalesce((
        select jsonb_object_agg(k, (v - 'precio' - 'precioBase' - 'proveedor'))
        from jsonb_each(datos->'insumos') as e(k, v)
        where jsonb_typeof(datos->'insumos') = 'object'
      ), '{}'::jsonb))
    || jsonb_build_object('piezas', coalesce((
        select jsonb_object_agg(k, (v - 'horas' - 'factorDirecta' - 'factorIndirecta' - 'preparacionHoras' - 'modoManoObra'))
        from jsonb_each(datos->'piezas') as e(k, v)
        where jsonb_typeof(datos->'piezas') = 'object'
      ), '{}'::jsonb))
    || jsonb_build_object('parametros', coalesce((
        (datos->'parametros')
          - 'costoHora' - 'costoHoraGIF' - 'utilidadPct' - 'margenMinimo' - 'margenObjetivo'
          - 'minMarkupLinea' - 'factorManoObraDirecta' - 'factorManoObraIndirecta'
          - 'factorIndirectosFabrica' - 'gastosOperacionPct' - 'factorPrecioLista'
      ), '{}'::jsonb))
  );
$function$
;

-- ============================================================
-- FUNCIÓN: cotizacion_emitible(p_cotizacion_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.cotizacion_emitible(p_cotizacion_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.cotizacion_emitible(p_cotizacion_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: cotizacion_revisiones_seguras(p_cotizacion_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.cotizacion_revisiones_seguras(p_cotizacion_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.cotizacion_revisiones_seguras(p_cotizacion_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: cotizacion_segura(p_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.cotizacion_segura(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.cotizacion_segura(p_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: cotizaciones_mias(p_limite integer)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.cotizaciones_mias(p_limite integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.cotizaciones_mias(p_limite);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: cotizaciones_seguras()
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.cotizaciones_seguras()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.cotizaciones_seguras();
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: crear_cotizacion_segura(p_payload jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.crear_cotizacion_segura(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.crear_cotizacion_segura(p_payload);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: emitir_revision(p_cotizacion_id bigint, p_snapshot jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.emitir_revision(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.emitir_revision(p_cotizacion_id, p_snapshot);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: emitir_revision_v2(p_cotizacion_id bigint, p_snapshot jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.emitir_revision_v2(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.emitir_revision_v2(p_cotizacion_id, p_snapshot);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: es_direccion()
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.es_direccion()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.es_direccion();
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.evaluar_emision_cotizacion(p_cotizacion_id, p_snapshot);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: guard_delete_producto_version()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_delete_producto_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if OLD.estado_tecnico = 'certificado'
     and current_setting('vh.permitir_borrado_certificado', true) is distinct from 'on' then
    raise exception 'no se puede borrar una producto_version certificada (id %); una certificacion no desaparece por cascada', OLD.id;
  end if;
  return OLD;
end $function$
;

-- ============================================================
-- FUNCIÓN: guard_mapeo_externo()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_mapeo_externo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if NEW.estado='aprobado' and not exists
     (select 1 from public.insumos_catalogo c where c.id=NEW.insumo_id and coalesce(c.activo,true)) then
    raise exception 'mapeo aprobado a insumo inactivo/inexistente: %', NEW.insumo_id; end if;
  if TG_OP='UPDATE' and OLD.estado='aprobado' and NEW.insumo_id<>OLD.insumo_id then
    raise exception 'cambio de identidad en mapeo aprobado prohibido'; end if;
  if (NEW.estado='aprobado' or NEW.approved_by is not null)
     and current_setting('vh.via_rpc_aprobacion', true) is distinct from 'on' then
    raise exception 'mapeo: aprobar solo via RPC'; end if;
  return NEW;
end $function$
;

-- ============================================================
-- FUNCIÓN: guard_precio_no_autofirma()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_precio_no_autofirma()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if (NEW.estado = 'aprobado' or NEW.approved_by is not null or NEW.approved_at is not null)
     and current_setting('vh.via_rpc_aprobacion', true) is distinct from 'on' then
    raise exception 'estado=aprobado/approved_by/approved_at solo via RPC de aprobacion de costos';
  end if; return NEW;
end $function$
;

-- ============================================================
-- FUNCIÓN: guard_producto_version()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_producto_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.expediente_revisiones%rowtype; h text;
begin
  if TG_OP in ('INSERT','UPDATE') and NEW.estado_tecnico = 'certificado' then
    if NEW.expediente_id is null or NEW.expediente_revision_id is null or NEW.bom_hash is null then
      raise exception 'version certificada sin pin completo (expediente_id/expediente_revision_id/bom_hash)';
    end if;
    select * into r from public.expediente_revisiones where id = NEW.expediente_revision_id;
    if not found then raise exception 'expediente_revision_id % inexistente', NEW.expediente_revision_id; end if;
    if r.expediente_id <> NEW.expediente_id then raise exception 'la revision pertenece a otro expediente'; end if;
    if r.producto_version_id is not null and r.producto_version_id <> NEW.id then
      raise exception 'revision.producto_version_id (%) != version.id (%)', r.producto_version_id, NEW.id; end if;
    h := public.bom_hash_de_revision(NEW.expediente_revision_id);
    if NEW.bom_hash is distinct from h then
      raise exception 'bom_hash (%) != SHA256(canonical bom) (%)', NEW.bom_hash, h; end if;
  end if;
  if TG_OP = 'UPDATE' and OLD.estado_tecnico = 'certificado' then
    if NEW.expediente_revision_id is distinct from OLD.expediente_revision_id
     or NEW.bom_hash is distinct from OLD.bom_hash
     or NEW.dimensiones is distinct from OLD.dimensiones
     or NEW.atributos is distinct from OLD.atributos then
      raise exception 'version certificada es inmutable: crea una nueva version'; end if;
  end if;
  return NEW;
end $function$
;

-- ============================================================
-- FUNCIÓN: guardar_cocrear_seguro(p_expediente_id bigint, p_payload jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.guardar_cocrear_seguro(p_expediente_id bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.guardar_cocrear_seguro(p_expediente_id, p_payload);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: hash_revision(p_snapshot jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.hash_revision(p_snapshot jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.hash_revision(p_snapshot);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: insumo_precios_append_only()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.insumo_precios_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if TG_OP = 'DELETE' then raise exception 'insumo_precios append-only: DELETE prohibido'; end if;
  if NEW.insumo_id is distinct from OLD.insumo_id
   or NEW.source_price is distinct from OLD.source_price
   or NEW.source_currency is distinct from OLD.source_currency
   or NEW.fx_rate is distinct from OLD.fx_rate
   or NEW.source_units_per_cost_unit is distinct from OLD.source_units_per_cost_unit
   or NEW.vigente_desde is distinct from OLD.vigente_desde
   or NEW.source_hash is distinct from OLD.source_hash then
    raise exception 'insumo_precios: columnas economicas/identidad/vigencia-inicial/provenance inmutables'; end if;
  if OLD.estado = 'aprobado' and current_setting('vh.via_rpc_aprobacion', true) is distinct from 'on' then
    raise exception 'fila aprobada inmutable a escritura directa; usa la RPC autorizada'; end if;
  if OLD.vigente_hasta is not null and NEW.vigente_hasta is distinct from OLD.vigente_hasta then
    raise exception 'vigente_hasta ya cerrada; no se reabre'; end if;
  return NEW;
end $function$
;

-- ============================================================
-- FUNCIÓN: jsonb_sin_economia(data jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.jsonb_sin_economia(data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare k text; v jsonb; out jsonb; nk text;
begin
  if data is null then return null; end if;
  if jsonb_typeof(data)='array' then
    return (select coalesce(jsonb_agg(public.jsonb_sin_economia(e)),'[]'::jsonb) from jsonb_array_elements(data) e);
  elsif jsonb_typeof(data)='object' then
    out := '{}'::jsonb;
    for k,v in select * from jsonb_each(data) loop
      nk := regexp_replace(lower(k),'[^a-z0-9]','','g');
      if nk ~ '^(costo.*|cost.*|margen.*|margin.*|utilidad.*|profit.*|materialtotal|manoobra.*|laborcost.*|indirectos.*|overhead.*|precioproveedor.*|supplierprice.*|suppliercost.*|proveedor.*|supplier.*|preciocompra.*|purchaseprice.*|purchasecost.*|precioreal.*|costoderivado.*|internalcost.*|internalmargin.*)$' then
        continue;
      end if;
      out := out || jsonb_build_object(k,public.jsonb_sin_economia(v));
    end loop;
    return out;
  end if;
  return data;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: marcar_renders_stale_producto(p_producto_id bigint, p_except_version_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.marcar_renders_stale_producto(p_producto_id bigint, p_except_version_id bigint DEFAULT NULL::bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.marcar_renders_stale_producto(p_producto_id, p_except_version_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: normalizar_cost_status_partidas(p_partidas jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalizar_cost_status_partidas(p_partidas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare out jsonb:='[]'::jsonb; pt jsonb; c numeric; st text;
begin
  if p_partidas is null or jsonb_typeof(p_partidas)<>'array' then return p_partidas; end if;
  for pt in select value from jsonb_array_elements(p_partidas) loop
    st := upper(coalesce(nullif(pt->>'cost_status',''),nullif(pt->>'costo_estado',''),''));
    begin c := nullif(pt->>'costoUnitario','')::numeric; exception when others then c:=null; end;
    if st='' then
      if c is null then st:='UNKNOWN';
      elsif c>0 then st:='KNOWN';
      elsif c=0 then st:='UNKNOWN'; -- zero is never assumed legitimate without explicit state
      else st:='INVALID';
      end if;
    end if;
    if st not in ('KNOWN','KNOWN_ZERO','ESTIMATED','USER_APPROVED_ESTIMATE','PENDING_PRICE','PENDING_MATERIAL','UNKNOWN','NOT_APPLICABLE','NO_ACCESS','INVALID') then
      st:='UNKNOWN';
    end if;
    pt := jsonb_set(pt,'{cost_status}',to_jsonb(st),true);
    out := out || jsonb_build_array(pt);
  end loop;
  return out;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: normalize_economics_on_cotizacion_write()
-- SECURITY: DEFINER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_economics_on_cotizacion_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.partidas := public.normalizar_cost_status_partidas(new.partidas);
  return new;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: partidas_vendedor(p_partidas jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.partidas_vendedor(p_partidas jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(p - 'costoUnitario' - 'margen' - 'costoDerivado' - 'precioReal'), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_partidas, '[]'::jsonb)) p;
$function$
;

-- ============================================================
-- FUNCIÓN: pin_product_versions_in_partidas(p_partidas jsonb)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.pin_product_versions_in_partidas(p_partidas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  out jsonb := '[]'::jsonb;
  pt jsonb;
  v_pid_txt text;
  v_pvid_txt text;
  v_pid bigint;
  v_pvid bigint;
begin
  if p_partidas is null or jsonb_typeof(p_partidas) <> 'array' then return p_partidas; end if;
  for pt in select value from jsonb_array_elements(p_partidas) loop
    v_pid_txt := coalesce(nullif(pt->>'producto_id',''),nullif(pt->>'productoId',''),nullif(pt->>'product_id',''));
    v_pvid_txt := coalesce(nullif(pt->>'producto_version_id',''),nullif(pt->>'productoVersionId',''),nullif(pt->>'product_version_id',''));

    if v_pid_txt is not null and v_pid_txt ~ '^[0-9]+$' then
      v_pid := v_pid_txt::bigint;
      pt := jsonb_set(pt,'{producto_id}',to_jsonb(v_pid),true);
      if v_pvid_txt is null then
        select p.version_tecnica_vigente_id into v_pvid from public.productos p where p.id=v_pid;
        if v_pvid is not null then
          pt := jsonb_set(pt,'{producto_version_id}',to_jsonb(v_pvid),true);
          pt := jsonb_set(pt,'{productoVersionId}',to_jsonb(v_pvid),true);
        end if;
      end if;
    end if;
    out := out || jsonb_build_array(pt);
  end loop;
  return out;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: pin_product_versions_on_cotizacion_write()
-- SECURITY: DEFINER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.pin_product_versions_on_cotizacion_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.partidas := public.pin_product_versions_in_partidas(new.partidas);
  return new;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: producto_cotizable(p_producto_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.producto_cotizable(p_producto_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.producto_cotizable(p_producto_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: puede_certificar_costo()
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.puede_certificar_costo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from public.permitidos
                 where email = (auth.jwt() ->> 'email') and rol in ('direccion'));
$function$
;

-- ============================================================
-- FUNCIÓN: puede_editar_config()
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.puede_editar_config()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.puede_editar_config();
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: puede_entrar()
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.puede_entrar()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.puede_entrar();
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: puede_ver_economia()
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.puede_ver_economia()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.puede_ver_economia();
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: registrar_producto_desde_expediente(p_expediente_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_producto_desde_expediente(p_expediente_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.registrar_producto_desde_expediente(p_expediente_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: registrar_render_canonico(p_producto_id bigint, p_producto_version_id bigint, p_expediente_id bigint, p_storage_path text, p_storage_url text, p_prompt_version text, p_modo text, p_spec_hash text, p_geometry_hash text, p_inputs jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_render_canonico(p_producto_id bigint, p_producto_version_id bigint, p_expediente_id bigint, p_storage_path text, p_storage_url text, p_prompt_version text, p_modo text, p_spec_hash text, p_geometry_hash text, p_inputs jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.registrar_render_canonico(p_producto_id, p_producto_version_id, p_expediente_id, p_storage_path, p_storage_url, p_prompt_version, p_modo, p_spec_hash, p_geometry_hash, p_inputs);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: reglas_comerciales_vigentes(p_fecha date)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.reglas_comerciales_vigentes(p_fecha date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select to_jsonb(r) from public.reglas_comerciales r
  where r.estado='approved' and r.vigencia_desde <= p_fecha and (r.vigencia_hasta is null or r.vigencia_hasta >= p_fecha)
  order by r.version desc limit 1;
$function$
;

-- ============================================================
-- FUNCIÓN: requiere_aprobacion_snapshot(p_snapshot jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.requiere_aprobacion_snapshot(p_snapshot jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.requiere_aprobacion_snapshot(p_snapshot);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: resolve_canonical_price(p_insumo_id text, p_fecha date)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_canonical_price(p_insumo_id text, p_fecha date)
 RETURNS TABLE(status text, price numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with vig as (
    select cost_unit_price_mxn as v
    from public.insumo_precios
    where insumo_id = p_insumo_id
      and contract_status = 'DATA_TRUTH_V1'
      and estado = 'aprobado' and cost_unit_price_mxn is not null
      and (vigente_desde is null or vigente_desde <= p_fecha)
      and (vigente_hasta is null or p_fecha < vigente_hasta)
  ), d as (select distinct v from vig)
  select case when (select count(*) from d) = 0 then 'PENDING_PRICE'
              when (select count(*) from d) > 1 then 'PRICE_AMBIGUOUS'
              else 'CERTIFIED_PRICE' end,
         case when (select count(*) from d) = 1 then (select v from d) else null end;
$function$
;

-- ============================================================
-- FUNCIÓN: resolver_aprobacion(p_id bigint, p_estado text, p_motivo text)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolver_aprobacion(p_id bigint, p_estado text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.resolver_aprobacion(p_id, p_estado, p_motivo);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: resolver_costo_insumo(p_insumo_id text)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolver_costo_insumo(p_insumo_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.resolver_costo_insumo(p_insumo_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: resolver_precio_autorizado(p_producto_id bigint, p_version_id bigint, p_variante_id bigint, p_fecha date, p_moneda text)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolver_precio_autorizado(p_producto_id bigint, p_version_id bigint DEFAULT NULL::bigint, p_variante_id bigint DEFAULT NULL::bigint, p_fecha date DEFAULT CURRENT_DATE, p_moneda text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.resolver_precio_autorizado(p_producto_id, p_version_id, p_variante_id, p_fecha, p_moneda);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: resolver_precio_especial_proyecto(p_producto_id bigint, p_version_id bigint, p_fecha date, p_moneda text)
-- SECURITY: DEFINER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolver_precio_especial_proyecto(p_producto_id bigint, p_version_id bigint, p_fecha date DEFAULT CURRENT_DATE, p_moneda text DEFAULT 'MXN'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prod public.productos%rowtype;
  v_ver public.producto_versiones%rowtype;
  v_exp public.expedientes%rowtype;
  v_eco public.producto_version_economia%rowtype;
  v_cfg jsonb;
  v_rules jsonb;
  v_target numeric;
  v_min numeric;
  v_cost numeric;
  v_price numeric;
  v_floor numeric;
  v_status_raw text;
  v_cost_status text;
  v_state text;
  v_requires_approval boolean := false;
begin
  if p_producto_id is null or p_version_id is null then
    return jsonb_build_object('ok',false,'motivo','producto_version_requeridos');
  end if;
  if coalesce(p_moneda,'MXN') <> 'MXN' then
    return jsonb_build_object('ok',false,'motivo','moneda_no_soportada_especial');
  end if;

  select * into v_prod from public.productos where id=p_producto_id;
  if not found then return jsonb_build_object('ok',false,'motivo','producto_inexistente'); end if;
  if v_prod.source_type is distinct from 'expediente' or coalesce(v_prod.source_ref,'')='' then
    return jsonb_build_object('ok',false,'motivo','no_es_especial_de_proyecto');
  end if;

  select * into v_ver from public.producto_versiones
   where id=p_version_id and producto_id=p_producto_id;
  if not found then return jsonb_build_object('ok',false,'motivo','version_invalida'); end if;
  if v_ver.expediente_id is null or v_ver.expediente_id::text <> v_prod.source_ref then
    return jsonb_build_object('ok',false,'motivo','linaje_especial_invalido');
  end if;

  select * into v_exp from public.expedientes where id=v_ver.expediente_id;
  if not found then return jsonb_build_object('ok',false,'motivo','expediente_inexistente'); end if;
  if v_exp.producto_id is distinct from p_producto_id then
    return jsonb_build_object('ok',false,'motivo','expediente_producto_no_coincide');
  end if;

  select * into v_eco from public.producto_version_economia where producto_version_id=p_version_id;
  if not found or v_eco.costo_oficial_referencia is null or v_eco.costo_oficial_referencia <= 0 then
    return jsonb_build_object('ok',false,'motivo','ECONOMICS_INCOMPLETE','economia_estado','ECONOMICS_INCOMPLETE');
  end if;
  v_cost := v_eco.costo_oficial_referencia;

  v_status_raw := lower(coalesce(
    v_exp.costo->>'estado_costo',
    v_exp.cocrear#>>'{costSnapshot,status}',
    v_exp.cocrear#>>'{costo,status}',
    ''
  ));
  v_cost_status := case
    when v_status_raw in ('known','conocido','certificado','certified','completo','complete') then 'KNOWN'
    when v_status_raw in ('estimated','estimado','preliminar','preliminary') then 'ESTIMATED'
    when v_status_raw in ('user_approved_estimate','user-approved-estimate','estimado_aprobado_usuario') then 'USER_APPROVED_ESTIMATE'
    when v_status_raw in ('pending_price','pending material','pending_material','pending','unknown','incompleto','economics_incomplete','') then 'ECONOMICS_INCOMPLETE'
    else 'ECONOMICS_INCOMPLETE'
  end;
  if v_cost_status='ECONOMICS_INCOMPLETE' then
    return jsonb_build_object('ok',false,'motivo','ECONOMICS_INCOMPLETE','economia_estado',v_cost_status);
  end if;

  select datos into v_cfg from public.config where id='vonhaucke';
  v_rules := public.reglas_comerciales_vigentes(coalesce(p_fecha,current_date));
  begin v_target := nullif(v_cfg#>>'{parametros,margenObjetivo}','')::numeric; exception when others then v_target:=null; end;
  begin v_min := nullif(v_rules->>'margen_minimo_pct','')::numeric; exception when others then v_min:=null; end;
  if v_target is null or v_target < 0 or v_target >= 100 or v_min is null or v_min < 0 or v_min >= 100 then
    return jsonb_build_object('ok',false,'motivo','politica_comercial_invalida');
  end if;
  if v_target < v_min then
    return jsonb_build_object('ok',false,'motivo','margen_objetivo_debajo_del_minimo');
  end if;

  v_price := round(v_cost / (1 - v_target/100));
  v_floor := ceil(v_cost / (1 - v_min/100));
  if v_price <= 0 or v_floor <= 0 then
    return jsonb_build_object('ok',false,'motivo','precio_especial_invalido');
  end if;

  if v_ver.estado_tecnico='preliminar' then
    v_state := 'PRELIMINARY_SPECIAL';
    v_requires_approval := true;
  elsif v_ver.estado_tecnico in ('aprobado','certificado') then
    v_state := 'AUTHORIZED_PROJECT_SPECIAL';
    v_requires_approval := v_cost_status <> 'KNOWN';
  else
    return jsonb_build_object('ok',false,'motivo','estado_tecnico_no_cotizable','estado_tecnico',v_ver.estado_tecnico);
  end if;

  -- Esta función es INTERNAL-ONLY: costo/piso sirven al motor y al gate, nunca se exponen directo al vendedor.
  return jsonb_build_object(
    'ok',true,
    'producto_id',p_producto_id,
    'version_id',p_version_id,
    'expediente_id',v_ver.expediente_id,
    'precio_lista',v_price,
    'moneda','MXN',
    'precio_fuente','COST_SNAPSHOT_PROJECT_SPECIAL',
    'commercial_state',v_state,
    'estado_tecnico',v_ver.estado_tecnico,
    'economia_estado',v_cost_status,
    'requiere_aprobacion',v_requires_approval,
    'costo_interno',v_cost,
    'piso_minimo_interno',v_floor,
    'margen_objetivo_interno',v_target,
    'margen_minimo_interno',v_min,
    'formula_version',v_eco.formula_version,
    'fuente_costo',v_eco.fuente
  );
end;
$function$
;

-- ============================================================
-- FUNCIÓN: resolver_renders_canonicos(p_version_ids bigint[])
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolver_renders_canonicos(p_version_ids bigint[])
 RETURNS TABLE(producto_id bigint, producto_version_id bigint, estado text, stale boolean, storage_url text, creado timestamp with time zone, prompt_version text, geometry_hash text, modo text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return query select * from private_api.resolver_renders_canonicos(p_version_ids);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: revisiones_autor()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.revisiones_autor()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  ident text := coalesce(nullif(claims->>'email', ''), nullif(claims->>'sub', ''));
begin
  if (tg_op = 'INSERT') then
    new.usuario := ident;
  elsif (tg_op = 'UPDATE') then
    new.usuario := old.usuario;
  end if;
  return new;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: revisiones_seguras(p_cotizacion_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.revisiones_seguras(p_cotizacion_id bigint)
 RETURNS TABLE(revision integer, total numeric, hash text, snapshot jsonb, emitida_en timestamp with time zone, tipo text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return query select * from private_api.revisiones_seguras(p_cotizacion_id);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: solicitar_aprobacion(p_cotizacion_id bigint, p_revision_hash text, p_descuento numeric, p_motivo text)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.solicitar_aprobacion(p_cotizacion_id bigint, p_revision_hash text, p_descuento numeric DEFAULT NULL::numeric, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.solicitar_aprobacion(p_cotizacion_id, p_revision_hash, p_descuento, p_motivo);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: solicitar_aprobacion_snapshot(p_cotizacion_id bigint, p_snapshot jsonb, p_motivo text)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.solicitar_aprobacion_snapshot(p_cotizacion_id bigint, p_snapshot jsonb, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.solicitar_aprobacion_snapshot(p_cotizacion_id, p_snapshot, p_motivo);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: spatial_specs_para_versiones(p_version_ids bigint[])
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.spatial_specs_para_versiones(p_version_ids bigint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_ids bigint[] := coalesce(p_version_ids, array[]::bigint[]);
begin
  if auth.uid() is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  if coalesce(array_length(v_ids,1),0) > 500 then
    raise exception 'demasiadas versiones solicitadas';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'version_id', pv.id,
        'spatial_spec', pv.atributos->'spatial_spec'
      ) order by pv.id
    )
    from public.producto_versiones pv
    where pv.id = any(v_ids)
      and jsonb_typeof(pv.atributos->'spatial_spec') = 'object'
  ), '[]'::jsonb);
end;
$function$
;

-- ============================================================
-- FUNCIÓN: strip_seller_economics_on_cotizacion_write()
-- SECURITY: DEFINER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.strip_seller_economics_on_cotizacion_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_is_seller boolean := false;
begin
  if v_email is null then
    return new;
  end if;

  select exists(
    select 1 from public.permitidos p
    where lower(p.email)=lower(v_email) and lower(p.rol)='vendedor'
  ) into v_is_seller;

  if v_is_seller and not public.puede_ver_economia() then
    new.partidas := public.jsonb_sin_economia(new.partidas);
    new.totales := public.jsonb_sin_economia(new.totales);
    new.acomodo := public.jsonb_sin_economia(new.acomodo);
  end if;
  return new;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: strip_seller_economics_on_revision_write()
-- SECURITY: DEFINER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.strip_seller_economics_on_revision_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_is_seller boolean := false;
begin
  if v_email is null then return new; end if;
  select exists(
    select 1 from public.permitidos p
    where lower(p.email)=lower(v_email) and lower(p.rol)='vendedor'
  ) into v_is_seller;
  if v_is_seller and not public.puede_ver_economia() then
    new.snapshot := public.jsonb_sin_economia(new.snapshot);
  end if;
  return new;
end;
$function$
;

-- ============================================================
-- FUNCIÓN: sync_precio_legacy()
-- SECURITY: INVOKER
-- TIPO: function (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_precio_legacy()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uc text;
begin
  if NEW.contract_status = 'DATA_TRUTH_V1' then
    select unidad_costeo into v_uc from public.insumos_catalogo where id = NEW.insumo_id;
    if v_uc is not null and NEW.cost_unit is not null and NEW.cost_unit <> v_uc then
      raise exception 'cost_unit (%) != unidad_costeo (%) del insumo %', NEW.cost_unit, v_uc, NEW.insumo_id;
    end if;
    NEW.unidad_compra     := NEW.source_unit;
    NEW.precio_compra     := NEW.source_price;
    NEW.factor_conversion := NEW.source_units_per_cost_unit;
    NEW.precio            := NEW.source_price * coalesce(NEW.fx_rate,1) * NEW.source_units_per_cost_unit;
  end if;
  return NEW;
end $function$
;

-- ============================================================
-- FUNCIÓN: verificar_aprobacion(p_cotizacion_id bigint, p_revision_hash text)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.verificar_aprobacion(p_cotizacion_id bigint, p_revision_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.verificar_aprobacion(p_cotizacion_id, p_revision_hash);
      end
      $function$
;

-- ============================================================
-- FUNCIÓN: verificar_render_canonico(p_render_id bigint, p_geometry text, p_features text, p_finish text, p_evidence jsonb)
-- SECURITY: INVOKER
-- TIPO: function
-- COMMENT: Human render verification gate. Only Diseño/Dirección; VALIDATED requires geometry/features/finish PASS, non-stale canonical identity, and explicit evidence.
-- ============================================================
CREATE OR REPLACE FUNCTION public.verificar_render_canonico(p_render_id bigint, p_geometry text DEFAULT 'PASS'::text, p_features text DEFAULT 'PASS'::text, p_finish text DEFAULT 'PASS'::text, p_evidence jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_uid uuid := auth.uid();
  v_r public.renders%rowtype;
  v_g text := upper(coalesce(p_geometry,'NOT_VERIFIED'));
  v_f text := upper(coalesce(p_features,'NOT_VERIFIED'));
  v_fin text := upper(coalesce(p_finish,'NOT_VERIFIED'));
  v_valid boolean;
  v_estado text;
begin
  if v_uid is null or coalesce(v_email,'')='' then
    raise exception 'no autenticado';
  end if;

  -- Sólo Diseño/Dirección pueden certificar que una imagen representa la revisión.
  if not public.puede_editar_config() then
    raise exception 'sin permiso para validar renders';
  end if;

  if v_g not in ('PASS','FAIL','NOT_VERIFIED')
     or v_f not in ('PASS','FAIL','NOT_VERIFIED')
     or v_fin not in ('PASS','FAIL','NOT_VERIFIED') then
    raise exception 'estado de validación inválido';
  end if;

  select * into v_r from public.renders where id=p_render_id for update;
  if not found then raise exception 'render inexistente'; end if;

  if v_r.producto_id is null or v_r.producto_version_id is null
     or coalesce(v_r.spec_hash,'')='' or coalesce(v_r.geometry_hash,'')='' then
    raise exception 'render sin identidad canónica completa';
  end if;

  v_valid := (not v_r.stale and v_g='PASS' and v_f='PASS' and v_fin='PASS');
  if v_valid and coalesce(trim(p_evidence->>'confirmation'),'')='' then
    raise exception 'se requiere evidencia/confirmación humana para validar';
  end if;

  v_estado := case when v_valid then 'VALIDATED' else 'REVIEW_REQUIRED' end;

  update public.renders
  set geometry_validation=v_g,
      feature_validation=v_f,
      finish_validation=v_fin,
      estado=v_estado,
      inputs=coalesce(inputs,'{}'::jsonb) || jsonb_build_object(
        '_validation',
        jsonb_build_object(
          'validated_by',v_email,
          'validated_at',now(),
          'geometry',v_g,
          'features',v_f,
          'finish',v_fin,
          'evidence',coalesce(p_evidence,'{}'::jsonb)
        )
      )
  where id=p_render_id;

  return jsonb_build_object(
    'ok',true,
    'render_id',p_render_id,
    'estado',v_estado,
    'geometry_validation',v_g,
    'feature_validation',v_f,
    'finish_validation',v_fin,
    'stale',v_r.stale,
    'validated',v_valid
  );
end;
$function$
;

-- ============================================================
-- FUNCIÓN: vincular_cotizacion(p_cotizacion_id bigint, p_cliente_id bigint, p_contacto_id bigint, p_proyecto_id bigint)
-- SECURITY: INVOKER
-- TIPO: function
-- ============================================================
CREATE OR REPLACE FUNCTION public.vincular_cotizacion(p_cotizacion_id bigint, p_cliente_id bigint DEFAULT NULL::bigint, p_contacto_id bigint DEFAULT NULL::bigint, p_proyecto_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.vincular_cotizacion(p_cotizacion_id, p_cliente_id, p_contacto_id, p_proyecto_id);
      end
      $function$
;
