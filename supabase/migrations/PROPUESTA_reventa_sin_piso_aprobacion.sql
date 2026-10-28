-- ============================================================================
--  REVENTA SIN PISO → APROBACIÓN (no ALLOWED en silencio).
--  APLICADA en producción (mtuvnbgljwbsaizjjgzs) el 2026-10-28 por instrucción de Dirección
--  ("lo mejor, tú decide" → Path A: cobertura completa de ramas antes de aplicar), con prueba
--  PGlite 8/8 (supabase/tests/reventaSinPiso.test.js). md5 previo 8d12115f → md5 nuevo 8c23d98a.
--  Verificado en prod: guard presente, VH-AUD-205 + SEG-01 conservados.
--
--  Problema (medido en prod 2026-10-28): de 1,938 ítems de lista vigentes, 298 (15%) NO
--  tienen `piso_minimo`. En reventa (catálogo sin costo interno) el gate usa el piso como
--  tope duro: por debajo del piso exige aprobación. Pero cuando el piso es NULL, ese guard
--  no dispara y la línea emite a CUALQUIER precio en ALLOWED silencioso — sin costo y sin
--  piso que proteja la economía. Es el único hueco económico real de la ruta de reventa.
--
--  Fix (fail-closed, consistente con el diseño existente): si un ítem de reventa NO tiene
--  piso, la emisión EXIGE APROBACIÓN de Dirección (motivo `linea_N_reventa_sin_piso`), en vez
--  de permitir en silencio. No inventa piso ni costo. En cuanto Compras cargue el piso real
--  (o el costo), el SKU vuelve solo a su ruta normal.
--
--  Base: definición VIVA de prod (md5 8d12115f..., con VH-AUD-205 + SEG-01). ÚNICO cambio de
--  lógica: el bloque `else` de reventa (marcado "CAMBIO reventa_sin_piso"). Todo lo demás es
--  idéntico y está cubierto por la prueba de comportamiento (supabase/tests/reventaSinPiso.test.js).
--
--  REVERSIBLE: re-crear la función sin el guard, o apagar la política
--  (update public.reglas_comerciales set reventa_emite_sin_costo=false where estado='approved').
-- ============================================================================
begin;

create or replace function private_api.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
  -- P0-01 reventa de catálogo sin costo interno:
  v_reventa_policy boolean := false; v_reventa boolean := false; v_rev_lista numeric; v_rev_piso numeric;
  v_lpi_txt text; v_lpi_n int; v_lpi_bloq boolean;   -- VH-AUD-205
  -- SEG-01: campos no comerciales del renglón que no corresponden a la fila guardada.
  v_campos text[]; v_discrepancias jsonb := '{}'::jsonb;
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

    -- SEG-01: el renglón del snapshot debe ser la fila guardada en TODO lo no comercial (sólo
    -- pueden diferir precio y descuento). Una cantidad distinta también bloquea.
    v_campos := private_api.campos_partida_no_corresponden(v_pt, v_dbpt);
    if cardinality(v_campos)>0 then
      v_reasons:=array_append(v_reasons,format('linea_%s_no_corresponde_a_lo_costeado',v_ord));
      v_discrepancias:=v_discrepancias || jsonb_build_object(format('linea_%s',v_ord), to_jsonb(v_campos));
      continue;
    end if;

    v_pid_txt := coalesce(nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'product_id',''));
    v_pvid_txt := coalesce(nullif(v_pt->>'producto_version_id',''),nullif(v_pt->>'productoVersionId',''),nullif(v_pt->>'product_version_id',''));
    v_cost_ref:=null; v_pvid:=null; v_pid:=null; v_cost:=null; v_prod_source:=null; v_pv_state:=null; v_special:=null;
    v_reventa:=false; v_rev_lista:=null; v_rev_piso:=null;

    -- 1) canónico: producto_id y producto_version_id numéricos;  2) legacy: clave textual sin ProductVersion.
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
          -- P0-01 / VH-AUD-205: reventa a precio de lista EXACTO de esta partida (nunca "el más alto").
          v_lpi_txt := coalesce(nullif(v_dbpt->>'lista_precio_item_id',''), nullif(v_dbpt->>'listaPrecioItemId',''));
          v_rev_lista := null; v_rev_piso := null; v_lpi_bloq := false;
          if v_lpi_txt is not null then
            if v_lpi_txt !~ '^[0-9]+$' then
              v_reasons:=array_append(v_reasons,format('linea_%s_lista_precio_item_invalido',v_ord)); v_lpi_bloq := true;
            else
              select lpi.precio_lista, lpi.piso_minimo into v_rev_lista, v_rev_piso
                from public.lista_precio_items lpi
               where lpi.id = v_lpi_txt::bigint and lpi.producto_id = v_pid and lpi.producto_version_id = v_pvid
                 and lpi.vigencia_hasta is null and (lpi.vigencia_desde is null or lpi.vigencia_desde <= current_date);
              if not found then
                v_reasons:=array_append(v_reasons,format('linea_%s_lista_precio_item_no_corresponde',v_ord)); v_lpi_bloq := true;
              end if;
            end if;
          else
            select count(*) into v_lpi_n from public.lista_precio_items lpi
             where lpi.producto_id = v_pid and lpi.producto_version_id = v_pvid
               and lpi.vigencia_hasta is null and (lpi.vigencia_desde is null or lpi.vigencia_desde <= current_date);
            if v_lpi_n = 1 then
              select lpi.precio_lista, lpi.piso_minimo into v_rev_lista, v_rev_piso
                from public.lista_precio_items lpi
               where lpi.producto_id = v_pid and lpi.producto_version_id = v_pvid
                 and lpi.vigencia_hasta is null and (lpi.vigencia_desde is null or lpi.vigencia_desde <= current_date);
            elsif v_lpi_n > 1 then
              v_reasons:=array_append(v_reasons,format('linea_%s_precio_reventa_ambiguo',v_ord)); v_lpi_bloq := true;
            end if;
          end if;
          if v_lpi_bloq then
            null;   -- ya bloqueado arriba: no se emite con otro precio
          elsif v_rev_lista is null or v_rev_lista<=0 then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord));
          else
            -- CAMBIO reventa_sin_piso: sin costo Y sin piso no hay nada que proteja la economía →
            -- EXIGE APROBACIÓN (antes emitía ALLOWED en silencio). Con piso, el guard de abajo actúa igual que antes.
            if v_rev_piso is null or v_rev_piso<=0 then
              v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_reventa_sin_piso',v_ord));
            elsif v_price is not null and v_price>0 and v_price<v_rev_piso then
              v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_precio_bajo_piso',v_ord));
            end if;
            v_reventa:=true;
          end if;
        else
          v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord));
        end if;
      end if;
    else
      -- Legacy sin ProductVersion: el costo sale SOLO de la fila persistida, nunca del snapshot.
      begin v_cost:=nullif(v_dbpt->>'costoUnitario','')::numeric; exception when others then v_cost:=null; end;
      if lower(coalesce(v_dbpt->>'costoEstado','')) = 'preliminar' then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_preliminar_no_certificado',v_ord));
      elsif lower(coalesce(v_dbpt->>'costoEstado','')) in ('incompleto','bloqueado') then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_no_certificado',v_ord));
      end if;
    end if;

    if v_reventa then
      null;   -- reventa: el piso/approval ya actuó arriba; no hay margen que validar sin costo.
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
    return jsonb_build_object('state','BLOCKED','reasons',to_jsonb(v_reasons),'discrepancias',v_discrepancias,'economics',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
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

commit;

-- ROLLBACK: re-crear la función sin el bloque "CAMBIO reventa_sin_piso" (volver al md5 8d12115f),
-- o apagar la política: update public.reglas_comerciales set reventa_emite_sin_costo=false where estado='approved';
