-- Cuerpos REALES leídos de producción (pg_get_functiondef) el 2026-10-13 05:20 UTC, proyecto mtuvnbgljwbsaizjjgzs.
-- Sólo lectura: sirven para que la prueba aislada (PGlite) use el SQL que hoy corre, no un fixture viejo.
-- md5(pg_get_functiondef): actualizar_cotizacion_segura 84da6ec052f590d433f5d0c2a1a8e031 · cotizacion_segura fce4c268a4c835f53cf7de8df40f3949
-- Triggers en public.cotizaciones (BEFORE INSERT OR UPDATE, FOR EACH ROW):
--   trg_guard_cotizacion_estado_directo → private_api.guard_cotizacion_estado_directo()
--   trg_normalize_economics_status      → public.normalize_economics_on_cotizacion_write()
--   trg_pin_product_versions            → public.pin_product_versions_on_cotizacion_write()
--   trg_strip_seller_economics          → public.strip_seller_economics_on_cotizacion_write()
-- Triggers en public.cotizaciones_revisiones: trg_revisiones_autor → revisiones_autor(); trg_strip_seller_economics_revision → strip_seller_economics_on_revision_write()

CREATE OR REPLACE FUNCTION private_api.cotizacion_segura(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c record; v_email text; payload jsonb;
begin
  v_email := auth.jwt()->>'email';
  select * into c from cotizaciones where id=p_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not (c.usuario = v_email or puede_editar_config()) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_acceso');
  end if;
  payload := jsonb_build_object(
    'ok', true, 'id', c.id, 'folio', c.folio, 'folio_oficial', c.folio_oficial, 'cliente', c.cliente,
    'estado', c.estado, 'total', c.total, 'piezas', c.piezas, 'activa', c.activa,
    'cliente_id', c.cliente_id, 'contacto_id', c.contacto_id, 'proyecto_id', c.proyecto_id,
    'partidas', c.partidas, 'totales', c.totales, 'acomodo', c.acomodo, 'creado', c.creado
  );
  -- Dirección ve todo; el resto recibe el payload SIN economía interna.
  if puede_ver_economia() then
    return payload;
  end if;
  return public.jsonb_sin_economia(payload);
end $function$
;

CREATE OR REPLACE FUNCTION private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_c public.cotizaciones%rowtype;
  v_owner text;
  v_partidas jsonb;
  v_acomodo jsonb;
  v_totales jsonb;
  v_total numeric;
  v_piezas integer;
  v_activa boolean;
  v_cliente_id bigint;
  v_contacto_id bigint;
  v_proyecto_id bigint;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch invalido';
  end if;

  select lower(p.rol) into v_role
  from public.permitidos p
  where lower(p.email)=lower(v_email)
  limit 1;
  if v_role not in ('direccion','diseno','vendedor') then
    raise exception 'rol sin permiso';
  end if;

  select * into v_c from public.cotizaciones where id=p_cotizacion_id for update;
  if not found then raise exception 'cotizacion no existe'; end if;
  if not (lower(coalesce(v_c.usuario,''))=lower(v_email) or public.puede_editar_config()) then
    raise exception 'sin acceso';
  end if;
  if lower(coalesce(v_c.estado,'borrador')) <> 'borrador' then
    raise exception 'cotizacion no editable en estado %',v_c.estado;
  end if;

  if p_patch ? 'estado' and lower(coalesce(p_patch->>'estado','borrador')) <> 'borrador' then
    raise exception 'estado protegido; use el flujo de emision';
  end if;
  if p_patch ? 'folio_oficial' and nullif(p_patch->>'folio_oficial','') is distinct from v_c.folio_oficial then
    raise exception 'folio_oficial protegido; use el flujo de emision';
  end if;

  v_owner := v_c.usuario;
  if p_patch ? 'usuario' then
    if v_role not in ('direccion','diseno') then
      if lower(coalesce(p_patch->>'usuario','')) <> lower(coalesce(v_c.usuario,'')) then
        raise exception 'propietario protegido';
      end if;
    elsif nullif(trim(p_patch->>'usuario'),'') is not null then
      select p.email into v_owner
      from public.permitidos p
      where lower(p.email)=lower(trim(p_patch->>'usuario'))
      limit 1;
      if v_owner is null then raise exception 'usuario propietario invalido'; end if;
    end if;
  end if;

  v_partidas := case when p_patch ? 'partidas' then p_patch->'partidas' else v_c.partidas end;
  v_acomodo := case when p_patch ? 'acomodo' then p_patch->'acomodo' else v_c.acomodo end;
  v_totales := case when p_patch ? 'totales' then p_patch->'totales' else v_c.totales end;
  if jsonb_typeof(coalesce(v_partidas,'[]'::jsonb)) <> 'array' then raise exception 'partidas debe ser arreglo'; end if;
  if v_acomodo is not null and jsonb_typeof(v_acomodo) not in ('array','object') then raise exception 'acomodo invalido'; end if;
  if v_totales is not null and jsonb_typeof(v_totales) <> 'object' then raise exception 'totales invalido'; end if;

  v_total := v_c.total;
  if p_patch ? 'total' then begin v_total := coalesce(nullif(p_patch->>'total','')::numeric,0); exception when others then raise exception 'total invalido'; end; end if;
  v_piezas := v_c.piezas;
  if p_patch ? 'piezas' then begin v_piezas := coalesce(nullif(p_patch->>'piezas','')::integer,0); exception when others then raise exception 'piezas invalido'; end; end if;
  v_activa := v_c.activa;
  if p_patch ? 'activa' then begin v_activa := (p_patch->>'activa')::boolean; exception when others then raise exception 'activa invalida'; end; end if;
  v_cliente_id := v_c.cliente_id;
  if p_patch ? 'cliente_id' then begin v_cliente_id := nullif(p_patch->>'cliente_id','')::bigint; exception when others then raise exception 'cliente_id invalido'; end; end if;
  v_contacto_id := v_c.contacto_id;
  if p_patch ? 'contacto_id' then begin v_contacto_id := nullif(p_patch->>'contacto_id','')::bigint; exception when others then raise exception 'contacto_id invalido'; end; end if;
  v_proyecto_id := v_c.proyecto_id;
  if p_patch ? 'proyecto_id' then begin v_proyecto_id := nullif(p_patch->>'proyecto_id','')::bigint; exception when others then raise exception 'proyecto_id invalido'; end; end if;
  if v_total < 0 then raise exception 'total no puede ser negativo'; end if;
  if v_piezas < 0 then raise exception 'piezas no puede ser negativo'; end if;

  update public.cotizaciones
  set usuario=v_owner,
      cliente=case when p_patch ? 'cliente' then nullif(p_patch->>'cliente','') else cliente end,
      folio=case when p_patch ? 'folio' then nullif(p_patch->>'folio','') else folio end,
      partidas=v_partidas,
      acomodo=v_acomodo,
      totales=v_totales,
      total=v_total,
      piezas=v_piezas,
      huella_mp=case when p_patch ? 'huella_mp' then nullif(p_patch->>'huella_mp','') else huella_mp end,
      activa=v_activa,
      cliente_id=v_cliente_id,
      contacto_id=v_contacto_id,
      proyecto_id=v_proyecto_id,
      actualizado=now()
  where id=p_cotizacion_id;

  return public.cotizacion_segura(p_cotizacion_id);
end;
$function$
;

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

CREATE OR REPLACE FUNCTION private_api.guard_cotizacion_estado_directo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.estado IS DISTINCT FROM 'borrador' OR NEW.folio_oficial IS NOT NULL THEN
        RAISE EXCEPTION 'Estado/folio oficial protegidos: utilice RPC de emision' USING ERRCODE='42501';
      END IF;
    ELSE
      IF NEW.estado IS DISTINCT FROM OLD.estado OR NEW.folio_oficial IS DISTINCT FROM OLD.folio_oficial THEN
        RAISE EXCEPTION 'Estado/folio oficial protegidos: utilice RPC de emision' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

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
