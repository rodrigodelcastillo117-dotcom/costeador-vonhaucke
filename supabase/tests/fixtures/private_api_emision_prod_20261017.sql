-- Compuerta de emisión VIVA en producción (pg_get_functiondef), leída el 2026-10-17, proyecto mtuvnbgljwbsaizjjgzs.
-- Es la de P0-01 (supabase/migrations/PROPUESTA_p0_01_reventa_emite_sin_costo.sql, aplicada el 2026-10-16) sin comentarios:
--   md5(prosrc)               = 05282c24ba5bddc76f4a5290df3a80cf
--   md5(pg_get_functiondef)   = 17ec67cf8bf06b540a55279288e90025
-- Se carga DESPUÉS de private_api_emision_prod_20261013.sql para que las pruebas partan de producción de hoy.
-- Incluye la columna de política que P0-01 agregó a reglas_comerciales (default true, igual que en producción).

alter table public.reglas_comerciales add column if not exists reventa_emite_sin_costo boolean not null default true;

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
  v_reventa_policy boolean := false; v_reventa boolean := false; v_rev_lista numeric; v_rev_piso numeric;
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
  begin v_reventa_policy := coalesce((v_rules->>'reventa_emite_sin_costo')::boolean, false); exception when others then v_reventa_policy := false; end;

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
    v_reventa:=false; v_rev_lista:=null; v_rev_piso:=null;

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
        if v_cost_ref is not null and v_cost_ref>0 then
          v_cost:=v_cost_ref;
        elsif v_reventa_policy and v_prod_source in ('banco','linea') then
          select lpi.precio_lista, lpi.piso_minimo into v_rev_lista, v_rev_piso
            from public.lista_precio_items lpi
           where lpi.producto_id = v_pid and lpi.vigencia_hasta is null
           order by lpi.precio_lista desc nulls last limit 1;
          if v_rev_lista is null or v_rev_lista<=0 then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord));
          else
            if v_rev_piso is not null and v_rev_piso>0 and v_price is not null and v_price>0 and v_price<v_rev_piso then
              v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_precio_bajo_piso',v_ord));
            end if;
            v_reventa:=true;
          end if;
        else
          v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord));
        end if;
      end if;
    else
      begin v_cost:=nullif(v_dbpt->>'costoUnitario','')::numeric; exception when others then v_cost:=null; end;

      if lower(coalesce(v_dbpt->>'costoEstado','')) = 'preliminar' then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_preliminar_no_certificado',v_ord));
      elsif lower(coalesce(v_dbpt->>'costoEstado','')) in ('incompleto','bloqueado') then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_no_certificado',v_ord));
      end if;
    end if;

    if v_reventa then
      null;
    elsif v_cost is null or v_cost<=0 then
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
$function$;
