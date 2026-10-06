-- Von Haucke · emisión exacta a centavos
-- Preparado en RC; aplicar sólo en corte final después de CI.
-- NO cambia políticas, permisos, márgenes, fuentes de costo ni aprobaciones.
-- Sólo elimina tolerancias/redondeos a peso en el gate/emisión autoritativos.
-- Idempotente: CREATE OR REPLACE de las funciones privadas existentes.

CREATE OR REPLACE FUNCTION private_api.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_c public.cotizaciones%rowtype;
  v_reasons text[] := '{}';
  v_econ_reasons text[] := '{}';
  v_approval_reasons text[] := '{}';
  v_hash text;
  v_requires_approval boolean := false;
  v_approved boolean := false;
  v_count int; v_db_count int;
  v_pt jsonb; v_dbpt jsonb; v_ord bigint;
  v_qty numeric; v_price numeric; v_cost numeric;
  v_pid_txt text; v_pvid_txt text; v_pvid bigint; v_pid bigint; v_cost_ref numeric;
  v_snap_identity text; v_db_identity text;
  v_rules jsonb; v_min_margin numeric;
  v_margin numeric;
  v_prod_source text; v_pv_state text;
  v_special jsonb; v_special_cost_state text; v_special_commercial_state text;
  v_desc numeric; v_expected_price numeric;
begin
  if v_email is null or not public.puede_entrar() then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('no_autorizado'));
  end if;

  select * into v_c from public.cotizaciones where id=p_cotizacion_id;
  if not found then return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('cotizacion_no_existe')); end if;
  if not (v_c.usuario=v_email or public.puede_editar_config()) then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('sin_permiso'));
  end if;

  if p_snapshot is null or jsonb_typeof(coalesce(p_snapshot->'partidas','null'::jsonb)) <> 'array' then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('snapshot_sin_partidas'));
  end if;

  v_rules := public.reglas_comerciales_vigentes(current_date);
  begin v_min_margin := nullif(v_rules->>'margen_minimo_pct','')::numeric; exception when others then v_min_margin:=null; end;
  if v_min_margin is null then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('politica_comercial_sin_margen_minimo'));
  end if;

  v_count := jsonb_array_length(p_snapshot->'partidas');
  v_db_count := jsonb_array_length(coalesce(v_c.partidas,'[]'::jsonb));
  if v_count=0 then v_reasons := array_append(v_reasons,'snapshot_sin_partidas'); end if;
  if v_count<>v_db_count then v_reasons := array_append(v_reasons,'partidas_no_corresponden_a_cotizacion'); end if;

  for v_pt, v_ord in select value, ordinality from jsonb_array_elements(p_snapshot->'partidas') with ordinality loop
    begin v_qty := nullif(v_pt->>'cantidad','')::numeric; exception when others then v_qty:=null; end;
    begin v_price := nullif(v_pt->>'precioUnitario','')::numeric; exception when others then v_price:=null; end;
    if v_qty is null or v_qty<=0 then v_reasons:=array_append(v_reasons,format('linea_%s_cantidad_invalida',v_ord)); end if;
    if v_price is null or v_price<=0 then v_reasons:=array_append(v_reasons,format('linea_%s_precio_invalido',v_ord)); end if;

    select value into v_dbpt from jsonb_array_elements(coalesce(v_c.partidas,'[]'::jsonb)) with ordinality d(value,ord) where ord=v_ord;
    if v_dbpt is null then v_reasons:=array_append(v_reasons,format('linea_%s_sin_correspondencia',v_ord)); continue; end if;

    v_snap_identity := coalesce(nullif(v_pt->>'id',''),nullif(v_pt->>'piezaId',''),nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'nombre',''));
    v_db_identity := coalesce(nullif(v_dbpt->>'id',''),nullif(v_dbpt->>'piezaId',''),nullif(v_dbpt->>'producto_id',''),nullif(v_dbpt->>'productoId',''),nullif(v_dbpt->>'nombre',''));
    if v_snap_identity is null or v_db_identity is null or v_snap_identity<>v_db_identity then
      v_reasons:=array_append(v_reasons,format('linea_%s_identidad_no_coincide',v_ord)); continue;
    end if;

    v_pid_txt := coalesce(nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'product_id',''));
    v_pvid_txt := coalesce(nullif(v_pt->>'producto_version_id',''),nullif(v_pt->>'productoVersionId',''),nullif(v_pt->>'product_version_id',''));
    v_cost_ref:=null; v_pvid:=null; v_pid:=null; v_cost:=null; v_prod_source:=null; v_pv_state:=null; v_special:=null;

    -- Dos mundos explícitos:
    -- 1) canónico: producto_id y producto_version_id numéricos;
    -- 2) legacy: clave textual sin ProductVersion, cuyo costo histórico se toma SOLO de la fila persistida.
    if v_pid_txt is not null then
      if v_pid_txt ~ '^[0-9]+$' then
        v_pid:=v_pid_txt::bigint;
      elsif v_pvid_txt is not null then
        v_reasons:=array_append(v_reasons,format('linea_%s_producto_id_invalido',v_ord));
      end if;
    end if;

    if v_pvid_txt is not null then
      if v_pvid_txt ~ '^[0-9]+$' then
        v_pvid:=v_pvid_txt::bigint;
      else
        v_reasons:=array_append(v_reasons,format('linea_%s_producto_version_id_invalido',v_ord));
      end if;
    end if;

    if v_pid is not null and v_pvid is null then
      v_reasons:=array_append(v_reasons,format('linea_%s_sin_product_version_id',v_ord));
    elsif v_pid is null and v_pvid is not null then
      v_reasons:=array_append(v_reasons,format('linea_%s_sin_product_id',v_ord));
    end if;

    if v_pid is not null and v_pvid is not null then
      select p.source_type,pv.estado_tecnico,e.costo_oficial_referencia
        into v_prod_source,v_pv_state,v_cost_ref
      from public.productos p
      join public.producto_versiones pv on pv.producto_id=p.id and pv.id=v_pvid
      left join public.producto_version_economia e on e.producto_version_id=pv.id
      where p.id=v_pid;
      if not found then
        v_reasons:=array_append(v_reasons,format('linea_%s_product_version_no_corresponde',v_ord));
      elsif v_prod_source='expediente' then
        v_special := public.resolver_precio_especial_proyecto(v_pid,v_pvid,current_date,coalesce(nullif(v_pt->>'moneda',''),'MXN'));
        if not coalesce((v_special->>'ok')::boolean,false) then
          if v_special->>'motivo'='ECONOMICS_INCOMPLETE' then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_especial_desconocido',v_ord));
          else
            v_reasons:=array_append(v_reasons,format('linea_%s_especial_%s',v_ord,coalesce(v_special->>'motivo','invalido')));
          end if;
        else
          v_special_cost_state:=v_special->>'economia_estado';
          v_special_commercial_state:=v_special->>'commercial_state';
          begin v_cost:=nullif(v_special->>'costo_interno','')::numeric; exception when others then v_cost:=null; end;
          if v_special_commercial_state='PRELIMINARY_SPECIAL' then
            v_reasons:=array_append(v_reasons,format('linea_%s_ingenieria_preliminar',v_ord));
          end if;
          if v_special_cost_state in ('ESTIMATED','USER_APPROVED_ESTIMATE') then
            v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_costo_especial_no_certificado',v_ord));
          elsif v_special_cost_state is null or v_special_cost_state='ECONOMICS_INCOMPLETE' then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_especial_desconocido',v_ord));
          end if;

          begin v_desc:=coalesce(nullif(v_pt->>'descuento',''),nullif(v_pt->>'descuento_solicitado',''),'0')::numeric; exception when others then v_desc:=null; end;
          if v_desc is null or v_desc<0 or v_desc>100 then
            v_reasons:=array_append(v_reasons,format('linea_%s_descuento_invalido',v_ord));
          elsif v_price is not null and v_price>0 then
            v_expected_price:=round((v_special->>'precio_lista')::numeric*(1-v_desc/100),2);
            if round(v_price,2)<>v_expected_price then
              v_reasons:=array_append(v_reasons,format('linea_%s_precio_especial_no_autoritativo',v_ord));
            end if;
          end if;
        end if;
      else
        if v_cost_ref is not null and v_cost_ref>0 then v_cost:=v_cost_ref;
        else v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord)); end if;
      end if;
    else
      -- Sólo legacy sin ProductVersion: nunca se confía en el costo del snapshot recibido;
      -- se usa exclusivamente el costo histórico persistido en la cotización.
      begin v_cost:=nullif(v_dbpt->>'costoUnitario','')::numeric; exception when others then v_cost:=null; end;
    end if;

    if v_cost is null or v_cost<=0 then
      if not (v_pid is not null and cardinality(v_econ_reasons)>0) then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_desconocido',v_ord));
      end if;
    elsif v_price is not null and v_price>0 then
      v_margin := ((v_price-v_cost)/v_price)*100;
      if v_price < v_cost then
        v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_precio_bajo_costo',v_ord));
      elsif v_margin < v_min_margin then
        v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_margen_bajo_%s',v_ord,trim(to_char(v_min_margin,'FM999990D99'))));
      end if;
    end if;
  end loop;

  select coalesce(array_agg(distinct x),'{}'::text[]) into v_reasons from unnest(v_reasons) x;
  select coalesce(array_agg(distinct x),'{}'::text[]) into v_econ_reasons from unnest(v_econ_reasons) x;
  select coalesce(array_agg(distinct x),'{}'::text[]) into v_approval_reasons from unnest(v_approval_reasons) x;

  v_hash := public.hash_revision(p_snapshot);
  v_requires_approval := public.requiere_aprobacion_snapshot(p_snapshot) or cardinality(v_approval_reasons)>0;
  if v_requires_approval then
    v_approved := coalesce((public.verificar_aprobacion(p_cotizacion_id,v_hash)->>'aprobada')::boolean,false);
  else v_approved:=true; end if;

  if cardinality(v_reasons)>0 then
    return jsonb_build_object('state','BLOCKED','reasons',to_jsonb(v_reasons),'economics',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
  end if;
  if cardinality(v_econ_reasons)>0 then
    return jsonb_build_object('state','ECONOMICS_INCOMPLETE','reasons',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
  end if;
  if not v_approved then
    return jsonb_build_object('state','APPROVAL_REQUIRED','reasons',case when cardinality(v_approval_reasons)>0 then to_jsonb(v_approval_reasons) else jsonb_build_array('aprobacion_requerida_para_hash') end,'hash',v_hash,'approval_required',true,'approved',false,'margen_minimo_pct',v_min_margin);
  end if;
  return jsonb_build_object('state','ALLOWED','reasons','[]'::jsonb,'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
end;
$function$
;

CREATE OR REPLACE FUNCTION private_api.emitir_revision_v2(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  ident text := coalesce(nullif(claims->>'email',''), nullif(claims->>'sub',''));
  v_folio text; v_cliente text; v_puede boolean; v_malas int;
  v_desc_max numeric; v_reglas jsonb; v_requiere_aprobacion_linea boolean := false;
  v_pl_exact numeric; l_pl numeric; l_desc numeric; l_cont numeric; l_man numeric; l_flete numeric; l_iva numeric;
  v_total numeric; v_claim numeric; v_hash text; v_last_hash text; v_last_rev int; v_rev int;
  pt jsonb; v_res jsonb; v_special jsonb; v_pl_auth numeric; v_desc numeric; v_pf_auth numeric; v_pu numeric; v_pid bigint;
  v_pid_txt text; v_ver_txt text; v_var_txt text; v_lpi_txt text;
  v_gate jsonb; v_state text; v_is_special boolean;
begin
  if p_cotizacion_id is null then raise exception 'emitir_revision_v2: se requiere cotizacion_id'; end if;
  if p_snapshot is null or jsonb_array_length(coalesce(p_snapshot->'partidas','[]'::jsonb)) = 0 then
    raise exception 'emitir_revision_v2: snapshot sin partidas';
  end if;

  select c.folio, c.cliente, (c.usuario = ident or public.puede_editar_config())
    into v_folio, v_cliente, v_puede from public.cotizaciones c where c.id = p_cotizacion_id;
  if not found then raise exception 'emitir_revision_v2: la cotizacion % no existe', p_cotizacion_id; end if;
  if v_puede is not true then raise exception 'emitir_revision_v2: sin permiso sobre la cotizacion %', p_cotizacion_id; end if;

  -- Gate único: integridad + economía + aprobación para el hash exacto.
  v_gate := public.evaluar_emision_cotizacion(p_cotizacion_id,p_snapshot);
  v_state := v_gate->>'state';
  if v_state <> 'ALLOWED' then
    raise exception 'emitir_revision_v2: emisión bloqueada [%]: %', v_state, coalesce((v_gate->'reasons')::text,'[]');
  end if;

  select count(*) into v_malas from jsonb_array_elements(p_snapshot->'partidas') x
    where coalesce((x->>'precioUnitario')::numeric,0) <= 0 or coalesce((x->>'cantidad')::numeric,0) <= 0;
  if v_malas > 0 then raise exception 'emitir_revision_v2: % renglon(es) sin precio o cantidad validos', v_malas; end if;

  v_reglas := public.reglas_comerciales_vigentes(current_date);
  v_desc_max := coalesce((v_reglas->>'descuento_max_sin_aprobacion')::numeric, 0);

  for pt in select * from jsonb_array_elements(p_snapshot->'partidas') loop
    v_pid_txt := coalesce(nullif(pt->>'producto_id',''), nullif(pt->>'productoId',''));
    if v_pid_txt is not null then
      v_pid := v_pid_txt::bigint;
      v_ver_txt := coalesce(nullif(pt->>'producto_version_id',''), nullif(pt->>'productoVersionId',''), nullif(pt->>'product_version_id',''));
      v_var_txt := coalesce(nullif(pt->>'variante_id',''), nullif(pt->>'varianteId',''));
      v_lpi_txt := coalesce(nullif(pt->>'lista_precio_item_id',''), nullif(pt->>'listaPrecioItemId',''));
      if v_ver_txt is null then
        raise exception 'emitir_revision_v2: producto % sin product_version_id canónico', v_pid;
      end if;

      v_is_special := false;
      v_res := public.resolver_precio_autorizado(
        v_pid,
        v_ver_txt::bigint,
        case when v_var_txt is null then null else v_var_txt::bigint end,
        current_date,
        coalesce(nullif(pt->>'moneda',''), 'MXN')
      );

      if not coalesce((v_res->>'ok')::boolean,false) then
        if v_var_txt is not null then
          raise exception 'emitir_revision_v2: producto % sin precio autorizado (%)', v_pid, coalesce(v_res->>'motivo','?');
        end if;
        v_special := public.resolver_precio_especial_proyecto(
          v_pid,
          v_ver_txt::bigint,
          current_date,
          coalesce(nullif(pt->>'moneda',''), 'MXN')
        );
        if not coalesce((v_special->>'ok')::boolean,false) then
          raise exception 'emitir_revision_v2: producto % sin precio autorizado ni especial válido (%)', v_pid, coalesce(v_special->>'motivo',v_res->>'motivo','?');
        end if;
        if v_special->>'commercial_state' <> 'AUTHORIZED_PROJECT_SPECIAL' then
          raise exception 'emitir_revision_v2: especial % aún no tiene ingeniería aprobada (%)', v_pid, coalesce(v_special->>'commercial_state','?');
        end if;
        v_res := v_special;
        v_is_special := true;
      end if;

      v_pl_auth := (v_res->>'precio_lista')::numeric;
      begin v_desc := coalesce(nullif(pt->>'descuento',''),nullif(pt->>'descuento_solicitado',''),'0')::numeric; exception when others then v_desc:=null; end;
      if v_desc is null or v_desc < 0 or v_desc > 100 then raise exception 'emitir_revision_v2: descuento invalido en producto %', v_pid; end if;
      if v_desc > v_desc_max then v_requiere_aprobacion_linea := true; end if;
      if v_is_special and v_res->>'economia_estado' in ('ESTIMATED','USER_APPROVED_ESTIMATE') then v_requiere_aprobacion_linea := true; end if;

      v_pf_auth := round(v_pl_auth * (1 - v_desc/100),2);
      v_pu := round((pt->>'precioUnitario')::numeric,2);
      if v_pu <> v_pf_auth then
        raise exception 'emitir_revision_v2: precioUnitario (%) != precio autoritativo (%) en producto %', v_pu, v_pf_auth, v_pid;
      end if;

      if v_is_special then
        if v_lpi_txt is not null then
          raise exception 'emitir_revision_v2: un especial de proyecto no debe traer lista_precio_item_id (%)', v_lpi_txt;
        end if;
      elsif v_lpi_txt is not null and v_lpi_txt::bigint <> (v_res->>'lista_precio_item_id')::bigint then
        raise exception 'emitir_revision_v2: lista_precio_item_id no coincide en producto %', v_pid;
      end if;
    end if;
  end loop;

  l_pl    := coalesce((p_snapshot#>>'{totales,precioLista}')::numeric, 0);
  l_desc  := coalesce((p_snapshot#>>'{totales,descuento}')::numeric, 0);
  l_cont  := coalesce((p_snapshot#>>'{totales,contingencia}')::numeric, 0);
  l_man   := coalesce((p_snapshot#>>'{totales,maniobras}')::numeric, 0);
  l_flete := coalesce((p_snapshot#>>'{totales,flete}')::numeric, 0);
  l_iva   := coalesce((p_snapshot#>>'{totales,iva}')::numeric, 0);
  v_total := l_pl - l_desc + l_cont + l_man + l_flete + l_iva;
  v_claim := (p_snapshot->>'total')::numeric;
  if v_claim is null or v_claim <> v_total then
    raise exception 'emitir_revision_v2: el total (%) no es la suma exacta del desglose (%)', v_claim, v_total;
  end if;
  v_pl_exact := coalesce((select sum(round((x->>'precioUnitario')::numeric*(x->>'cantidad')::numeric,2))
                          from jsonb_array_elements(p_snapshot->'partidas') x),0);
  if round(l_pl,2) <> round(v_pl_exact,2) then
    raise exception 'emitir_revision_v2: precioLista (%) no coincide con la suma de partidas (%)', l_pl, round(v_pl_exact,2);
  end if;

  v_hash := public.hash_revision(p_snapshot);
  if v_requiere_aprobacion_linea or public.requiere_aprobacion_snapshot(p_snapshot) then
    if not coalesce((public.verificar_aprobacion(p_cotizacion_id, v_hash)->>'aprobada')::boolean, false) then
      raise exception 'emitir_revision_v2: aprobación de Dirección no vigente para esta versión exacta';
    end if;
  end if;

  perform pg_advisory_xact_lock(p_cotizacion_id);
  select hash, revision into v_last_hash, v_last_rev
    from public.cotizaciones_revisiones where cotizacion_id = p_cotizacion_id order by revision desc limit 1;
  if v_last_hash is not null and v_last_hash = v_hash then
    return jsonb_build_object('revision', v_last_rev, 'nueva', false, 'total', v_total, 'v', 2, 'gate','ALLOWED');
  end if;
  v_rev := coalesce(v_last_rev,0) + 1;
  insert into public.cotizaciones_revisiones (cotizacion_id, folio, cliente, revision, usuario, total, hash, snapshot, tipo)
    values (p_cotizacion_id, v_folio, v_cliente, v_rev, ident, v_total, v_hash, p_snapshot, 'generado_v2');
  return jsonb_build_object('revision', v_rev, 'nueva', true, 'total', v_total, 'v', 2, 'gate','ALLOWED');
end;
$function$
;
